import { useState } from "react";
import { login, register } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res =
        mode === "login"
          ? await login(email, password)
          : await register(name, email, password);
      signIn(res.student, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-scaleIn">
      <div className="glass rounded-3xl p-7">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/5">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === m
                  ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-white/15 dark:text-[#f5f5f7]"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-[#f5f5f7]"
              }`}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <h2 className="font-display text-3xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          {mode === "login" ? "Welcome back 👋" : "Create your account"}
        </h2>
        <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#a1a1a6]">
          Track your bands and progress across every session.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" && (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🧑</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0071e3] dark:border-white/15 dark:bg-white/5 dark:text-[#f5f5f7] dark:focus:border-[#2997ff]"
              />
            </div>
          )}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">✉️</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0071e3] dark:border-white/15 dark:bg-white/5 dark:text-[#f5f5f7] dark:focus:border-[#2997ff]"
            />
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0071e3] dark:border-white/15 dark:bg-white/5 dark:text-[#f5f5f7] dark:focus:border-[#2997ff]"
            />
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          <button
            disabled={busy}
            className="btn-primary w-full rounded-full py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-sm text-[#0071e3] transition hover:underline dark:text-[#2997ff]"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
