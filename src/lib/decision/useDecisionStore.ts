import { useCallback, useEffect, useMemo, useState } from "react";
import type { DecisionState, Item, Project } from "@/lib/decision/types";
import { loadState, newId, saveState, snapshotItem } from "@/lib/decision/storage";

export function useDecisionStore() {
  const [state, setState] = useState<DecisionState>(() => loadState());

  useEffect(() => { saveState(state); }, [state]);

  const activeProject: Project = useMemo(
    () => state.projects.find(p => p.id === state.activeProjectId) ?? state.projects[0],
    [state.projects, state.activeProjectId],
  );

  const setActiveProject = useCallback((id: string) => {
    setState(s => ({
      ...s,
      activeProjectId: id,
      projects: s.projects.map(p =>
        p.id === id ? { ...p, lastAccessedAt: Date.now() } : p,
      ),
    }));
  }, []);

  const addProject = useCallback((name: string, opts?: Partial<Pick<Project, "emoji" | "description" | "color">>): string => {
    const id = newId();
    const now = Date.now();
    setState(s => ({
      ...s,
      projects: [
        ...s.projects,
        {
          id,
          name,
          items: [],
          isFavorite: false,
          lastAccessedAt: now,
          createdAt: now,
          visibility: "private",
          emoji: opts?.emoji,
          description: opts?.description,
          color: opts?.color,
        },
      ],
      activeProjectId: id,
    }));
    return id;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState(s => {
      const remaining = s.projects.filter(p => p.id !== id);
      const activeStillThere = remaining.some(p => p.id === s.activeProjectId);
      const nextActive = activeStillThere
        ? s.activeProjectId
        : ([...remaining].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)[0]?.id ?? "");
      return { ...s, projects: remaining, activeProjectId: nextActive };
    });
  }, []);

  const archiveProject = useCallback((id: string) => {
    setState(s => {
      const projects = s.projects.map(p =>
        p.id === id ? { ...p, archivedAt: new Date().toISOString() } : p,
      );
      let activeId = s.activeProjectId;
      if (activeId === id) {
        const next = projects
          .filter(p => p.id !== id && !p.archivedAt)
          .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)[0];
        activeId = next?.id ?? "";
      }
      return { ...s, projects, activeProjectId: activeId };
    });
  }, []);

  const restoreProject = useCallback((id: string) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p =>
        p.id === id ? { ...p, archivedAt: undefined } : p,
      ),
    }));
  }, []);

  const toggleFavoriteProject = useCallback((id: string) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p,
      ),
    }));
  }, []);

  const upsertItem = useCallback((draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string }) => {
    setState(s => {
      const projects = s.projects.map(p => {
        if (p.id !== s.activeProjectId) return p;
        const now = Date.now();
        const existing = draft.id ? p.items.find(i => i.id === draft.id) : undefined;
        if (existing) {
          const updated: Item = { ...existing, ...draft, id: existing.id, updatedAt: now };
          return { ...p, items: p.items.map(i => i.id === existing.id ? updated : i) };
        }
        const created: Item = { ...(draft as Omit<Item, "createdAt" | "updatedAt">), id: draft.id ?? newId(), createdAt: now, updatedAt: now };
        return { ...p, items: [...p.items, created] };
      });

      const proj = projects.find(p => p.id === s.activeProjectId)!;
      const target = proj.items.find(i => i.id === (draft.id ?? proj.items[proj.items.length - 1]?.id));
      const history = { ...s.history };
      if (target) {
        const list = history[target.id] ?? [];
        history[target.id] = [...list, { at: Date.now(), snapshot: snapshotItem(target) }].slice(-25);
      }
      return { ...s, projects, history };
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, items: p.items.filter(i => i.id !== id) } : p,
      ),
    }));
  }, []);

  const setItemStatus = useCallback((id: string, status: Item["status"], resolutionNote?: string) => {
    setState(s => ({
      ...s,
      projects: s.projects.map(p => ({
        ...p,
        items: p.items.map(i => {
          if (i.id !== id) return i;
          const now = Date.now();
          if (status === "active") {
            const { resolvedAt: _r, resolutionNote: _n, startedAt: _s, ...rest } = i;
            return { ...rest, status: "active", updatedAt: now } as Item;
          }
          if (status === "in_progress") {
            const { resolvedAt: _r, resolutionNote: _n, ...rest } = i;
            return {
              ...rest,
              status: "in_progress",
              startedAt: i.startedAt ?? new Date().toISOString(),
              updatedAt: now,
            } as Item;
          }
          return {
            ...i,
            status,
            resolvedAt: new Date().toISOString(),
            resolutionNote: resolutionNote ?? i.resolutionNote,
            updatedAt: now,
          };
        }),
      })),
    }));
  }, []);

  return {
    state, activeProject,
    setActiveProject, addProject, updateProject, deleteProject,
    archiveProject, restoreProject, toggleFavoriteProject,
    upsertItem, deleteItem, setItemStatus,
  };
}
