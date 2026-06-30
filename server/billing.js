import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import Stripe from "stripe";
import { query } from "./db.js";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

// Free plan: a fixed number of *practice* answers per calendar month.
// Mock tests are reserved for subscribers.
export const FREE_MONTHLY_PRACTICE = 5;
export const PLAN_PRICE_LABEL = "£9.99 / month";

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;

// A student counts as subscribed while their status is "active" (or "trialing")
// and, if we know the period end, it hasn't lapsed yet.
export function isSubscribed(row) {
  if (!row) return false;
  const active = row.subscription_status === "active" || row.subscription_status === "trialing";
  if (!active) return false;
  if (row.subscription_period_end && new Date(row.subscription_period_end) < new Date()) return false;
  return true;
}

// Count how many practice answers the student has scored in the current
// calendar month (UTC), used to enforce the free-tier quota.
export async function practiceUsedThisMonth(studentId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM sessions
       WHERE student_id = $1 AND mode = 'practice'
         AND date_trunc('month', created_at) = date_trunc('month', now())`,
    [studentId]
  );
  return rows[0]?.n ?? 0;
}

// Build the subscription summary the frontend needs to render quota + paywall.
export async function subscriptionSummary(studentId) {
  const { rows } = await query(
    "SELECT subscription_status, subscription_period_end FROM students WHERE id=$1",
    [studentId]
  );
  const subscribed = isSubscribed(rows[0]);
  const used = subscribed ? 0 : await practiceUsedThisMonth(studentId);
  return {
    subscribed,
    plan: subscribed ? "pro" : "free",
    priceLabel: PLAN_PRICE_LABEL,
    freeLimit: FREE_MONTHLY_PRACTICE,
    freeUsed: used,
    freeRemaining: subscribed ? null : Math.max(0, FREE_MONTHLY_PRACTICE - used),
    periodEnd: rows[0]?.subscription_period_end ?? null,
  };
}

// Find (or lazily create) the Stripe customer for a student.
export async function ensureCustomer(student) {
  const { rows } = await query(
    "SELECT stripe_customer_id, email, name FROM students WHERE id=$1",
    [student.id]
  );
  const row = rows[0];
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: row?.email || student.email,
    name: row?.name,
    metadata: { studentId: String(student.id) },
  });
  await query("UPDATE students SET stripe_customer_id=$1 WHERE id=$2", [customer.id, student.id]);
  return customer.id;
}

// Persist subscription state from a Stripe subscription object.
export async function applySubscription(customerId, sub) {
  const status = sub?.status ?? "canceled";
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  await query(
    "UPDATE students SET subscription_status=$1, subscription_period_end=$2 WHERE stripe_customer_id=$3",
    [status === "canceled" || status === "unpaid" ? "free" : status, periodEnd, customerId]
  );
}
