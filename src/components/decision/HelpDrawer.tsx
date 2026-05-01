import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DIMENSIONS = ["impact", "effort", "importance", "satisfaction", "confidence", "risk"] as const;
const LENSES = ["valueEffort", "importanceSatisfaction", "confidenceRisk"] as const;

export function HelpDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        aria-label={t("help.title")}
        className="ml-auto relative h-full w-full max-w-[460px] bg-background border-l border-border shadow-2xl animate-drawer-in flex flex-col"
      >
        <div className="px-7 py-5 border-b border-border flex items-center justify-between">
          <span className="label-mono">{t("help.title")}</span>
          <button onClick={onClose} aria-label={t("editor.close")} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Six dimensions */}
          <section>
            <h3 className="label-mono mb-5">{t("help.section.dimensions")}</h3>
            <div className="space-y-6">
              {DIMENSIONS.map((d) => (
                <div key={d}>
                  <div
                    className="font-serif text-foreground"
                    style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}
                  >
                    {t(`help.dimensions.${d}.term`)}
                  </div>
                  <p
                    className="font-serif text-muted-foreground mt-2"
                    style={{ fontSize: 14, lineHeight: 1.6 }}
                  >
                    {t(`help.dimensions.${d}.def`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* Three lenses */}
          <section>
            <h3 className="label-mono mb-5">{t("help.section.lenses")}</h3>
            <div className="space-y-6">
              {LENSES.map((l) => (
                <div key={l}>
                  <div
                    className="font-serif text-foreground"
                    style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}
                  >
                    {t(`help.lenses.${l}.term`)}
                  </div>
                  <p
                    className="font-serif text-muted-foreground mt-2"
                    style={{ fontSize: 14, lineHeight: 1.6 }}
                  >
                    {t(`help.lenses.${l}.def`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <hr className="my-8 border-border" />

          {/* How to read the matrix */}
          <section className="pb-2">
            <h3 className="label-mono mb-5">{t("help.section.matrix")}</h3>
            <p
              className="font-serif text-muted-foreground"
              style={{ fontSize: 14, lineHeight: 1.6 }}
            >
              {t("help.matrix.body")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
