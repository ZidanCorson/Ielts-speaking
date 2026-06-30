import { useState } from "react";
import { Practice } from "./views/Practice";
import { MockTest } from "./views/MockTest";
import { History } from "./views/History";
import { Login } from "./views/Login";
import { VoiceSelector } from "./components/VoiceSelector";
import { useAuth } from "./auth/AuthContext";

type Tab = "practice" | "mock" | "history";

export default function App() {
  const { student, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("practice");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "practice", label: "Practice", icon: "🎙️" },
    { id: "mock", label: "Mock Test", icon: "🏆" },
    { id: "history", label: "Progress", icon: "📈" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-3xl shadow-xl shadow-indigo-900/40">
          🗣️
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
          IELTS Speaking Coach
        </h1>
        <p className="mt-2 text-sm text-indigo-200/80">
          Speak. Get instant AI band scores. Track your progress.
        </p>
        {student && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-indigo-100">
            <span>Hi, {student.name}</span>
            <VoiceSelector />
            <button onClick={signOut} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
              Sign out
            </button>
          </div>
        )}
      </header>

      {!student ? (
        <Login />
      ) : (
        <>
          <nav className="mx-auto mb-8 flex w-full max-w-md gap-1 rounded-2xl border border-white/10 bg-white/10 p-1.5 backdrop-blur">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-white text-slate-900 shadow"
                    : "text-indigo-100 hover:bg-white/10"
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="animate-fadeUp">
            {tab === "practice" && <Practice />}
            {tab === "mock" && <MockTest />}
            {tab === "history" && <History />}
          </div>
        </>
      )}
    </div>
  );
}
