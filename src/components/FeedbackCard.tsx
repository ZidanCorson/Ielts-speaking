import type { Feedback } from "../types";
import { speak } from "../services/speech";

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

export function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const s = feedback.score;
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
        <div className="relative flex flex-col items-center overflow-hidden rounded-xl bg-[#0071e3] px-2 py-3 text-white">
          <span className="text-xl font-semibold">{s.overall}</span>
          <span className="mt-0.5 text-[11px] opacity-90">Overall</span>
        </div>
      </div>

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
          <h4 className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">✨ Enhanced model answer</h4>
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
    </div>
  );
}
