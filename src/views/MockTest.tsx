import { useEffect, useState } from "react";
import type { BandScore, Feedback } from "../types";
import { topics } from "../topics";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { scoreAnswer, UpgradeRequiredError } from "../services/api";
import { speak } from "../services/speech";
import { FeedbackCard } from "../components/FeedbackCard";
import { MicMeter } from "../components/MicMeter";
import { UpgradeCard } from "../components/UpgradeCard";
import { useHistory } from "../history/HistoryContext";
import { useSubscription } from "../billing/SubscriptionContext";

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

// IELTS Part 2: 1 min preparation, then speak for up to 2 min.
const PREP_SECONDS = 60;
const LONG_TURN_SECONDS = 120;

function avg(nums: number[]) {
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 2) / 2;
}

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

interface Result {
  question: string;
  part: number;
  transcript: string;
  durationSec: number;
  feedback: Feedback;
}

export function MockTest() {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [review, setReview] = useState<number | null>(null);
  const rec = useAudioRecorder();
  const { refresh } = useHistory();
  const { sub } = useSubscription();

  const question = testQuestions[step];

  // Part 2 preparation countdown — auto-starts recording at zero.
  useEffect(() => {
    if (prepLeft === null) return;
    if (prepLeft <= 0) {
      setPrepLeft(null);
      rec.start();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((p) => (p ?? 1) - 1), 1000);
    return () => window.clearTimeout(t);
  }, [prepLeft]);

  // Part 2 long turn caps at 2 minutes.
  useEffect(() => {
    if (rec.listening && question?.part === 2 && rec.seconds >= LONG_TURN_SECONDS) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.seconds, rec.listening]);

  async function submit() {
    const take = await rec.stop();
    if (!take) {
      setError("No audio captured. Please try again.");
      return;
    }
    if (take.seconds < rec.minSeconds) {
      setError("That was too short — speak for at least a couple of seconds.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await scoreAnswer({
        question: question.question,
        topicTitle: "Mock Test",
        mode: "mock",
        part: question.part,
        audio: take.blob,
        audioName: `answer.${take.ext}`,
        durationSec: take.seconds,
      });
      const next: Result[] = [
        ...results,
        { question: question.question, part: question.part, transcript: r.transcript, durationSec: take.seconds, feedback: r.feedback },
      ];
      setResults(next);
      if (step + 1 >= testQuestions.length) setDone(true);
      else setStep(step + 1);
      refresh();
    } catch (e) {
      if (e instanceof UpgradeRequiredError) setError(e.message);
      else setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setLoading(false);
    }
  }

  function discard() {
    rec.cancel();
    setPrepLeft(null);
    setError("");
  }

  function restart() {
    setStep(0);
    setResults([]);
    setDone(false);
    setError("");
    setReview(null);
    discard();
  }

  // Mock tests are a Pro-only feature.
  if (sub && !sub.subscribed) {
    return (
      <div className="space-y-4">
        <UpgradeCard
          title="Full mock tests are a Pro feature"
          message="Sit a complete 5-question IELTS speaking mock with an estimated overall band — included with Pro."
        />
      </div>
    );
  }

  if (done) {
    const scores = results.map((r) => r.feedback.score);
    const final: BandScore = {
      fluency: avg(scores.map((s) => s.fluency)),
      lexical: avg(scores.map((s) => s.lexical)),
      grammar: avg(scores.map((s) => s.grammar)),
      pronunciation: avg(scores.map((s) => s.pronunciation)),
      overall: avg(scores.map((s) => s.overall)),
    };
    return (
      <div className="space-y-4">
        <div className="animate-scaleIn glass rounded-3xl p-8 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">Mock test complete 🎉</h2>
          <p className="mt-1 text-base text-[#6e6e73] dark:text-[#a1a1a6]">Here's your estimated overall band.</p>
          <div className="relative mx-auto mt-5 inline-flex flex-col items-center">
            <div className="relative inline-flex flex-col items-center rounded-3xl bg-[#ef5f3c] px-12 py-6 text-white">
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
          <button onClick={restart} className="btn-primary mt-6 rounded-full px-6 py-2.5 font-medium">
            Restart test
          </button>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-display text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Review your answers</h3>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => setReview(review === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 text-left transition hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span className="flex items-center gap-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">
                    <span className="glass-dark rounded-full px-2 py-0.5 text-[11px] font-medium">Part {r.part}</span>
                    <span className="line-clamp-1">{r.question}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-[#ef5f3c] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {r.feedback.score.overall}
                    </span>
                    <span className="text-[#86868b]">{review === i ? "▲" : "▼"}</span>
                  </span>
                </button>
                {review === i && (
                  <div className="mt-2">
                    {r.transcript && (
                      <p className="mb-2 rounded-xl bg-[#f5f5f7] p-3 text-sm text-[#1d1d1f] dark:bg-white/5 dark:text-[#f5f5f7]">
                        <span className="font-semibold text-[#86868b]">You said: </span>{r.transcript}
                      </p>
                    )}
                    <FeedbackCard feedback={r.feedback} transcript={r.transcript} durationSec={r.durationSec} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
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
        <div className="h-full rounded-full bg-[#ef5f3c] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="glass animate-fadeUp rounded-2xl p-6">
        <p className="text-2xl font-semibold leading-snug tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">{question.question}</p>
        <button onClick={() => speak(question.question)} className="btn-chip mt-3 rounded-full px-3 py-1.5 text-xs font-medium">
          🔊 Hear question
        </button>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {prepLeft !== null ? (
            <>
              <span className="flex items-center gap-2 rounded-full bg-[#ff9f0a]/15 px-4 py-2.5 text-sm font-semibold text-[#b25b00] dark:text-[#ffd60a]">
                📝 Prep time · {fmt(prepLeft)}
              </span>
              <button
                onClick={() => {
                  setPrepLeft(null);
                  rec.start();
                }}
                className="btn-primary rounded-full px-6 py-2.5 font-medium"
              >
                🎙️ Start speaking now
              </button>
            </>
          ) : !rec.listening ? (
            <>
              {question.part === 2 && (
                <button
                  onClick={() => setPrepLeft(PREP_SECONDS)}
                  className="btn-chip rounded-full px-5 py-2.5 text-sm font-medium"
                >
                  📝 Prepare (1 min)
                </button>
              )}
              <button
                onClick={rec.start}
                aria-label="Start recording your answer"
                className="btn-primary rounded-full px-6 py-2.5 font-medium"
              >
                🎙️ Answer
              </button>
            </>
          ) : (
            <>
              <button
                onClick={submit}
                aria-label="Stop recording and submit answer"
                className="animate-pulseRing flex items-center gap-2 rounded-full bg-[#ff3b30] px-6 py-2.5 font-medium text-white shadow-sm"
              >
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                {question.part === 2
                  ? `${fmt(Math.max(0, LONG_TURN_SECONDS - rec.seconds))} left · Stop`
                  : `${fmt(rec.seconds)} · Stop`}
              </button>
              <button
                onClick={discard}
                aria-label="Discard recording"
                className="rounded-full bg-black/5 px-4 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:bg-black/10 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20"
              >
                Discard
              </button>
              <MicMeter level={rec.level} />
            </>
          )}
          {loading && (
            <span className="flex items-center gap-2 text-sm font-medium text-[#d24b2a] dark:text-[#ff9e7a]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#ef5f3c]/30 border-t-[#ef5f3c] dark:border-[#ff7a52]/30 dark:border-t-[#ff7a52]" />
              Scoring…
            </span>
          )}
        </div>
        {question.part === 2 && !rec.listening && prepLeft === null && (
          <p className="mt-2 text-xs text-[#86868b]">
            Part 2 tip: take 1 minute to prepare, then speak for 1–2 minutes.
          </p>
        )}
        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{rec.error}</p>}
        {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
