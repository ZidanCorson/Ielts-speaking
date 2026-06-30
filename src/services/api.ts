import type { Feedback } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "ielts_token";

// Wrap fetch with an abort-based timeout so a hung upload/transcription
// surfaces a clear error instead of spinning forever.
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  ms = 60000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw err instanceof Error ? err : new Error("Network error");
  } finally {
    clearTimeout(id);
  }
}

export interface Student {
  id: number;
  email: string;
  name: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function jsonReq(path: string, body: unknown) {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function register(name: string, email: string, password: string) {
  return jsonReq("/api/register", { name, email, password });
}
export function login(email: string, password: string) {
  return jsonReq("/api/login", { email, password });
}

// ---- Subscription / billing ----
export interface Subscription {
  subscribed: boolean;
  plan: "free" | "pro";
  priceLabel: string;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number | null;
  periodEnd: string | null;
}

// Thrown when the server returns 402 (free quota exhausted / Pro-only feature).
export class UpgradeRequiredError extends Error {
  code = "upgrade_required" as const;
}

export async function fetchSubscription(): Promise<Subscription> {
  const res = await fetchWithTimeout(`${BASE}/api/subscription`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Could not load subscription");
  return res.json();
}

export async function startCheckout(): Promise<string> {
  const res = await fetchWithTimeout(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start checkout");
  return data.url as string;
}

export async function openBillingPortal(): Promise<string> {
  const res = await fetchWithTimeout(`${BASE}/api/billing-portal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not open billing portal");
  return data.url as string;
}

export interface HistoryRow {
  id: number;
  mode: string;
  part: number | null;
  topic_title: string;
  question: string;
  fluency: string;
  lexical: string;
  grammar: string;
  pronunciation: string;
  overall: string;
  wpm: number | null;
  filler_per_min: string | null;
  created_at: string;
}

export async function fetchHistory(): Promise<HistoryRow[]> {
  const res = await fetchWithTimeout(`${BASE}/api/history`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Could not load history");
  return res.json();
}

export async function deleteSession(id: number): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}/api/history/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not delete session");
  }
}

export async function scoreAnswer(args: {
  question: string;
  topicTitle: string;
  mode: string;
  part?: number;
  audio?: Blob;
  audioName?: string;
  transcript?: string;
  durationSec?: number;
}): Promise<{ transcript: string; feedback: Feedback }> {
  const fd = new FormData();
  fd.append("question", args.question);
  fd.append("topicTitle", args.topicTitle);
  fd.append("mode", args.mode);
  if (args.part) fd.append("part", String(args.part));
  if (args.durationSec) fd.append("durationSec", String(args.durationSec));
  if (args.audio) fd.append("audio", args.audio, args.audioName ?? "answer.webm");
  if (args.transcript) fd.append("transcript", args.transcript);

  const res = await fetchWithTimeout(`${BASE}/api/score`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (res.status === 402) throw new UpgradeRequiredError(data.error || "Upgrade required");
  if (!res.ok) throw new Error(data.error || "Scoring failed");
  return data;
}
