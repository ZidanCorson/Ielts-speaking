import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { fetchHistory, type HistoryRow } from "../services/api";
import { useAuth } from "../auth/AuthContext";

interface HistoryState {
  rows: HistoryRow[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  setRows: Dispatch<SetStateAction<HistoryRow[]>>;
}

const Ctx = createContext<HistoryState>({
  rows: [],
  loading: false,
  error: "",
  refresh: async () => {},
  setRows: () => {},
});

// Shared session history so the global header (streak) and the Progress view
// read one source of truth, and a new session refreshes both at once.
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { student } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!student) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRows(await fetchHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }, [student]);

  // Load (or clear) history whenever the signed-in user changes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ rows, loading, error, refresh, setRows }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHistory() {
  return useContext(Ctx);
}
