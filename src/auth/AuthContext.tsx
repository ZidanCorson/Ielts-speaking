import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { clearToken, getToken, setToken, type Student } from "../services/api";

interface AuthState {
  student: Student | null;
  signIn: (student: Student, token: string) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthState>({
  student: null,
  signIn: () => {},
  signOut: () => {},
});

const STUDENT_KEY = "ielts_student";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STUDENT_KEY);
    if (raw && getToken()) setStudent(JSON.parse(raw));
  }, []);

  function signIn(s: Student, token: string) {
    setToken(token);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
    setStudent(s);
  }
  function signOut() {
    clearToken();
    localStorage.removeItem(STUDENT_KEY);
    setStudent(null);
  }

  return <Ctx.Provider value={{ student, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
