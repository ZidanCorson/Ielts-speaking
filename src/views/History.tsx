import { useEffect, useState } from "react";
import { fetchHistory, type HistoryRow } from "../services/api";

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

  const avg = rows.length
    ? (rows.reduce((a, r) => a + Number(r.overall), 0) / rows.length).toFixed(1)
    : "—";

  return (
    <div className="glass rounded-2xl border border-white/40 p-6 shadow-lg backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Your progress</h3>
          <p className="text-sm text-slate-500">{rows.length} sessions · avg band {avg}</p>
        </div>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <ul className="space-y-3">
        {rows.map((h) => (
          <li key={h.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {h.topic_title} · {h.mode}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Band {h.overall}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{h.question}</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
          </li>
        ))}
        {!loading && rows.length === 0 && (
          <li className="rounded-xl bg-slate-50 p-8 text-center text-slate-400">No sessions yet. Start practising!</li>
        )}
      </ul>
    </div>
  );
}
