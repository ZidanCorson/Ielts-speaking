// Mirrors the client-side delivery analysis so stored stats stay consistent.
const FILLERS = [
  "um", "uh", "er", "erm", "ah", "hmm",
  "you know", "i mean", "sort of", "kind of",
  "like", "basically", "actually", "literally",
];

// Words-per-minute and filler usage from a transcript + clip length (seconds).
export function analyzeDelivery(transcript, durationSec) {
  const text = (transcript || "").toLowerCase();
  const wordCount = (transcript || "").trim().match(/\b[\w']+\b/g)?.length ?? 0;
  const seconds = Number(durationSec) || 0;
  const minutes = Math.max(seconds / 60, 1 / 60);
  const wpm = seconds > 0 ? Math.round(wordCount / minutes) : 0;

  let fillerTotal = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
    fillerTotal += (text.match(re) ?? []).length;
  }
  const fillerPerMin = seconds > 0 ? +(fillerTotal / minutes).toFixed(1) : 0;

  return { wordCount, wpm, fillerTotal, fillerPerMin };
}
