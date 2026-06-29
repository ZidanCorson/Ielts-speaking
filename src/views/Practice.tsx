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
          <div className="flex gap-1.5 rounded-xl border border-white/10 bg-white/10 p-1.5 backdrop-blur">
            {(["all", 1, 2, 3] as const).map((p) => {
              const count =
                p === "all"
                  ? topics.length
                  : topics.filter((t) => t.part === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    filter === p ? "bg-white text-slate-900 shadow" : "text-indigo-100 hover:bg-white/10"
                  }`}
                >
                  {p === "all" ? "All" : `Part ${p}`}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      filter === p ? "bg-slate-900/10 text-slate-600" : "bg-white/10 text-indigo-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics…"
              className="w-full rounded-xl border border-white/20 bg-white/90 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {groups.length === 0 && (
          <p className="rounded-2xl border border-white/30 bg-white/10 p-8 text-center text-sm text-indigo-100">
            No topics match “{search}”.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.part} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${partMeta[g.part].color}`} />
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-indigo-100">
                {partMeta[g.part].label}
              </h2>
              <span className="text-xs font-medium text-indigo-300">{g.items.length} topics</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => open(t)}
                  className="group glass flex flex-col rounded-2xl border border-white/40 p-5 text-left shadow-lg shadow-indigo-900/10 transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <span className={`inline-block self-start rounded-full bg-gradient-to-r ${partMeta[t.part].color} px-3 py-1 text-[11px] font-semibold text-white`}>
                    {partMeta[t.part].label}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold text-slate-800">{t.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t.questions.length} questions · {t.season}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-indigo-600 group-hover:underline">Practice →</span>
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
      <button onClick={() => setTopic(null)} className="text-sm font-medium text-indigo-100 hover:text-white">
        ← All topics
      </button>

      <div className="glass rounded-2xl border border-white/40 p-6 shadow-xl shadow-indigo-900/20">
        <div className="flex items-center justify-between">
          <span className={`rounded-full bg-gradient-to-r ${partMeta[topic.part].color} px-3 py-1 text-[11px] font-semibold text-white`}>
            {partMeta[topic.part].label}
          </span>
          <span className="text-xs font-medium text-slate-400">{qIndex + 1}/{topic.questions.length}</span>
        </div>
        <p className="mt-3 text-xl font-semibold leading-snug text-slate-800">{question}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => speak(question)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200">
            🔊 Hear question
          </button>
          {topic.questions.length > 1 && (
            <button
              onClick={() => {
                setQIndex((i) => (i + 1) % topic.questions.length);
                setFeedback(null);
                setTranscript("");
              }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
            >
              Next question →
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          {!rec.listening ? (
            <button onClick={rec.start} className="rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110">
              🎙️ Start speaking
            </button>
          ) : (
            <button onClick={stopAndScore} className="animate-pulseRing flex items-center gap-2 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 px-5 py-2.5 font-semibold text-white shadow-lg">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> {fmt(rec.seconds)} · Stop & score
            </button>
          )}
          {loading && <span className="text-sm font-medium text-indigo-600">Transcribing & coaching…</span>}
        </div>

        {rec.error && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{rec.error}</p>}
        {transcript && (
          <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-500">You said: </span>{transcript}
          </p>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {feedback && <FeedbackCard feedback={feedback} />}
    </div>
  );
}
