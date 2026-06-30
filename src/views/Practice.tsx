import { useMemo, useState } from "react";
import type { Feedback, IeltsPart, Topic } from "../types";
import { topics } from "../topics";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { scoreAnswer } from "../services/api";
import { speak } from "../services/speech";
import { FeedbackCard } from "../components/FeedbackCard";

const partMeta: Record<IeltsPart, { label: string; color: string }> = {
  1: { label: "Part 1 · Interview", color: "from-sky-500 to-indigo-500" },
  2: { label: "Part 2 · Cue Card", color: "from-violet-500 to-fuchsia-500" },
  3: { label: "Part 3 · Discussion", color: "from-emerald-500 to-teal-500" },
};

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rec = useAudioRecorder();

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

  function open(t: Topic) {
    setTopic(t);
    setQIndex(0);
    setFeedback(null);
    setTranscript("");
  }

  async function stopAndScore() {
    if (!topic) return;
    const blob = await rec.stop();
    if (!blob) {
      setError("No audio captured. Please try again.");
      return;
    }
    setLoading(true);
    setError("");
    setFeedback(null);
    try {
      const r = await scoreAnswer({
        question: topic.questions[qIndex],
        topicTitle: topic.title,
        mode: "practice",
        part: topic.part,
        audio: blob,
      });
      setTranscript(r.transcript);
      setFeedback(r.feedback);
      speak(r.feedback.encouragement);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!topic) {
    return (
      <div className="space-y-6">
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
              className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0071e3] dark:border-white/15 dark:bg-white/5 dark:text-[#f5f5f7] dark:focus:border-[#2997ff]"
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
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#0071e3] transition group-hover:gap-2 dark:text-[#2997ff]">
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
      <button onClick={() => setTopic(null)} className="text-sm font-medium text-[#0071e3] transition hover:text-[#0077ed] dark:text-[#2997ff]">
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
              }}
              className="btn-chip rounded-full px-3 py-1.5 text-xs font-medium"
            >
              Next question →
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          {!rec.listening ? (
            <button onClick={rec.start} className="btn-primary rounded-full px-6 py-2.5 font-medium">
              🎙️ Start speaking
            </button>
          ) : (
            <button onClick={stopAndScore} className="animate-pulseRing flex items-center gap-2 rounded-full bg-[#ff3b30] px-6 py-2.5 font-medium text-white shadow-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> {fmt(rec.seconds)} · Stop & score
            </button>
          )}
          {loading && (
            <span className="flex items-center gap-2 text-sm font-medium text-[#0071e3] dark:text-[#2997ff]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0071e3]/30 border-t-[#0071e3] dark:border-[#2997ff]/30 dark:border-t-[#2997ff]" />
              Transcribing & coaching…
            </span>
          )}
        </div>

        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{rec.error}</p>}
        {transcript && (
          <p className="mt-4 rounded-xl bg-[#f5f5f7] p-3 text-sm text-[#1d1d1f] dark:bg-white/5 dark:text-[#f5f5f7]">
            <span className="font-semibold text-[#86868b]">You said: </span>{transcript}
          </p>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
      {feedback && <FeedbackCard feedback={feedback} />}
    </div>
  );
}
