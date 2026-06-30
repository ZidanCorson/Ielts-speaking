import { useState } from "react";
import type { BandScore } from "../types";
import { topics } from "../topics";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { scoreAnswer } from "../services/api";
import { speak } from "../services/speech";

const part1 = topics.filter((t) => t.part === 1);
const part2 = topics.filter((t) => t.part === 2);
const part3 = topics.filter((t) => t.part === 3);

const testQuestions: { question: string; part: number }[] = [
  { question: part1[0]?.questions[0], part: 1 },
  { question: part1[1]?.questions[0], part: 1 },
  { question: part2[0]?.questions[0], part: 2 },
  { question: part3[0]?.questions[0], part: 3 },
  { question: part3[1]?.questions[0], part: 3 },
].filter((q) => q.question) as { question: string; part: number }[];

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
      const r = await scoreAnswer({ question: question.question, topicTitle: "Mock Test", mode: "mock", part: question.part, audio: blob });
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
      <div className="animate-scaleIn glass rounded-3xl p-8 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">Mock test complete 🎉</h2>
        <p className="mt-1 text-base text-[#6e6e73] dark:text-[#a1a1a6]">Here's your estimated overall band.</p>
        <div className="relative mx-auto mt-5 inline-flex flex-col items-center">
          <div className="relative inline-flex flex-col items-center rounded-3xl bg-[#0071e3] px-12 py-6 text-white">
            <div className="text-5xl font-semibold">{final.overall}</div>
            <div className="mt-1 text-sm opacity-90">Estimated band</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["Fluency", final.fluency],
            ["Lexical", final.lexical],
            ["Grammar", final.grammar],
            ["Pronun.", final.pronunciation],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[#f5f5f7] px-2 py-3 dark:bg-white/5">
              <div className="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{value}</div>
              <div className="text-[11px] font-medium text-[#86868b]">{label}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setStep(0); setScores([]); setDone(false); }} className="btn-primary mt-6 rounded-full px-6 py-2.5 font-medium">
          Restart test
        </button>
      </div>
    );
  }

  const progress = (step / testQuestions.length) * 100;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
        <span>Question {step + 1} of {testQuestions.length}</span>
        <span className="glass-dark rounded-full px-2.5 py-0.5 text-xs">Part {question.part}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-[#0071e3] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="glass animate-fadeUp rounded-2xl p-6">
        <p className="text-2xl font-semibold leading-snug tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">{question.question}</p>
        <button onClick={() => speak(question.question)} className="btn-chip mt-3 rounded-full px-3 py-1.5 text-xs font-medium">
          🔊 Hear question
        </button>
        <div className="mt-5 flex items-center gap-3">
          {!rec.listening ? (
            <button onClick={rec.start} className="btn-primary rounded-full px-6 py-2.5 font-medium">🎙️ Answer</button>
          ) : (
            <button onClick={submit} className="animate-pulseRing flex items-center gap-2 rounded-full bg-[#ff3b30] px-6 py-2.5 font-medium text-white shadow-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Stop</button>
          )}
          {loading && (
            <span className="flex items-center gap-2 text-sm font-medium text-[#0071e3] dark:text-[#2997ff]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0071e3]/30 border-t-[#0071e3] dark:border-[#2997ff]/30 dark:border-t-[#2997ff]" />
              Scoring…
            </span>
          )}
        </div>
        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{rec.error}</p>}
      </div>
    </div>
  );
}
