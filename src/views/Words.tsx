import { useVocab } from "../vocab/VocabContext";

export function Words() {
  const { items, remove, clear } = useVocab();

  return (
    <div className="glass animate-fadeUp rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            Word bank
          </h3>
          <p className="text-sm text-[#6e6e73] dark:text-[#a1a1a6]">{items.length} saved phrases</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={clear}
            className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:bg-rose-50 hover:text-rose-600 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-[#f5f5f7] p-8 text-center text-[#86868b] dark:bg-white/5">
          <div className="text-3xl">📚</div>
          <p className="mt-2 text-sm">
            No saved phrases yet. After scoring an answer, tap <span className="font-semibold">☆ Save</span> on a
            useful phrase to build your word bank.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((v) => (
            <li
              key={v.phrase}
              className="card-hover flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{v.phrase}</p>
                <p className="mt-0.5 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">{v.meaning}</p>
                <p className="mt-1 text-xs text-[#86868b]">Saved {new Date(v.savedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => remove(v.phrase)}
                aria-label="Remove phrase"
                title="Remove phrase"
                className="shrink-0 rounded-full px-2 py-1 text-xs text-[#86868b] transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
