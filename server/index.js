import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import { query } from "./db.js";
import { signToken, auth } from "./auth.js";
import { transcribeAudio, scoreAnswer } from "./gemini.js";
import { analyzeDelivery } from "./delivery.js";
import {
  stripe,
  isSubscribed,
  practiceUsedThisMonth,
  subscriptionSummary,
  ensureCustomer,
  applySubscription,
  FREE_MONTHLY_PRACTICE,
} from "./billing.js";

const app = express();

// Stripe webhook needs the raw, unparsed body to verify the signature, so it
// is registered BEFORE express.json() and uses the raw body parser.
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error("webhook signature error:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await applySubscription(s.customer, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await applySubscription(sub.customer, sub);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error("webhook handler error:", e);
    res.status(500).end();
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(
  cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*", credentials: false })
);

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

app.get("/", (_req, res) =>
  res.json({ service: "IELTS Speaking API", status: "ok", docs: "/api/health" })
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- Auth ----
app.post("/api/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: "Name, email and password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      "INSERT INTO students (email, name, pw_hash) VALUES ($1,$2,$3) RETURNING id, email, name",
      [email.toLowerCase(), name, hash]
    );
    res.json({ token: signToken(rows[0]), student: rows[0] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("register error:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const { rows } = await query("SELECT * FROM students WHERE email=$1", [
      email.toLowerCase(),
    ]);
    const s = rows[0];
    if (!s || !(await bcrypt.compare(password, s.pw_hash)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: signToken(s), student: { id: s.id, email: s.email, name: s.name } });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

// ---- Subscription / billing ----
app.get("/api/subscription", auth, async (req, res) => {
  try {
    res.json(await subscriptionSummary(req.student.id));
  } catch (e) {
    console.error("subscription error:", e);
    res.status(500).json({ error: "Could not load subscription" });
  }
});

// Start a Stripe Checkout session for the £9.99/mo plan.
app.post("/api/checkout", auth, async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID)
    return res.status(503).json({ error: "Billing is not configured" });
  try {
    const customer = await ensureCustomer(req.student);
    const origin = (process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:5173").trim();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("checkout error:", e);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// Open the Stripe billing portal so subscribers can manage/cancel.
app.post("/api/billing-portal", auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
  try {
    const customer = await ensureCustomer(req.student);
    const origin = (process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:5173").trim();
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/`,
    });
    res.json({ url: portal.url });
  } catch (e) {
    console.error("portal error:", e);
    res.status(500).json({ error: "Could not open billing portal" });
  }
});

// ---- Transcribe + score + save ----
app.post("/api/score", auth, upload.single("audio"), async (req, res) => {
  try {
    const { question, topicTitle, mode = "practice", part = 1 } = req.body;

    // Enforce the free-tier limits before doing any paid AI work.
    const { rows: subRows } = await query(
      "SELECT subscription_status, subscription_period_end FROM students WHERE id=$1",
      [req.student.id]
    );
    const subscribed = isSubscribed(subRows[0]);
    if (!subscribed) {
      if (mode === "mock") {
        return res.status(402).json({
          error: "Mock tests are part of Pro. Subscribe for £9.99/month to unlock full mock tests.",
          code: "upgrade_required",
        });
      }
      const used = await practiceUsedThisMonth(req.student.id);
      if (used >= FREE_MONTHLY_PRACTICE) {
        return res.status(402).json({
          error: `You've used all ${FREE_MONTHLY_PRACTICE} free practices this month. Subscribe for £9.99/month for unlimited practice.`,
          code: "upgrade_required",
        });
      }
    }

    let transcript = req.body.transcript || "";
    if (req.file) transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);
    if (!transcript) return res.status(400).json({ error: "No speech detected" });

    const feedback = await scoreAnswer(question, transcript, Number(part) || 1);
    const delivery = analyzeDelivery(transcript, Number(req.body.durationSec) || 0);
    const s = feedback.score;
    await query(
      `INSERT INTO sessions (student_id, mode, part, topic_title, question, transcript,
        fluency, lexical, grammar, pronunciation, overall, feedback, wpm, filler_per_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [req.student.id, mode, Number(part) || null, topicTitle, question, transcript,
        s.fluency, s.lexical, s.grammar, s.pronunciation, s.overall, feedback,
        delivery.wpm || null, delivery.fillerPerMin]
    );
    res.json({ transcript, feedback, delivery });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Scoring failed" });
  }
});

// ---- History ----
app.get("/api/history", auth, async (req, res) => {
  const { rows } = await query(
    "SELECT id, mode, part, topic_title, question, fluency, lexical, grammar, pronunciation, overall, wpm, filler_per_min, created_at FROM sessions WHERE student_id=$1 ORDER BY created_at DESC LIMIT 100",
    [req.student.id]
  );
  res.json(rows);
});

// Delete a single session (only the owner's own rows).
app.delete("/api/history/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE id=$1 AND student_id=$2",
    [id, req.student.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
// Only listen when run directly (local dev). On Vercel the app is used as a handler.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
}

export default app;
