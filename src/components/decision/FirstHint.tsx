import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

const HINT_KEY = "priority-os.firstHintDismissed";

interface FirstHintProps {
  itemCount: number;
}

export function FirstHint({ itemCount }: FirstHintProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem(HINT_KEY) === "true"; } catch { return true; }
  });

  // Auto-dismiss when 3+ items in active context
  useEffect(() => {
    if (!dismissed && itemCount >= 3) {
      try { localStorage.setItem(HINT_KEY, "true"); } catch { /* ignore */ }
      setDismissed(true);
    }
  }, [itemCount, dismissed]);

  if (dismissed) return null;

  const close = () => {
    try { localStorage.setItem(HINT_KEY, "true"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="border-t border-b border-border bg-secondary/40">
      <div className="px-6 py-4 flex items-start gap-4">
        <p
          className="font-serif italic text-foreground flex-1"
          style={{ fontSize: 14, lineHeight: 1.55 }}
        >
          {t("welcome.firstHint")}
        </p>
        <button
          onClick={close}
          aria-label={t("editor.close")}
          className="text-muted-foreground hover:text-foreground ease-editorial transition-colors shrink-0 mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
