import type { Feedback } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "ielts_token";

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
  const res = await fetch(`${BASE}${path}`, {
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

export interface HistoryRow {
  id: number;
  mode: string;
  topic_title: string;
  question: string;
  overall: string;
  created_at: string;
}

export async function fetchHistory(): Promise<HistoryRow[]> {
  const res = await fetch(`${BASE}/api/history`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Could not load history");
  return res.json();
}

export async function scoreAnswer(args: {
  question: string;
  topicTitle: string;
  mode: string;
  audio?: Blob;
  transcript?: string;
}): Promise<{ transcript: string; feedback: Feedback }> {
  const fd = new FormData();
  fd.append("question", args.question);
  fd.append("topicTitle", args.topicTitle);
  fd.append("mode", args.mode);
  if (args.audio) fd.append("audio", args.audio, "answer.webm");
  if (args.transcript) fd.append("transcript", args.transcript);

  const res = await fetch(`${BASE}/api/score`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Scoring failed");
  return data;
}
