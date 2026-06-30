import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface VocabItem {
  phrase: string;
  meaning: string;
  savedAt: number;
}

interface VocabState {
  items: VocabItem[];
  has: (phrase: string) => boolean;
  add: (phrase: string, meaning: string) => void;
  remove: (phrase: string) => void;
  clear: () => void;
}

const Ctx = createContext<VocabState>({
  items: [],
  has: () => false,
  add: () => {},
  remove: () => {},
  clear: () => {},
});

const KEY = "ielts_vocab";

// Personal word bank persisted to localStorage (free, no backend needed).
export function VocabProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<VocabItem[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as VocabItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const norm = (p: string) => p.trim().toLowerCase();
  const has = (phrase: string) => items.some((i) => norm(i.phrase) === norm(phrase));
  const add = (phrase: string, meaning: string) =>
    setItems((prev) =>
      prev.some((i) => norm(i.phrase) === norm(phrase))
        ? prev
        : [{ phrase: phrase.trim(), meaning: meaning.trim(), savedAt: Date.now() }, ...prev]
    );
  const remove = (phrase: string) =>
    setItems((prev) => prev.filter((i) => norm(i.phrase) !== norm(phrase)));
  const clear = () => setItems([]);

  return <Ctx.Provider value={{ items, has, add, remove, clear }}>{children}</Ctx.Provider>;
}

export function useVocab() {
  return useContext(Ctx);
}
