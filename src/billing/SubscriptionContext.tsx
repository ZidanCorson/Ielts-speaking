import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchSubscription,
  startCheckout,
  openBillingPortal,
  type Subscription,
} from "../services/api";
import { useAuth } from "../auth/AuthContext";

interface SubState {
  sub: Subscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
  upgrade: () => Promise<void>;
  manage: () => Promise<void>;
}

const Ctx = createContext<SubState>({
  sub: null,
  loading: false,
  refresh: async () => {},
  upgrade: async () => {},
  manage: async () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { student } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!student) {
      setSub(null);
      return;
    }
    setLoading(true);
    try {
      setSub(await fetchSubscription());
    } catch {
      // Keep any previous value; quota errors still surface on scoring.
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Returning from Stripe Checkout: refresh status and tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout")) {
      refresh();
      params.delete("checkout");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [refresh]);

  const upgrade = useCallback(async () => {
    const url = await startCheckout();
    window.location.href = url;
  }, []);

  const manage = useCallback(async () => {
    const url = await openBillingPortal();
    window.location.href = url;
  }, []);

  return (
    <Ctx.Provider value={{ sub, loading, refresh, upgrade, manage }}>{children}</Ctx.Provider>
  );
}

export function useSubscription() {
  return useContext(Ctx);
}
