import type { Reference } from "./types";

export type RefKind =
  | "jira" | "notion" | "figma" | "github" | "linear"
  | "gdocs" | "gdrive" | "slack" | "link";

export function detectRefKind(url: string): RefKind {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return "link"; }
  if (host === "jira.atlassian.com" || host.endsWith(".atlassian.net")) return "jira";
  if (host === "notion.so" || host.endsWith(".notion.so") || host.endsWith(".notion.site")) return "notion";
  if (host === "figma.com" || host.endsWith(".figma.com")) return "figma";
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (host === "linear.app" || host.endsWith(".linear.app")) return "linear";
  if (host === "docs.google.com") return "gdocs";
  if (host === "drive.google.com") return "gdrive";
  if (host.endsWith("slack.com")) return "slack";
  return "link";
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? `${host}/${seg}` : host;
  } catch { return url; }
}

export function isValidUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try { new URL(url); return true; } catch { return false; }
}

export function newReference(url: string, label?: string): Reference {
  return {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    url: url.trim(),
    label: label?.trim() || undefined,
    addedAt: Date.now(),
  };
}
