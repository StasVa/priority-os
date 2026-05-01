import { useTranslation } from "react-i18next";
import type { Reference } from "@/lib/decision/types";
import { detectRefKind } from "@/lib/decision/references";
import { RefIcon } from "./RefIcon";

interface RefStackProps {
  references: Reference[];
  max?: number;
}

export function RefStack({ references, max = 3 }: RefStackProps) {
  const { t } = useTranslation();
  if (!references || references.length === 0) return null;
  const shown = references.slice(0, max);
  const tooltip = t("references.count", { count: references.length });
  return (
    <span
      className="inline-flex items-center"
      title={tooltip}
      aria-label={tooltip}
    >
      {shown.map((r, i) => {
        const kind = detectRefKind(r.url);
        return (
          <span
            key={r.id}
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-muted border border-background text-muted-foreground"
            style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 10 - i }}
          >
            <RefIcon kind={kind} size={10} />
          </span>
        );
      })}
    </span>
  );
}
