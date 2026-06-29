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

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*", credentials: false })
);

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

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
  const { rows } = await query("SELECT * FROM students WHERE email=$1", [
    email?.toLowerCase(),
  ]);
  const s = rows[0];
  if (!s || !(await bcrypt.compare(password, s.pw_hash)))
    return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: signToken(s), student: { id: s.id, email: s.email, name: s.name } });
});

// ---- Transcribe + score + save ----
app.post("/api/score", auth, upload.single("audio"), async (req, res) => {
  try {
    const { question, topicTitle, mode = "practice" } = req.body;
    let transcript = req.body.transcript || "";
    if (req.file) transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);
    if (!transcript) return res.status(400).json({ error: "No speech detected" });

    const feedback = await scoreAnswer(question, transcript);
    const s = feedback.score;
    await query(
      `INSERT INTO sessions (student_id, mode, topic_title, question, transcript,
        fluency, lexical, grammar, pronunciation, overall, feedback)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [req.student.id, mode, topicTitle, question, transcript, s.fluency, s.lexical,
        s.grammar, s.pronunciation, s.overall, feedback]
    );
    res.json({ transcript, feedback });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Scoring failed" });
  }
});

// ---- History ----
app.get("/api/history", auth, async (req, res) => {
  const { rows } = await query(
    "SELECT id, mode, topic_title, question, overall, created_at FROM sessions WHERE student_id=$1 ORDER BY created_at DESC LIMIT 100",
    [req.student.id]
  );
  res.json(rows);
});

const PORT = process.env.PORT || 4000;
// Only listen when run directly (local dev). On Vercel the app is used as a handler.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
}

export default app;
