import { useEffect, useMemo, useState } from "react";
import type { Feedback, IeltsPart, Topic } from "../types";
import { topics, getDailyTopic } from "../topics";import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { scoreAnswer, UpgradeRequiredError } from "../services/api";
import { speak } from "../services/speech";
import { FeedbackCard } from "../components/FeedbackCard";
import { MicMeter } from "../components/MicMeter";
import { UpgradeCard } from "../components/UpgradeCard";
import { useHistory } from "../history/HistoryContext";
import { useSubscription } from "../billing/SubscriptionContext";

const partMeta: Record<IeltsPart, { label: string; color: string }> = {
  1: { label: "Part 1 · Interview", color: "from-sky-500 to-indigo-500" },
  2: { label: "Part 2 · Cue Card", color: "from-violet-500 to-fuchsia-500" },
  3: { label: "Part 3 · Discussion", color: "from-emerald-500 to-teal-500" },
};

// IELTS Part 2: 1 min preparation, then speak for up to 2 min.
const PREP_SECONDS = 60;
const LONG_TURN_SECONDS = 120;

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function Practice() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [filter, setFilter] = useState<IeltsPart | "all">("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [transcript, setTranscript] = useState("");
  const [durationSec, setDurationSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [paywall, setPaywall] = useState("");
  const rec = useAudioRecorder();
  const { refresh, rows } = useHistory();
  const { refresh: refreshSub } = useSubscription();

  const shown = useMemo(
    () =>
      topics
        .filter(
          (t) =>
            (filter === "all" || t.part === filter) &&
            t.title.toLowerCase().includes(search.toLowerCase())
        )
        // Keep parts together (topics.ts appends extra Part 1 topics after Part 3).
        .sort((a, b) => a.part - b.part),
    [filter, search]
  );

  // Group the visible topics by part so Part 1/2/3 render in their own sections.
  const groups = useMemo(() => {
    const by: Record<IeltsPart, Topic[]> = { 1: [], 2: [], 3: [] };
    for (const t of shown) by[t.part].push(t);
    return ([1, 2, 3] as IeltsPart[])
      .map((p) => ({ part: p, items: by[p] }))
      .filter((g) => g.items.length > 0);
  }, [shown]);

  // The featured topic for today (rotates daily, same for everyone).
  const daily = useMemo(() => getDailyTopic(), []);

  // Recommend a topic that targets the student's weakest criterion so far.
  const weakSpot = useMemo(() => {
    if (rows.length < 3) return null; // need a little history first
    const keys = ["fluency", "lexical", "grammar", "pronunciation"] as const;
    const weakest = keys
      .map((k) => ({ key: k, avg: rows.reduce((a, r) => a + Number(r[k]), 0) / rows.length }))
      .sort((a, b) => a.avg - b.avg)[0];
    const map = {
      fluency: { part: 2 as IeltsPart, label: "Fluency & coherence", tip: "Practise speaking at length without long pauses." },
      lexical: { part: 3 as IeltsPart, label: "Lexical resource", tip: "Stretch your vocabulary and paraphrasing in discussion." },
      grammar: { part: 2 as IeltsPart, label: "Grammatical range", tip: "Use complex sentences and varied tenses in a long turn." },
      pronunciation: { part: 1 as IeltsPart, label: "Pronunciation", tip: "Focus on clear, natural delivery in short answers." },
    } as const;
    const m = map[weakest.key];
    const pool = topics.filter((t) => t.part === m.part);
    if (!pool.length) return null;
    const done = new Set(rows.map((r) => r.topic_title));
    const topic = pool.find((t) => !done.has(t.title)) ?? pool[rows.length % pool.length];
    return { ...m, avg: weakest.avg, topic };
  }, [rows]);

  function open(t: Topic) {
    setTopic(t);
    setQIndex(0);
    setFeedback(null);
    setTranscript("");
    setAudioUrl(null);
    setError("");
    setPaywall("");
    setPrepLeft(null);
  }

  // Free the previous object URL whenever the replay clip changes or unmounts.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Part 2 preparation countdown — auto-starts recording when it reaches zero.
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

  // Part 2 long turn caps at 2 minutes — stop and score automatically.
  useEffect(() => {
    if (rec.listening && topic?.part === 2 && rec.seconds >= LONG_TURN_SECONDS) {
      stopAndScore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.seconds, rec.listening]);

  async function stopAndScore() {
    if (!topic) return;
    const take = await rec.stop();
    if (!take) {
      setError("No audio captured. Please try again.");
      return;
    }
    if (take.seconds < rec.minSeconds) {
      setError("That was too short — speak for at least a couple of seconds.");
      return;
    }
    // Keep the clip so the student can listen back to their own answer.
    try {
      setAudioUrl(URL.createObjectURL(take.blob));
    } catch {
      /* replay clip is optional — ignore if the browser rejects the blob */
    }
    setLoading(true);
    setError("");
    setPaywall("");
    setFeedback(null);
    try {
      const r = await scoreAnswer({
        question: topic.questions[qIndex],
        topicTitle: topic.title,
        mode: "practice",
        part: topic.part,
        audio: take.blob,
        audioName: `answer.${take.ext}`,
        durationSec: take.seconds,
      });
      setTranscript(r.transcript);
      setDurationSec(take.seconds);
      setFeedback(r.feedback);
      speak(r.feedback.encouragement);
      refresh();
      refreshSub();
    } catch (e) {
      if (e instanceof UpgradeRequiredError) setPaywall(e.message);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function discard() {
    rec.cancel();
    setPrepLeft(null);
    setAudioUrl(null);
    setError("");
  }

  if (!topic) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => open(daily)}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8a4c] to-[#f43f5e] p-5 text-left text-white shadow-sm transition active:scale-[0.99]"
        >
          <span className="pointer-events-none absolute -right-6 -top-8 text-8xl opacity-20 transition group-hover:scale-110">⭐</span>
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">⭐ Daily challenge · {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
              <h3 className="mt-1 truncate font-display text-xl font-semibold">{daily.title}</h3>
              <p className="mt-0.5 text-sm text-white/85">{partMeta[daily.part].label} · {daily.questions.length} questions</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#d24b2a] shadow-sm transition group-hover:gap-2 group-hover:bg-white/95">
              Start →
            </span>
          </div>
        </button>

        {weakSpot && (
          <button
            onClick={() => open(weakSpot.topic)}
            className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left transition hover:bg-amber-50 active:scale-[0.99] dark:border-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                🎯 Focus on your weak spot · {weakSpot.label} ({weakSpot.avg.toFixed(1)})
              </p>
              <h3 className="mt-1 truncate font-display text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {weakSpot.topic.title}
              </h3>
              <p className="mt-0.5 text-xs text-[#6e6e73] dark:text-[#a1a1a6]">
                {partMeta[weakSpot.topic.part].label} · {weakSpot.tip}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-amber-700">
              Practise →
            </span>
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="glass-dark flex gap-1.5 rounded-xl p-1.5">
            {(["all", 1, 2, 3] as const).map((p) => {
              const count =
                p === "all"
                  ? topics.length
                  : topics.filter((t) => t.part === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    filter === p ? "bg-[#1d1d1f] text-white shadow-sm dark:bg-white dark:text-[#1d1d1f]" : "text-[#1d1d1f] hover:bg-black/5 dark:text-[#f5f5f7] dark:hover:bg-white/10"
                  }`}
                >
                  {p === "all" ? "All" : `Part ${p}`}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      filter === p ? "bg-white/20 text-white dark:bg-black/20 dark:text-[#1d1d1f]" : "bg-black/5 text-[#6e6e73] dark:bg-white/10 dark:text-[#a1a1a6]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics…"
              className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#ef5f3c] dark:border-white/15 dark:bg-white/5 dark:text-[#f5f5f7] dark:focus:border-[#ff7a52]"
            />
          </div>
        </div>

        {groups.length === 0 && (
          <p className="glass-dark rounded-2xl p-8 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
            No topics match “{search}”.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.part} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${partMeta[g.part].color}`} />
              <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-[#6e6e73] dark:text-[#a1a1a6]">
                {partMeta[g.part].label}
              </h2>
              <span className="text-xs font-medium text-[#86868b]">{g.items.length} topics</span>
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => open(t)}
                  className="group glass card-hover flex flex-col rounded-2xl p-5 text-left"
                >
                  <span className={`inline-block self-start rounded-full bg-gradient-to-r ${partMeta[t.part].color} px-3 py-1 text-[11px] font-semibold text-white shadow-sm`}>
                    {partMeta[t.part].label}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{t.title}</h3>
                  <p className="mt-1 text-xs text-[#86868b]">{t.questions.length} questions · {t.season}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#d24b2a] transition group-hover:gap-2 dark:text-[#ff9e7a]">
                    Practice <span aria-hidden>→</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const question = topic.questions[qIndex];
  return (
    <div className="space-y-4">
      <button onClick={() => setTopic(null)} className="text-sm font-medium text-[#d24b2a] transition hover:text-[#ef5f3c] dark:text-[#ff9e7a]">
        ← All topics
      </button>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <span className={`rounded-full bg-gradient-to-r ${partMeta[topic.part].color} px-3 py-1 text-[11px] font-semibold text-white`}>
            {partMeta[topic.part].label}
          </span>
          <span className="text-xs font-medium text-[#86868b]">{qIndex + 1}/{topic.questions.length}</span>
        </div>
        <p className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">{question}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => speak(question)} className="btn-chip rounded-full px-3 py-1.5 text-xs font-medium">
            🔊 Hear question
          </button>
          {topic.questions.length > 1 && (
            <button
              onClick={() => {
                setQIndex((i) => (i + 1) % topic.questions.length);
                setFeedback(null);
                setTranscript("");
                setError("");
                discard();
              }}
              className="btn-chip rounded-full px-3 py-1.5 text-xs font-medium"
            >
              Next question →
            </button>
          )}
        </div>

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
              {topic.part === 2 && (
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
                🎙️ Start speaking
              </button>
            </>
          ) : (
            <>
              <button
                onClick={stopAndScore}
                aria-label="Stop recording and score answer"
                className="animate-pulseRing flex items-center gap-2 rounded-full bg-[#ff3b30] px-6 py-2.5 font-medium text-white shadow-sm"
              >
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                {topic.part === 2
                  ? `${fmt(Math.max(0, LONG_TURN_SECONDS - rec.seconds))} left · Stop`
                  : `${fmt(rec.seconds)} · Stop & score`}
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
              Transcribing & coaching…
            </span>
          )}
        </div>

        {topic.part === 2 && !rec.listening && prepLeft === null && !feedback && (
          <p className="mt-2 text-xs text-[#86868b]">
            Part 2 tip: take 1 minute to prepare, then speak for 1–2 minutes.
          </p>
        )}

        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{rec.error}</p>}
        {audioUrl && (
          <div className="mt-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">🎧 Replay your answer</p>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
        {transcript && (
          <p className="mt-4 rounded-xl bg-[#f5f5f7] p-3 text-sm text-[#1d1d1f] dark:bg-white/5 dark:text-[#f5f5f7]">
            <span className="font-semibold text-[#86868b]">You said: </span>{transcript}
          </p>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
      {paywall && <UpgradeCard title="You're out of free practices" message={paywall} />}
      {feedback && <FeedbackCard feedback={feedback} transcript={transcript} durationSec={durationSec} />}
    </div>
  );
}
