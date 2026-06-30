import { useState } from "react";
import { useSubscription } from "../billing/SubscriptionContext";

/**
 * Paywall card shown when a free user hits the practice limit or opens a
 * Pro-only feature. Sends them to Stripe Checkout for the £9.99/mo plan.
 */
export function UpgradeCard({
  title = "Unlock IELTS Coach Pro",
  message,
}: {
  title?: string;
  message?: string;
}) {
  const { sub, upgrade } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      await upgrade();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(false);
    }
  }

  const price = sub?.priceLabel ?? "£9.99 / month";

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8a4c] to-[#f43f5e] p-6 text-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">✨ Pro plan</p>
          <h3 className="mt-1 font-display text-2xl font-semibold">{title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur">
          {price}
        </span>
      </div>
      {message && <p className="mt-2 text-sm text-white/90">{message}</p>}
      <ul className="mt-4 space-y-1.5 text-sm text-white/90">
        <li>✓ Unlimited practice answers</li>
        <li>✓ Full mock tests with band scores</li>
        <li>✓ Vocabulary booster &amp; progress trends</li>
      </ul>
      <button
        onClick={go}
        disabled={busy}
        className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#d24b2a] shadow-sm transition hover:bg-white/95 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Redirecting to checkout…" : `Subscribe — ${price}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/70">
        Secure payment by Stripe · cancel anytime
      </p>
      {error && <p className="mt-2 text-center text-sm text-amber-100">{error}</p>}
    </div>
  );
}
