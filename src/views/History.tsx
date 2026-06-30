import { useEffect, useMemo, useState } from "react";
import { fetchHistory, type HistoryRow } from "../services/api";

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
          <stop offset="0%" stopColor="rgba(0,113,227,0.30)" />
          <stop offset="100%" stopColor="rgba(0,113,227,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 2} fill="#0071e3" />
      ))}
    </svg>
  );
}

const modeStyle: Record<string, string> = {
  mock: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  practice: "bg-[#e8f1fd] text-[#0071e3] dark:bg-[#0071e3]/20 dark:text-[#2997ff]",
};

export function History() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const { avg, best, trend } = useMemo(() => {
    if (!rows.length) return { avg: "—", best: "—", trend: [] as number[] };
    const nums = rows.map((r) => Number(r.overall));
    return {
      avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1),
      best: Math.max(...nums).toFixed(1),
      // rows are newest-first; reverse for chronological left-to-right trend.
      trend: [...nums].reverse(),
    };
  }, [rows]);

  return (
    <div className="glass animate-fadeUp rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">Your progress</h3>
          <p className="text-sm text-[#6e6e73] dark:text-[#a1a1a6]">{rows.length} sessions</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl bg-[#e8f1fd] px-3 py-2 text-center dark:bg-[#0071e3]/20">
            <div className="text-lg font-semibold text-[#0071e3] dark:text-[#2997ff]">{avg}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#0071e3]/60 dark:text-[#2997ff]/70">Avg</div>
          </div>
          <div className="rounded-xl bg-[#eafaf0] px-3 py-2 text-center dark:bg-emerald-500/15">
            <div className="text-lg font-semibold text-[#1d8a4e] dark:text-emerald-400">{best}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[#1d8a4e]/60 dark:text-emerald-400/70">Best</div>
          </div>
        </div>
      </div>

      {trend.length > 1 && (
        <div className="mb-4 rounded-xl bg-[#f5f5f7] p-3 dark:bg-white/5">
          <p className="mb-1 text-xs font-medium text-[#86868b]">Band trend</p>
          <Sparkline values={trend} />
        </div>
      )}

      {loading && (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="relative h-20 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
              <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      {!loading && (
        <ul className="space-y-3">
          {rows.map((h) => (
            <li key={h.id} className="card-hover rounded-xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${modeStyle[h.mode] ?? "bg-black/5 text-[#6e6e73] dark:bg-white/10 dark:text-[#a1a1a6]"}`}>
                  {h.topic_title} · {h.mode}
                </span>
                <span className="rounded-full bg-[#0071e3] px-3 py-1 text-xs font-semibold text-white">
                  Band {h.overall}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">{h.question}</p>
              <p className="mt-1 text-xs text-[#86868b]">{new Date(h.created_at).toLocaleString()}</p>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="rounded-xl bg-[#f5f5f7] p-8 text-center text-[#86868b] dark:bg-white/5">
              <div className="text-3xl">🎯</div>
              <p className="mt-2 text-sm">No sessions yet. Start practising!</p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
