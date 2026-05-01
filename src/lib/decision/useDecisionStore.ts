import { useCallback, useEffect, useMemo, useState } from "react";
import type { Context, DecisionState, Item } from "@/lib/decision/types";
import { loadState, newId, saveState, snapshotItem } from "@/lib/decision/storage";

export function useDecisionStore() {
  const [state, setState] = useState<DecisionState>(() => loadState());

  useEffect(() => { saveState(state); }, [state]);

  const activeContext: Context = useMemo(
    () => state.contexts.find(c => c.id === state.activeContextId) ?? state.contexts[0],
    [state.contexts, state.activeContextId],
  );

  const setActiveContext = useCallback((id: string) => {
    setState(s => ({ ...s, activeContextId: id }));
  }, []);

  const addContext = useCallback((name: string) => {
    const id = newId();
    setState(s => ({ ...s, contexts: [...s.contexts, { id, name, items: [] }], activeContextId: id }));
  }, []);

  const upsertItem = useCallback((draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string }) => {
    setState(s => {
      const ctxs = s.contexts.map(c => {
        if (c.id !== s.activeContextId) return c;
        const now = Date.now();
        const existing = draft.id ? c.items.find(i => i.id === draft.id) : undefined;
        if (existing) {
          const updated: Item = { ...existing, ...draft, id: existing.id, updatedAt: now };
          return { ...c, items: c.items.map(i => i.id === existing.id ? updated : i) };
        }
        const created: Item = { ...(draft as Omit<Item, "createdAt" | "updatedAt">), id: draft.id ?? newId(), createdAt: now, updatedAt: now };
        return { ...c, items: [...c.items, created] };
      });

      // History: append snapshot for the affected item
      const ctx = ctxs.find(c => c.id === s.activeContextId)!;
      const target = ctx.items.find(i => i.id === (draft.id ?? ctx.items[ctx.items.length - 1]?.id));
      const history = { ...s.history };
      if (target) {
        const list = history[target.id] ?? [];
        history[target.id] = [...list, { at: Date.now(), snapshot: snapshotItem(target) }].slice(-25);
      }
      return { ...s, contexts: ctxs, history };
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState(s => ({
      ...s,
      contexts: s.contexts.map(c =>
        c.id === s.activeContextId ? { ...c, items: c.items.filter(i => i.id !== id) } : c,
      ),
    }));
  }, []);

  const setItemStatus = useCallback((id: string, status: Item["status"], resolutionNote?: string) => {
    setState(s => ({
      ...s,
      contexts: s.contexts.map(c => ({
        ...c,
        items: c.items.map(i => {
          if (i.id !== id) return i;
          if (status === "active") {
            const { resolvedAt: _r, resolutionNote: _n, ...rest } = i;
            return { ...rest, status: "active", updatedAt: Date.now() } as Item;
          }
          return {
            ...i,
            status,
            resolvedAt: new Date().toISOString(),
            resolutionNote: resolutionNote ?? i.resolutionNote,
            updatedAt: Date.now(),
          };
        }),
      })),
    }));
  }, []);

  return { state, activeContext, setActiveContext, addContext, upsertItem, deleteItem, setItemStatus };
}
