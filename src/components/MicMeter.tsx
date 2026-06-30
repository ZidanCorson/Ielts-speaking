// Live microphone level bar — reassures the user the mic is picking them up.
export function MicMeter({ level }: { level: number }) {
  const bars = 5;
  const active = Math.round(Math.min(1, Math.max(0, level)) * bars);
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${
            i < active ? "bg-[#f59e0b]" : "bg-black/15 dark:bg-white/20"
          }`}
          style={{ height: `${6 + i * 4}px` }}
        />
      ))}
    </span>
  );
}
