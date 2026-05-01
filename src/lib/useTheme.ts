import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "priority-os.theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readInitial(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark") return v;
  // First visit: seed from system preference, but don't persist —
  // any explicit user choice from now on will write to storage.
  return systemPrefersDark() ? "dark" : "light";
}

function applyClass(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => readInitial());

  useEffect(() => {
    applyClass(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
