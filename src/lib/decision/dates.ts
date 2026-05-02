import type { TFunction } from "i18next";

/** Start of day (local) for given date. */
export function startOfDay(d: Date | string | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function todayStart(): Date { return startOfDay(new Date()); }

/** Whole-day delta = target - today. Negative means past, 0 = today. */
export function dayDelta(targetIso: string): number {
  const target = startOfDay(targetIso).getTime();
  const today = todayStart().getTime();
  return Math.round((target - today) / 86_400_000);
}

/** Days since a past timestamp (local-day rounded). */
export function daysSince(iso: string | number): number {
  const past = startOfDay(iso).getTime();
  const today = todayStart().getTime();
  return Math.max(0, Math.round((today - past) / 86_400_000));
}

/** Localized "9 ноября 2026" / "Nov 9, 2026" style date. */
export function formatLongDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(localeTag(locale), {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return ""; }
}

export function formatShortDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(localeTag(locale), {
      month: "short", day: "numeric",
    });
  } catch { return ""; }
}

export function localeTag(locale: string): string {
  const l = (locale || "en").slice(0, 2);
  return ({ en: "en-US", ru: "ru-RU", de: "de-DE", fr: "fr-FR", es: "es-ES" } as Record<string, string>)[l] ?? "en-US";
}

/** Calm, factual date info text for an item in a given lifecycle state. */
export function dateInfo(
  t: TFunction,
  opts: {
    status: "in_progress" | "done" | "dropped" | "active";
    targetDate?: string;
    startedAt?: string;
    resolvedAt?: string;
  },
): string {
  if (opts.status === "in_progress") {
    if (!opts.targetDate) return t("timeline.dateInfo.noDate");
    const d = dayDelta(opts.targetDate);
    if (d === 0) return t("timeline.dateInfo.promisedToday");
    if (d > 0) return t("timeline.dateInfo.promisedInDays", { count: d });
    return t("timeline.dateInfo.promisedAgoDays", { count: -d });
  }
  if (opts.status === "done") {
    if (!opts.resolvedAt) return "";
    const n = daysSince(opts.resolvedAt);
    if (n === 0) return t("timeline.dateInfo.completedToday");
    return t("timeline.dateInfo.completedAgo", { count: n });
  }
  if (opts.status === "dropped") {
    if (!opts.resolvedAt) return "";
    const n = daysSince(opts.resolvedAt);
    return t("timeline.dateInfo.droppedAgo", { count: Math.max(1, n) });
  }
  return "";
}
