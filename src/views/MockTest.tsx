import { useState } from "react";
import type { BandScore } from "../types";
import { topics } from "../topics";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { scoreAnswer } from "../services/api";
import { speak } from "../services/speech";

const part1 = topics.filter((t) => t.part === 1);
const part2 = topics.filter((t) => t.part === 2);
const part3 = topics.filter((t) => t.part === 3);

const testQuestions: string[] = [
  part1[0]?.questions[0],
  part1[1]?.questions[0],
  part2[0]?.questions[0],
  part3[0]?.questions[0],
  part3[1]?.questions[0],
].filter(Boolean) as string[];

function avg(nums: number[]) {
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 2) / 2;
}

export function MockTest() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<BandScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const rec = useAudioRecorder();

  const question = testQuestions[step];

  async function submit() {
    const blob = await rec.stop();
    if (!blob) return;
    setLoading(true);
    try {
      const r = await scoreAnswer({ question, topicTitle: "Mock Test", mode: "mock", audio: blob });
      const next = [...scores, r.feedback.score];
      setScores(next);
      if (step + 1 >= testQuestions.length) setDone(true);
      else setStep(step + 1);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    const final: BandScore = {
      fluency: avg(scores.map((s) => s.fluency)),
      lexical: avg(scores.map((s) => s.lexical)),
      grammar: avg(scores.map((s) => s.grammar)),
      pronunciation: avg(scores.map((s) => s.pronunciation)),
      overall: avg(scores.map((s) => s.overall)),
    };
    return (
      <div className="animate-fadeUp glass rounded-2xl border border-white/40 p-8 text-center shadow-xl shadow-indigo-900/20">
        <h2 className="font-display text-2xl font-bold text-slate-800">Mock test complete 🎉</h2>
        <div className="mt-5 inline-flex flex-col items-center rounded-3xl bg-gradient-to-br from-indigo-600 to-emerald-500 px-12 py-6 text-white shadow-lg">
          <div className="text-5xl font-extrabold">{final.overall}</div>
          <div className="mt-1 text-sm opacity-90">Estimated band</div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">Fluency {final.fluency}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">Lexical {final.lexical}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">Grammar {final.grammar}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">Pronunciation {final.pronunciation}</span>
        </div>
        <button onClick={() => { setStep(0); setScores([]); setDone(false); }} className="mt-6 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:brightness-110">
          Restart test
        </button>
      </div>
    );
  }

  const progress = (step / testQuestions.length) * 100;
  return (
    <div className="space-y-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-sm font-medium text-indigo-100">Question {step + 1} of {testQuestions.length}</div>
      <div className="glass rounded-2xl border border-white/40 p-6 shadow-xl shadow-indigo-900/20">
        <p className="text-xl font-semibold text-slate-800">{question}</p>
        <button onClick={() => speak(question)} className="mt-3 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200">
          🔊 Hear question
        </button>
        <div className="mt-5 flex items-center gap-3">
          {!rec.listening ? (
            <button onClick={rec.start} className="rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow-lg transition hover:brightness-110">🎙️ Answer</button>
          ) : (
            <button onClick={submit} className="animate-pulseRing rounded-xl bg-gradient-to-br from-rose-500 to-red-600 px-5 py-2.5 font-semibold text-white shadow-lg">⏹ Stop</button>
          )}
          {loading && <span className="text-sm font-medium text-indigo-600">Scoring…</span>}
        </div>
        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{rec.error}</p>}
      </div>
    </div>
  );
}
