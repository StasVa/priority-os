import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, Smile, Star, Trash2, X } from "lucide-react";
import type { Project, ProjectColor } from "@/lib/decision/types";
import { CURATED_EMOJIS, PROJECT_COLORS, colorDot, colorLabel } from "@/lib/decision/projectColors";

interface Props {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Project>) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

function timeAgo(ts: number | undefined, locale: string): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  const ru = locale.startsWith("ru");
  if (m < 1) return ru ? "только что" : "just now";
  if (m < 60) return ru ? `${m} мин назад` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return ru ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return ru ? `${d} дн назад` : `${d}d ago`;
  const mo = Math.floor(d / 30);
  return ru ? `${mo} мес назад` : `${mo}mo ago`;
}

export function ProjectSettingsDrawer({
  open, project, onClose, onUpdate, onArchive, onRestore, onDelete, onToggleFavorite,
}: Props) {
  const { t, i18n } = useTranslation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [deleteTyping, setDeleteTyping] = useState("");

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setEmojiOpen(false);
      setConfirm(null);
      setDeleteTyping("");
    }
  }, [open, project]);

  // Debounce save name/description
  useEffect(() => {
    if (!open || !project) return;
    const id = window.setTimeout(() => {
      const trimmed = name.trim();
      if (trimmed && trimmed !== project.name) onUpdate(project.id, { name: trimmed });
      if ((description ?? "") !== (project.description ?? "")) {
        onUpdate(project.id, { description });
      }
    }, 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const counts = useMemo(() => {
    if (!project) return { active: 0, in_progress: 0, done: 0, dropped: 0 };
    return {
      active: project.items.filter(i => i.status === "active").length,
      in_progress: project.items.filter(i => i.status === "in_progress").length,
      done: project.items.filter(i => i.status === "done").length,
      dropped: project.items.filter(i => i.status === "dropped").length,
    };
  }, [project]);

  const lastActivity = useMemo(() => {
    if (!project || project.items.length === 0) return undefined;
    return Math.max(...project.items.map(i => i.updatedAt));
  }, [project]);

  if (!open || !project) return null;

  const descLen = (description ?? "").length;
  const descColor =
    descLen > 140 ? "text-[hsl(var(--drop))]" :
    descLen >= 100 ? "text-[hsl(var(--bet-strong))]" :
    "text-muted-foreground/70";

  const isArchived = !!project.archivedAt;
  const nameError = name.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-ink/30 dark:bg-black/60 backdrop-blur-[2px] animate-overlay-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="ml-auto relative h-full w-full max-w-[460px] bg-background border-l border-border shadow-2xl animate-drawer-in flex flex-col"
      >
        <div className="px-7 py-5 border-b border-border flex items-center justify-between">
          <span className="label-mono">{t("projects.settings.title")}</span>
          <button onClick={onClose} aria-label={t("editor.close")} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">
          {/* Emoji */}
          <div>
            <button
              onClick={() => setEmojiOpen(v => !v)}
              className="w-14 h-14 rounded-lg border border-border flex items-center justify-center text-3xl hover:border-foreground/60 ease-editorial transition-colors"
              aria-label={t("projects.settings.emoji")}
            >
              {project.emoji ? (
                <span>{project.emoji}</span>
              ) : (
                <Smile className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            {emojiOpen && (
              <div className="mt-3 p-3 rounded-lg border border-border bg-card animate-fade-up">
                <div className="grid grid-cols-10 gap-1">
                  {CURATED_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => { onUpdate(project.id, { emoji: e }); setEmojiOpen(false); }}
                      className={`w-8 h-8 rounded hover:bg-secondary text-xl flex items-center justify-center ease-editorial transition-colors ${project.emoji === e ? "bg-secondary ring-1 ring-foreground" : ""}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {project.emoji && (
                  <button
                    onClick={() => { onUpdate(project.id, { emoji: undefined }); setEmojiOpen(false); }}
                    className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {t("projects.settings.removeEmoji")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="label-mono block mb-2">{t("projects.settings.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.settings.namePlaceholder")}
              className={`w-full bg-transparent border-0 border-b ${nameError ? "border-[hsl(var(--drop))]" : "border-border focus:border-foreground"} outline-none px-0 py-2 font-serif text-lg leading-tight ease-editorial transition-colors`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label-mono block mb-2">{t("projects.settings.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 140))}
              placeholder={t("projects.settings.descriptionPlaceholder")}
              rows={2}
              className="w-full bg-transparent border border-border rounded px-3 py-2 font-serif text-sm focus:border-foreground outline-none ease-editorial transition-colors resize-none"
              style={{ maxHeight: "8rem" }}
            />
            <div className={`mt-1 text-right font-mono text-[11px] tabular-nums ${descColor}`}>
              {descLen} / 140
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="label-mono block mb-2">{t("projects.settings.color")}</label>
            <div className="flex items-center gap-2">
              {PROJECT_COLORS.map(c => {
                const selected = (project.color ?? "neutral") === c;
                return (
                  <button
                    key={c}
                    onClick={() => onUpdate(project.id, { color: c })}
                    title={colorLabel(c)}
                    className={`w-[22px] h-[22px] rounded-full ease-editorial transition-transform hover:scale-110 ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                    style={{ backgroundColor: colorDot(c) }}
                    aria-label={colorLabel(c)}
                  />
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <section className="border-t border-border pt-5">
            <div className="label-mono mb-3">{t("projects.settings.stats")}</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6 font-serif text-sm text-foreground/90">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-foreground" />{counts.active} {t("all.shortLabels.active")}</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--bet))]" />{counts.in_progress} {t("all.shortLabels.in_progress")}</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--win))]" />{counts.done} {t("all.shortLabels.done")}</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />{counts.dropped} {t("all.shortLabels.dropped")}</div>
            </div>
            <div className="mt-4 space-y-1 font-mono text-[11px] text-muted-foreground/80">
              <div>{t("projects.settings.created", { time: timeAgo(project.createdAt, i18n.language) })}</div>
              <div>{t("projects.settings.lastActivity", { time: timeAgo(lastActivity, i18n.language) })}</div>
            </div>
          </section>

          {/* Coming Soon */}
          <section className="border-t border-border pt-5">
            <div className="label-mono mb-3">{t("projects.settings.comingSoon")}</div>
            <div className="space-y-2 font-serif text-sm text-muted-foreground/70">
              {[
                t("projects.settings.members"),
                t("projects.settings.sharing"),
                t("projects.settings.integrations"),
              ].map(label => (
                <div key={label} className="flex items-center gap-3 cursor-not-allowed select-none">
                  <span className="w-3 h-3 rounded-full border border-muted-foreground/40" aria-hidden />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Actions footer */}
        {confirm === "archive" ? (
          <div className="px-7 py-5 border-t border-border bg-muted/50 animate-fade-up">
            <p className="font-serif text-sm text-foreground mb-3">
              {t("projects.settings.archiveConfirm")}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground">
                {t("projects.settings.cancel")}
              </button>
              <button
                onClick={() => { onArchive(project.id); setConfirm(null); onClose(); }}
                className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90"
              >
                {t("projects.settings.archive")}
              </button>
            </div>
          </div>
        ) : confirm === "delete" ? (
          <div className="px-7 py-5 border-t border-border bg-muted/50 animate-fade-up">
            <p className="font-serif text-sm text-foreground mb-2">
              {t("projects.settings.deleteConfirm", { count: project.items.length })}
            </p>
            <p className="font-serif italic text-xs text-muted-foreground mb-2">
              {t("projects.settings.deleteConfirmType", { name: project.name })}
            </p>
            <input
              value={deleteTyping}
              onChange={(e) => setDeleteTyping(e.target.value)}
              placeholder={project.name}
              className="w-full bg-background border border-border rounded px-3 py-2 font-serif text-sm focus:border-[hsl(var(--drop))] outline-none ease-editorial transition-colors"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setConfirm(null); setDeleteTyping(""); }} className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground">
                {t("projects.settings.cancel")}
              </button>
              <button
                disabled={deleteTyping.trim() !== project.name}
                onClick={() => { onDelete(project.id); setConfirm(null); onClose(); }}
                className="px-5 py-2 rounded-full bg-[hsl(var(--drop))] text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("projects.settings.delete")}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-7 py-4 border-t border-border space-y-1">
            <button
              onClick={() => onToggleFavorite(project.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary ease-editorial transition-colors text-left font-serif text-sm"
            >
              <Star className={`w-4 h-4 ${project.isFavorite ? "fill-foreground text-foreground" : "text-muted-foreground"}`} />
              <span>{project.isFavorite ? t("projects.settings.removeFavorite") : t("projects.settings.addFavorite")}</span>
            </button>
            {isArchived ? (
              <button
                onClick={() => { onRestore(project.id); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary ease-editorial transition-colors text-left font-serif text-sm"
              >
                <ArchiveRestore className="w-4 h-4 text-muted-foreground" />
                <span>{t("projects.settings.restore")}</span>
              </button>
            ) : (
              <button
                onClick={() => setConfirm("archive")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary ease-editorial transition-colors text-left font-serif text-sm"
              >
                <Archive className="w-4 h-4 text-muted-foreground" />
                <span>{t("projects.settings.archive")}</span>
              </button>
            )}
            <button
              onClick={() => setConfirm("delete")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[hsl(var(--drop-bg))] ease-editorial transition-colors text-left font-serif text-sm text-[hsl(var(--drop))]"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t("projects.settings.delete")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
