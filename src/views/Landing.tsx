import { useRef, useState } from "react";
import { Login } from "./Login";

type AuthMode = "login" | "register";

const features = [
  {
    icon: "🤖",
    title: "Instant AI band scores",
    text: "Speak your answer and get scored on all four IELTS criteria — fluency, lexical resource, grammar and pronunciation — in seconds.",
  },
  {
    icon: "✨",
    title: "Your answer, upgraded",
    text: "See a band-8 rewrite of your own answer, so you learn exactly how to say it better next time.",
  },
  {
    icon: "📚",
    title: "Vocabulary booster",
    text: "Collect high-band collocations and idioms from every answer into a personal word bank.",
  },
  {
    icon: "🎙️",
    title: "Real exam practice",
    text: "Part 1, 2 and 3 questions with prep timers and a full mock test that estimates your overall band.",
  },
  {
    icon: "📈",
    title: "Track your progress",
    text: "Band trends, a speaking-pace tracker, streaks and a radar of your strengths keep you improving.",
  },
  {
    icon: "🎯",
    title: "Focus on weak spots",
    text: "Smart recommendations point you to the exact part and topic that will lift your score fastest.",
  },
];

const steps = [
  { n: "1", title: "Create a free account", text: "Sign up in seconds — no card required." },
  { n: "2", title: "Pick a topic & speak", text: "Choose a seasonal question and record your answer." },
  { n: "3", title: "Get scored & improve", text: "Instant feedback, model answers and progress tracking." },
];

export function Landing() {
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const authRef = useRef<HTMLDivElement | null>(null);

  function goAuth(mode: AuthMode) {
    setAuthMode(mode);
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ef5f3c]/10 px-4 py-1.5 text-xs font-semibold text-[#d24b2a] dark:bg-[#ff7a52]/15 dark:text-[#ff9e7a]">
          ⭐ 5 free sessions · no card needed
        </span>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] sm:text-5xl">
          Get a higher IELTS speaking band — with your own AI examiner
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[#6e6e73] dark:text-[#a1a1a6]">
          Practise out loud, get instant band scores on all four criteria, and learn
          exactly how to improve. Your first 5 sessions are on us.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => goAuth("register")}
            className="btn-primary rounded-full px-7 py-3 text-base font-semibold"
          >
            Start practising free →
          </button>
          <button
            onClick={() => goAuth("login")}
            className="rounded-full bg-black/5 px-7 py-3 text-base font-semibold text-[#1d1d1f] transition hover:bg-black/10 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20"
          >
            I already have an account
          </button>
        </div>
        <p className="mt-4 text-xs text-[#86868b]">
          ✓ Instant scoring · ✓ Model answers · ✓ Progress tracking
        </p>
      </section>

      {/* Features */}
      <section>
        <h3 className="text-center font-display text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          Everything you need to speak with confidence
        </h3>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass card-hover rounded-2xl p-6 text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-2xl dark:bg-white/10">
                {f.icon}
              </div>
              <h4 className="mt-4 font-display text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {f.title}
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6e6e73] dark:text-[#a1a1a6]">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <h3 className="text-center font-display text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          How it works
        </h3>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass rounded-2xl p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ef5f3c] text-lg font-semibold text-white">
                {s.n}
              </div>
              <h4 className="mt-4 font-display text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{s.title}</h4>
              <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h3 className="text-center font-display text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          Simple pricing
        </h3>
        <p className="mt-2 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
          Start free. Upgrade only when you're ready for more.
        </p>
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Free */}
          <div className="glass rounded-2xl p-6">
            <h4 className="font-display text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Free</h4>
            <p className="mt-1 text-3xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              £0<span className="text-base font-normal text-[#86868b]"> / month</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
              <li>✓ 5 practice sessions / month</li>
              <li>✓ Instant AI band scores</li>
              <li>✓ Model answers &amp; vocabulary</li>
              <li>✓ Progress tracking</li>
            </ul>
            <button
              onClick={() => goAuth("register")}
              className="mt-6 w-full rounded-full bg-black/5 py-2.5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-black/10 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20"
            >
              Start free
            </button>
          </div>
          {/* Pro */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8a4c] to-[#f43f5e] p-6 text-white shadow-sm">
            <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
              Most popular
            </span>
            <h4 className="font-display text-lg font-semibold">Pro</h4>
            <p className="mt-1 text-3xl font-semibold">
              £9.99<span className="text-base font-normal text-white/80"> / month</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/90">
              <li>✓ Unlimited practice sessions</li>
              <li>✓ Full mock tests with band estimate</li>
              <li>✓ Everything in Free</li>
              <li>✓ Cancel anytime</li>
            </ul>
            <button
              onClick={() => goAuth("register")}
              className="mt-6 w-full rounded-full bg-white py-2.5 text-sm font-semibold text-[#d24b2a] transition hover:bg-white/95"
            >
              Get started
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-[#86868b]">Secure payment by Stripe · cancel anytime</p>
      </section>

      {/* Auth / sign up */}
      <section ref={authRef} className="scroll-mt-8">
        <h3 className="text-center font-display text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          {authMode === "register" ? "Create your free account" : "Welcome back"}
        </h3>
        <p className="mt-2 text-center text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
          {authMode === "register"
            ? "Sign up and start your first 5 sessions free."
            : "Sign in to keep practising."}
        </p>
        <div className="mt-6">
          <Login mode={authMode} onModeChange={setAuthMode} />
        </div>
      </section>
    </div>
  );
}
