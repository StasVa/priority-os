import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "priority-os.theme";

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveEffective(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
}

function applyClass(effective: "light" | "dark") {
  const root = document.documentElement;
  if (effective === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored());

  // Apply on mode change + listen to system changes when in "system".
  useEffect(() => {
    applyClass(resolveEffective(mode));
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyClass(resolveEffective("system"));
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
