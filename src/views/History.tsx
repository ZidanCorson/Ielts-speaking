import { useEffect, useMemo, useState } from "react";
import { deleteSession, type HistoryRow } from "../services/api";
import { useHistory } from "../history/HistoryContext";
import { computeStreak } from "../services/streak";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 280;
  const h = 56;
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const span = Math.max(max - min, 0.5);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(239,95,60,0.30)" />
          <stop offset="100%" stopColor="rgba(239,95,60,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#ef5f3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 2} fill="#ef5f3c" />
      ))}
    </svg>
  );
}

const modeStyle: Record<string, string> = {
  mock: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  practice: "bg-[#fdeee8] text-[#d24b2a] dark:bg-[#ef5f3c]/20 dark:text-[#ff9e7a]",
};

type PartFilter = "all" | 1 | 2 | 3;

// Per-criterion labels shown in the band breakdown and CSV export.
const criteria = [
  { key: "fluency", label: "Fluency" },
  { key: "lexical", label: "Lexical" },
  { key: "grammar", label: "Grammar" },
  { key: "pronunciation", label: "Pronunciation" },
] as const;

const TARGET_KEY = "ielts_target_band";
const BAND_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const critColors: Record<string, string> = {
  fluency: "#ef5f3c",
  lexical: "#9333ea",
  grammar: "#0d9488",
  pronunciation: "#ea580c",
};

// Local YYYY-MM-DD key for grouping sessions by calendar day (streak math).
// Milestone badges derived from session history + current streak.
function computeAchievements(rows: HistoryRow[], streak: number) {
  const overalls = rows.map((r) => Number(r.overall));
  const best = overalls.length ? Math.max(...overalls) : 0;
  const parts = new Set(rows.map((r) => r.part).filter(Boolean));
  const didMock = rows.some((r) => r.mode === "mock");
  return [
    { icon: "🌱", label: "First answer", unlocked: rows.length >= 1 },
    { icon: "🔥", label: "3-day streak", unlocked: streak >= 3 },
    { icon: "⚡", label: "7-day streak", unlocked: streak >= 7 },
    { icon: "🎯", label: "10 sessions", unlocked: rows.length >= 10 },
    { icon: "🧩", label: "All 3 parts", unlocked: parts.size >= 3 },
    { icon: "📝", label: "Mock test", unlocked: didMock },
    { icon: "⭐", label: "Band 6.5+", unlocked: best >= 6.5 },
    { icon: "🏆", label: "Band 7+", unlocked: best >= 7 },
    { icon: "👑", label: "Band 8+", unlocked: best >= 8 },
  ];
}

// Compact per-criterion trend line (no fill), tinted to the criterion colour.
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const span = Math.max(max - min, 0.5);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 2.5 : 0} fill={color} />
      ))}
    </svg>
  );
}

// Four-axis skill radar (0–9) for a single session's criteria.
function Radar({ scores }: { scores: { label: string; value: number }[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const R = 64;
  const max = 9;
  const angle = (i: number) => (Math.PI * 2 * i) / scores.length - Math.PI / 2;
  const at = (val: number, i: number, radius = R) => {
    const r = (Math.max(0, Math.min(max, val)) / max) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const poly = scores
    .map((s, i) => at(s.value, i).map((n) => n.toFixed(1)).join(","))
    .join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-48 w-48">
      {[3, 6, 9].map((ring) => (
        <polygon
          key={ring}
          points={scores.map((_, i) => at(ring, i).map((n) => n.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          className="text-[#1d1d1f] dark:text-white"
        />
      ))}
      {scores.map((_, i) => {
        const [x, y] = at(9, i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.1"
            className="text-[#1d1d1f] dark:text-white"
          />
        );
      })}
      <polygon points={poly} fill="rgba(239,95,60,0.18)" stroke="#ef5f3c" strokeWidth="2" />
      {scores.map((s, i) => {
        const [x, y] = at(s.value, i);
        return <circle key={i} cx={x} cy={y} r="3" fill="#ef5f3c" />;
      })}
      {scores.map((s, i) => {
        const [x, y] = at(11, i, R + 22);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[#86868b] text-[9px] font-medium"
          >
            {s.label} {s.value.toFixed(1)}
          </text>
        );
      })}
    </svg>
  );
}

// Build and download a CSV of the visible sessions — handy for tracking offline.
function exportCsv(rows: HistoryRow[]) {
  const header = [
    "Date",
    "Mode",
    "Part",
    "Topic",
    "Question",
    "Fluency",
    "Lexical",
    "Grammar",
    "Pronunciation",
    "Overall",
    "WordsPerMin",
    "FillersPerMin",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.mode,
      r.part ?? "",
      r.topic_title,
      r.question,
      r.fluency,
      r.lexical,
      r.grammar,
      r.pronunciation,
      r.overall,
      r.wpm ?? "",
      r.filler_per_min ?? "",
    ]
      .map(esc)
      .join(",")
  );
  const csv = [header.map(esc).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ielts-progress-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function History() {
  const { rows, loading, error: loadError, setRows } = useHistory();
  const [error, setError] = useState("");
  const [partFilter, setPartFilter] = useState<PartFilter>("all");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(() => {
    const v = Number(localStorage.getItem(TARGET_KEY));
    return v >= 5 && v <= 9 ? v : 7;
  });

  useEffect(() => {
    localStorage.setItem(TARGET_KEY, String(target));
  }, [target]);

  async function remove(id: number) {
    setDeleting(id);
    setError("");
    try {
      await deleteSession(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete session");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = useMemo(
    () => (partFilter === "all" ? rows : rows.filter((r) => r.part === partFilter)),
    [rows, partFilter]
  );

  const { streak, practicedToday } = useMemo(() => computeStreak(rows), [rows]);
  const achievements = useMemo(() => computeAchievements(rows, streak), [rows, streak]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const nums = filtered.map((r) => Number(r.overall));
    const paceVals = [...filtered]
      .reverse()
      .map((r) => (r.wpm == null ? null : Number(r.wpm)))
      .filter((v): v is number => v != null && v > 0);
    const fillerVals = filtered
      .map((r) => (r.filler_per_min == null ? null : Number(r.filler_per_min)))
      .filter((v): v is number => v != null);
    return {
      avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1),
      best: Math.max(...nums),
      // rows are newest-first; reverse for chronological left-to-right trend.
      trend: [...nums].reverse(),
      critTrends: criteria.map((c) => ({
        key: c.key,
        label: c.label,
        values: [...filtered].reverse().map((r) => Number(r[c.key])),
        latest: Number(filtered[0][c.key]),
      })),
      paceVals,
      avgWpm: paceVals.length ? Math.round(paceVals.reduce((a, b) => a + b, 0) / paceVals.length) : null,
      avgFiller: fillerVals.length ? +(fillerVals.reduce((a, b) => a + b, 0) / fillerVals.length).toFixed(1) : null,
    };
  }, [filtered]);

  return (
    <div className="glass animate-fadeUp rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">Your progress</h3>
          <p className="text-sm text-[#6e6e73] dark:text-[#a1a1a6]">{filtered.length} sessions</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl bg-[#fdeee8] px-3 py-2 text-center dark:bg-[#ef5f3c]/20">
            <div className="text-lg font-semibold text-[#d24b2a] dark:text-[#ff9e7a]">{stats?.avg ?? "—"}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#d24b2a]/60 dark:text-[#ff9e7a]/70">Avg</div>
          </div>
          <div className="rounded-xl bg-[#eafaf0] px-3 py-2 text-center dark:bg-emerald-500/15">
            <div className="text-lg font-semibold text-[#1d8a4e] dark:text-emerald-400">{stats ? stats.best.toFixed(1) : "—"}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#1d8a4e]/60 dark:text-emerald-400/70">Best</div>
          </div>
        </div>
      </div>

      {/* Streak (engagement loop) + personal target band with progress */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-[#fff4e5] to-[#ffe9d6] p-4 dark:from-amber-500/15 dark:to-orange-500/10">
          <div className="text-3xl">{streak > 0 ? "🔥" : "💤"}</div>
          <div>
            <div className="text-2xl font-bold text-[#b25b00] dark:text-amber-300">
              {streak} day{streak === 1 ? "" : "s"}
            </div>
            <div className="text-xs font-medium text-[#86868b]">
              {practicedToday
                ? "Practiced today — keep it up!"
                : streak > 0
                ? "Practice today to keep your streak"
                : "Practice today to start a streak"}
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[#f5f5f7] p-4 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868b]">Target band</span>
            <select
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              aria-label="Set your target band"
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-[#1d1d1f] outline-none dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              {BAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b.toFixed(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff8a4c] to-[#f43f5e] transition-all"
              style={{ width: `${stats ? Math.min(100, (stats.best / target) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-[#86868b]">
            {stats
              ? `Best ${stats.best.toFixed(1)} of ${target.toFixed(1)}${stats.best >= target ? " · 🎉 reached!" : ""}`
              : "No sessions yet"}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="glass-dark flex gap-1 rounded-xl p-1">
          {(["all", 1, 2, 3] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPartFilter(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                partFilter === p
                  ? "bg-[#1d1d1f] text-white shadow-sm dark:bg-white dark:text-[#1d1d1f]"
                  : "text-[#1d1d1f] hover:bg-black/5 dark:text-[#f5f5f7] dark:hover:bg-white/10"
              }`}
            >
              {p === "all" ? "All" : `Part ${p}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportCsv(filtered)}
          disabled={!filtered.length}
          className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:bg-black/10 disabled:opacity-40 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {stats && stats.trend.length > 1 && (
        <div className="mb-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
          <p className="mb-1 text-xs font-medium text-[#86868b]">Band trend</p>
          <Sparkline values={stats.trend} />
        </div>
      )}

      {stats && stats.critTrends[0].values.length > 1 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.critTrends.map((c) => (
            <div key={c.key} className="rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-[#86868b]">{c.label}</span>
                <span className="text-xs font-semibold" style={{ color: critColors[c.key] }}>
                  {c.latest.toFixed(1)}
                </span>
              </div>
              <MiniSparkline values={c.values} color={critColors[c.key]} />
            </div>
          ))}
        </div>
      )}

      {stats && (stats.avgWpm != null || stats.avgFiller != null) && (
        <div className="mb-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-[#86868b]">🎙️ Speaking pace</p>
            <div className="flex gap-3 text-xs">
              {stats.avgWpm != null && (
                <span className="font-semibold text-[#d24b2a] dark:text-[#ff9e7a]">~{stats.avgWpm} wpm avg</span>
              )}
              {stats.avgFiller != null && (
                <span className="font-semibold text-[#ea580c]">{stats.avgFiller}/min fillers</span>
              )}
            </div>
          </div>
          {stats.paceVals.length > 1 && <MiniSparkline values={stats.paceVals} color="#ef5f3c" />}
        </div>
      )}

      {stats && (
        <div className="mb-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
          <p className="mb-1 text-xs font-medium text-[#86868b]">Latest session · skill radar</p>
          <Radar
            scores={criteria.map((c) => ({
              label: c.label,
              value: Number(filtered[0][c.key]),
            }))}
          />
        </div>
      )}

      <div className="mb-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
        <p className="mb-2 text-xs font-medium text-[#86868b]">
          Achievements · {achievements.filter((a) => a.unlocked).length}/{achievements.length}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {achievements.map((a) => (
            <div
              key={a.label}
              title={a.label}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition ${
                a.unlocked ? "bg-white shadow-sm dark:bg-white/10" : "opacity-40 grayscale"
              }`}
            >
              <span className="text-xl">{a.icon}</span>
              <span className="text-[9px] font-medium leading-tight text-[#6e6e73] dark:text-[#a1a1a6]">
                {a.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="relative h-20 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
              <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </li>
          ))}
        </ul>
      )}
      {(error || loadError) && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error || loadError}</p>}

      {!loading && (
        <ul className="space-y-3">
          {filtered.map((h) => (
            <li key={h.id} className="card-hover rounded-xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${modeStyle[h.mode] ?? "bg-black/5 text-[#6e6e73] dark:bg-white/10 dark:text-[#a1a1a6]"}`}>
                  {h.topic_title} · {h.mode}{h.part ? ` · Part ${h.part}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[#ef5f3c] px-3 py-1 text-xs font-semibold text-white">
                    Band {h.overall}
                  </span>
                  <button
                    onClick={() => remove(h.id)}
                    disabled={deleting === h.id}
                    aria-label="Delete this session"
                    title="Delete session"
                    className="rounded-full px-2 py-1 text-xs text-[#86868b] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                  >
                    {deleting === h.id ? "…" : "🗑️"}
                  </button>
                </span>
              </div>
              <p className="mt-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">{h.question}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {criteria.map((c) => (
                  <div
                    key={c.key}
                    className="rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-center dark:bg-white/5"
                  >
                    <div className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {Number(h[c.key]).toFixed(1)}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[#86868b]">
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#86868b]">{new Date(h.created_at).toLocaleString()}</p>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="rounded-xl bg-[#f5f5f7] p-8 text-center text-[#86868b] dark:bg-white/5">
              <div className="text-3xl">🎯</div>
              <p className="mt-2 text-sm">
                {rows.length === 0
                  ? "No sessions yet. Start practising!"
                  : "No sessions for this part yet."}
              </p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
