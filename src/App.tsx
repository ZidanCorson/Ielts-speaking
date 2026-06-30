import { useState } from "react";
import { Practice } from "./views/Practice";
import { MockTest } from "./views/MockTest";
import { History } from "./views/History";
import { Words } from "./views/Words";
import { Landing } from "./views/Landing";
import { VoiceSelector } from "./components/VoiceSelector";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./theme/ThemeContext";
import { useHistory } from "./history/HistoryContext";
import { useVocab } from "./vocab/VocabContext";
import { useSubscription } from "./billing/SubscriptionContext";
import { computeStreak } from "./services/streak";

type Tab = "practice" | "mock" | "history" | "words";

export default function App() {
  const { student, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { rows } = useHistory();
  const { items: vocab } = useVocab();
  const { sub, upgrade } = useSubscription();
  const { streak, practicedToday } = computeStreak(rows);
  const [tab, setTab] = useState<Tab>("practice");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "practice", label: "Practice", icon: "🎙️" },
    { id: "mock", label: "Mock Test", icon: "🏆" },
    { id: "history", label: "Progress", icon: "📈" },
    { id: "words", label: "Words", icon: "📚" },
  ];

  const isPro = sub?.subscribed ?? false;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10">
      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className="glass-dark fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full text-lg transition hover:scale-105 active:scale-95"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <header className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-white text-3xl shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
          🗣️
        </div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          IELTS Speaking Coach
        </h1>
        <p className="mt-3 text-lg font-normal text-[#6e6e73] dark:text-[#a1a1a6]">
          Speak. Get instant AI band scores. Track your progress.
        </p>
        {student && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
            <span className="glass-dark rounded-full px-3 py-1.5 font-medium">
              👋 Hi, {student.name}
            </span>
            {streak > 0 && (
              <span
                title={practicedToday ? "Practiced today — keep it up!" : "Practice today to keep your streak"}
                className={`rounded-full px-3 py-1.5 font-semibold ${
                  practicedToday
                    ? "bg-[#ff9f0a]/15 text-[#b25b00] dark:text-amber-300"
                    : "bg-black/5 text-[#86868b] dark:bg-white/10 dark:text-[#a1a1a6]"
                }`}
              >
                🔥 {streak} day{streak === 1 ? "" : "s"}
              </span>
            )}
            {sub &&
              (isPro ? (
                <span className="rounded-full bg-gradient-to-r from-[#ff8a4c] to-[#f43f5e] px-3 py-1.5 font-semibold text-white">
                  ✨ Pro
                </span>
              ) : (
                <button
                  onClick={() => upgrade()}
                  title="Subscribe for unlimited practice and mock tests"
                  className="rounded-full bg-[#ef5f3c]/10 px-3 py-1.5 font-semibold text-[#d24b2a] transition hover:bg-[#ef5f3c]/15 dark:bg-[#ff7a52]/15 dark:text-[#ff9e7a] dark:hover:bg-[#ff7a52]/25"
                >
                  ✨ {sub.freeRemaining ?? 0}/{sub.freeLimit} free · Upgrade
                </button>
              ))}
            <VoiceSelector />
            <button
              onClick={signOut}
              className="rounded-full bg-black/5 px-3 py-1.5 font-medium text-[#1d1d1f] transition hover:bg-black/10 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {!student ? (
        <Landing />
      ) : (
        <>
          <nav className="glass-dark mx-auto mb-8 flex w-full max-w-md gap-1 rounded-2xl p-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-[#1d1d1f] text-white shadow-sm dark:bg-white dark:text-[#1d1d1f]"
                    : "text-[#1d1d1f] hover:bg-black/5 dark:text-[#f5f5f7] dark:hover:bg-white/10"
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
                {t.id === "mock" && !isPro && (
                  <span className="ml-1 text-[11px]" title="Pro feature">🔒</span>
                )}
                {t.id === "words" && vocab.length > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      tab === t.id
                        ? "bg-white/20 text-white dark:bg-black/20 dark:text-[#1d1d1f]"
                        : "bg-black/10 text-[#6e6e73] dark:bg-white/15 dark:text-[#a1a1a6]"
                    }`}
                  >
                    {vocab.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="animate-fadeUp">
            {tab === "practice" && <Practice />}
            {tab === "mock" && <MockTest />}
            {tab === "history" && <History />}
            {tab === "words" && <Words />}
          </div>
        </>
      )}
    </div>
  );
}
