import type { HistoryRow } from "./api";

// Local YYYY-MM-DD key for grouping sessions by calendar day (streak math).
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Count consecutive days (ending today, or yesterday if today not done yet).
export function computeStreak(rows: HistoryRow[]) {
  const days = new Set(rows.map((r) => dayKey(new Date(r.created_at))));
  const today = new Date();
  const practicedToday = days.has(dayKey(today));
  const dayMs = 86400000;
  if (!practicedToday && !days.has(dayKey(new Date(today.getTime() - dayMs))))
    return { streak: 0, practicedToday };
  let cursor = practicedToday ? today : new Date(today.getTime() - dayMs);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return { streak, practicedToday };
}
