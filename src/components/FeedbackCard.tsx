import type { Feedback } from "../types";
import { speak } from "../services/speech";
import { useVocab } from "../vocab/VocabContext";

// Tint each band tile by score so strengths/weaknesses read at a glance.
function bandColor(value: number) {
  if (value >= 7) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (value >= 6) return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
  if (value >= 5) return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
}

function band(label: string, value: number) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-2 py-3 shadow-sm ${bandColor(value)}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="mt-0.5 text-[11px] font-medium opacity-80">{label}</span>
    </div>
  );
}

// Common hesitation fillers & verbal crutches to flag in spoken answers.
const FILLERS = [
  "um", "uh", "er", "erm", "ah", "hmm",
  "you know", "i mean", "sort of", "kind of",
  "like", "basically", "actually", "literally",
];

const tones = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ok: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

// Derive words-per-minute and filler usage from the transcript + clip length.
function analyzeDelivery(transcript: string, durationSec: number) {
  const text = transcript.toLowerCase();
  const wordCount = (transcript.trim().match(/\b[\w']+\b/g) ?? []).length;
  const minutes = Math.max(durationSec / 60, 1 / 60);
  const wpm = Math.round(wordCount / minutes);

  const found: { word: string; count: number }[] = [];
  let fillerTotal = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
    const n = (text.match(re) ?? []).length;
    if (n > 0) {
      found.push({ word: f, count: n });
      fillerTotal += n;
    }
  }
  found.sort((a, b) => b.count - a.count);
  const fillerPerMin = +(fillerTotal / minutes).toFixed(1);

  let pace: { label: string; tone: string };
  if (wpm < 110) pace = { label: "Slow", tone: tones.ok };
  else if (wpm <= 160) pace = { label: "Natural", tone: tones.good };
  else if (wpm <= 185) pace = { label: "Brisk", tone: tones.ok };
  else pace = { label: "Too fast", tone: tones.bad };

  const fillerTone = fillerPerMin <= 3 ? tones.good : fillerPerMin <= 6 ? tones.ok : tones.bad;

  return { wordCount, wpm, pace, fillerTotal, fillerPerMin, fillerTone, top: found.slice(0, 4) };
}

export function FeedbackCard({
  feedback,
  transcript,
  durationSec,
}: {
  feedback: Feedback;
  transcript?: string;
  durationSec?: number;
}) {
  const s = feedback.score;
  const vocab = useVocab();
  const delivery =
    transcript && durationSec && durationSec > 0
      ? analyzeDelivery(transcript, durationSec)
      : null;
  return (
    <div className="animate-scaleIn glass mt-4 space-y-5 rounded-2xl p-6">
      <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 font-medium text-[#1d1d1f] dark:bg-white/5 dark:text-[#f5f5f7]">
        🌟 {feedback.encouragement}
      </p>

      <div className="grid grid-cols-5 gap-2">
        {band("Fluency", s.fluency)}
        {band("Lexical", s.lexical)}
        {band("Grammar", s.grammar)}
        {band("Pronun.", s.pronunciation)}
        <div className="relative flex flex-col items-center overflow-hidden rounded-xl bg-[#ef5f3c] px-2 py-3 text-white">
          <span className="text-xl font-semibold">{s.overall}</span>
          <span className="mt-0.5 text-[11px] opacity-90">Overall</span>
        </div>
      </div>

      {delivery && (
        <div className="rounded-xl bg-[#f5f5f7] p-4 dark:bg-white/5">
          <h4 className="mb-2 text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">🎙️ Delivery</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className={`flex flex-col items-center rounded-lg px-2 py-2.5 ${delivery.pace.tone}`}>
              <span className="text-lg font-bold">{delivery.wpm}</span>
              <span className="text-[10px] font-medium opacity-80">words/min · {delivery.pace.label}</span>
            </div>
            <div className={`flex flex-col items-center rounded-lg px-2 py-2.5 ${delivery.fillerTone}`}>
              <span className="text-lg font-bold">{delivery.fillerTotal}</span>
              <span className="text-[10px] font-medium opacity-80">fillers · {delivery.fillerPerMin}/min</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-white px-2 py-2.5 text-[#1d1d1f] shadow-sm dark:bg-white/10 dark:text-[#f5f5f7]">
              <span className="text-lg font-bold">{delivery.wordCount}</span>
              <span className="text-[10px] font-medium opacity-70">words spoken</span>
            </div>
          </div>
          {delivery.top.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#86868b]">Most used fillers:</span>
              {delivery.top.map((f) => (
                <span
                  key={f.word}
                  className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[#6e6e73] dark:bg-white/10 dark:text-[#a1a1a6]"
                >
                  “{f.word}” ×{f.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-emerald-50/60 p-4 dark:bg-emerald-500/10">
          <h4 className="mb-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">✅ Strengths</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-[#a1a1a6]">
            {feedback.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-amber-50/60 p-4 dark:bg-amber-500/10">
          <h4 className="mb-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">🎯 To improve</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-[#a1a1a6]">
            {feedback.improvements.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">✨ Your answer, upgraded to band 8</h4>
          <button
            onClick={() => speak(feedback.enhancedAnswer)}
            className="rounded-full bg-[#1d1d1f] px-3 py-1 text-xs font-medium text-white transition hover:bg-black active:scale-95 dark:bg-white dark:text-[#1d1d1f] dark:hover:bg-white/90"
          >
            🔊 Hear it
          </button>
        </div>
        <p className="rounded-xl bg-[#f5f5f7] p-4 text-sm leading-relaxed text-[#1d1d1f] dark:bg-white/5 dark:text-[#f5f5f7]">
          {feedback.enhancedAnswer}
        </p>
      </div>

      {feedback.vocabulary && feedback.vocabulary.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">📚 Useful phrases to learn</h4>
          <ul className="space-y-2">
            {feedback.vocabulary.map((v) => {
              const saved = vocab.has(v.phrase);
              return (
                <li
                  key={v.phrase}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f7] px-3 py-2.5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{v.phrase}</p>
                    <p className="truncate text-xs text-[#6e6e73] dark:text-[#a1a1a6]">{v.meaning}</p>
                  </div>
                  <button
                    onClick={() => (saved ? vocab.remove(v.phrase) : vocab.add(v.phrase, v.meaning))}
                    aria-label={saved ? "Remove from word bank" : "Save to word bank"}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      saved
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-[#1d1d1f] text-white hover:bg-black dark:bg-white dark:text-[#1d1d1f] dark:hover:bg-white/90"
                    }`}
                  >
                    {saved ? "★ Saved" : "☆ Save"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
