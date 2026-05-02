import { useSyncExternalStore } from "react";

const STORAGE_KEY = "priority-os.active-project-id";

function readInitial(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

let value = readInitial();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return value;
}

function getServerSnapshot() {
  return "";
}

export function setActiveProjectId(id: string) {
  if (id === value) return;
  value = id;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function useActiveProjectId(): [string, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [id, setActiveProjectId];
}
