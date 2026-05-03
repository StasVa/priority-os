export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    byUser: (userId: string) => ["projects", "byUser", userId] as const,
  },
  items: {
    all: ["items"] as const,
    byProject: (projectId: string) => ["items", "byProject", projectId] as const,
    detail: (id: string) => ["items", "detail", id] as const,
    activeCounts: ["items", "activeCounts"] as const,
  },
  profiles: {
    me: ["profiles", "me"] as const,
    detail: (id: string) => ["profiles", "detail", id] as const,
  },
  members: {
    byProject: (projectId: string) => ["members", "byProject", projectId] as const,
  },
} as const;
