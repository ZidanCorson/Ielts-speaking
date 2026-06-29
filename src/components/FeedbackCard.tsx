import type { Feedback } from "../types";
import { speak } from "../services/speech";

function band(label: string, value: number) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-3 shadow-sm">
      <span className="text-xl font-bold text-slate-800">{value}</span>
      <span className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

export function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const s = feedback.score;
  return (
    <div className="animate-fadeUp glass mt-4 space-y-5 rounded-2xl border border-white/40 p-6 shadow-xl shadow-indigo-900/20">
      <p className="rounded-xl bg-gradient-to-r from-emerald-500/15 to-indigo-500/15 px-4 py-3 font-medium text-emerald-800">
        🌟 {feedback.encouragement}
      </p>

      <div className="grid grid-cols-5 gap-2">
        {band("Fluency", s.fluency)}
        {band("Lexical", s.lexical)}
        {band("Grammar", s.grammar)}
        {band("Pronun.", s.pronunciation)}
        <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 px-2 py-3 text-white shadow-lg">
          <span className="text-xl font-bold">{s.overall}</span>
          <span className="mt-0.5 text-[11px]">Overall</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-700">✅ Strengths</h4>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {feedback.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-700">🎯 To improve</h4>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {feedback.improvements.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Enhanced model answer</h4>
          <button
            onClick={() => speak(feedback.enhancedAnswer)}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            🔊 Hear it
          </button>
        </div>
        <p className="rounded-xl bg-white/70 p-4 text-sm leading-relaxed text-slate-700">
          {feedback.enhancedAnswer}
        </p>
      </div>
    </div>
  );
}
