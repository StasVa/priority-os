import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Item } from "@/lib/decision/types";
import { compositeScore, recommendationKey } from "@/lib/decision/logic";

interface WelcomeOnboardingProps {
  open: boolean;
  onSubmit: (draft: {
    title: string;
    projectName: string;
    impact: number; effort: number; importance: number;
    satisfaction: number; confidence: number; risk: number;
  }) => void;
  onSkip: () => void;
}

const SLIDER_KEYS: Array<keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk">> = [
  "impact", "effort", "importance", "satisfaction", "confidence", "risk",
];

export function WelcomeOnboarding({ open, onSubmit, onSkip }: WelcomeOnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scores, setScores] = useState({
    impact: 5, effort: 5, importance: 5, satisfaction: 5, confidence: 5, risk: 5,
  });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (step === 1) requestAnimationFrame(() => titleInputRef.current?.focus());
    if (step === 2) requestAnimationFrame(() => projectInputRef.current?.focus());
  }, [open, step]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const trimmedCtx = projectName.trim();
  const canStep1 = trimmedTitle.length > 0;
  const canStep2 = trimmedCtx.length > 0;

  const advance1 = () => { if (canStep1) setStep(2); };
  const advance2 = () => { if (canStep2) setStep(3); };

  const submit = () => {
    if (!canStep1 || !canStep2) return;
    onSubmit({ title: trimmedTitle, projectName: trimmedCtx, ...scores });
  };

  // Build a synthetic Item-like for score/recommendation calc
  const synthetic: Item = {
    id: "_preview", projectId: "_preview", title: trimmedTitle || "_", note: "",
    ...scores,
    createdAt: 0, updatedAt: 0, status: "active", references: [],
  };
  const score = compositeScore(synthetic);
  const recKey = recommendationKey(synthetic);

  const ctxExamples = [1, 2, 3, 4, 5, 6];

  return (
    <div className="fixed inset-0 z-50 bg-background animate-overlay-in overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
        {/* Logo */}
        <div className="flex items-baseline gap-1.5 select-none mb-12">
          <span className="font-serif text-xl font-semibold tracking-tight" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t("brand.name")}
          </span>
          <span className="font-serif italic text-base text-muted-foreground font-light">
            {t("brand.suffix")}
          </span>
        </div>

        {step === 1 && (
          <div className="w-full max-w-[500px] space-y-8">
            <div className="space-y-3">
              <h1
                className="font-serif text-foreground"
                style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.15, fontVariationSettings: '"opsz" 144' }}
              >
                {t("welcome.step1.heading")}
              </h1>
              <p className="font-serif italic text-muted-foreground" style={{ fontSize: 16, lineHeight: 1.5 }}>
                {t("welcome.step1.subhead")}
              </p>
            </div>

            <div>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); advance1(); } }}
                placeholder={t("welcome.step1.placeholder")}
                className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-3 font-serif placeholder:text-muted-foreground/60 ease-editorial transition-colors"
                style={{ fontSize: 22, lineHeight: 1.4, fontVariationSettings: '"opsz" 96' }}
              />
            </div>

            {trimmedTitle.length === 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="font-mono uppercase text-muted-foreground/70" style={{ fontSize: 11, letterSpacing: "0.18em" }}>
                  {t("welcome.step1.examplesTitle")}
                </div>
                <ul className="space-y-1">
                  {[1, 2, 3].map(n => (
                    <li
                      key={n}
                      className="font-serif italic text-muted-foreground/70"
                      style={{ fontSize: 13, lineHeight: 1.6 }}
                    >
                      · {t(`welcome.step1.example${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={onSkip}
                className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                {t("welcome.skip")}
              </button>
              <button
                onClick={advance1}
                disabled={!canStep1}
                className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ease-editorial transition-opacity"
              >
                {t("welcome.continue")} →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-[500px] space-y-8">
            <div className="space-y-3">
              <h1
                className="font-serif text-foreground"
                style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.15, fontVariationSettings: '"opsz" 144' }}
              >
                {t("welcome.step2.heading")}
              </h1>
              <p className="font-serif italic text-muted-foreground" style={{ fontSize: 16, lineHeight: 1.5 }}>
                {t("welcome.step2.subhead")}
              </p>
            </div>

            {/* Read-only title display from step 1 */}
            <div className="border-l-2 border-border pl-4 py-1">
              <p className="font-serif italic text-muted-foreground" style={{ fontSize: 15, lineHeight: 1.4 }}>
                "{trimmedTitle}"
              </p>
            </div>

            <div>
              <input
                ref={projectInputRef}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); advance2(); } }}
                placeholder={t("welcome.step2.placeholder")}
                className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-3 font-serif placeholder:text-muted-foreground/60 ease-editorial transition-colors"
                style={{ fontSize: 22, lineHeight: 1.4, fontVariationSettings: '"opsz" 96' }}
              />
            </div>

            {trimmedCtx.length === 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="font-mono uppercase text-muted-foreground/70" style={{ fontSize: 11, letterSpacing: "0.18em" }}>
                  {t("welcome.step2.examplesTitle")}
                </div>
                <ul className="space-y-1">
                  {ctxExamples.map(n => (
                    <li
                      key={n}
                      className="font-serif italic text-muted-foreground/70"
                      style={{ fontSize: 13, lineHeight: 1.6 }}
                    >
                      · {t(`welcome.step2.example${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                ← {t("welcome.step3.back")}
              </button>
              <button
                onClick={advance2}
                disabled={!canStep2}
                className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ease-editorial transition-opacity"
              >
                {t("welcome.continue")} →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full max-w-[560px] space-y-8">
            <div className="space-y-3">
              <h1
                className="font-serif text-foreground"
                style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.2, fontVariationSettings: '"opsz" 144' }}
              >
                {t("welcome.step3.heading")}
              </h1>
              <p className="font-serif italic text-muted-foreground" style={{ fontSize: 15, lineHeight: 1.5 }}>
                {t("welcome.step3.subhead")}
              </p>
            </div>

            {/* Read-only title display */}
            <div className="border-l-2 border-border pl-4 py-1">
              <p className="font-serif text-foreground" style={{ fontSize: 18, lineHeight: 1.4 }}>
                "{trimmedTitle}"
              </p>
              <p className="font-mono uppercase text-muted-foreground/60 mt-1" style={{ fontSize: 10, letterSpacing: "0.15em" }}>
                {trimmedCtx}
              </p>
            </div>

            {/* Sliders */}
            <div className="space-y-5">
              {SLIDER_KEYS.map((key) => {
                const value = scores[key];
                return (
                  <div key={key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="label-mono" style={{ color: "hsl(var(--foreground))" }}>
                          {t(`sliders.${key}.label`)}
                        </span>
                        <span className="font-serif italic text-xs text-muted-foreground">
                          {t(`sliders.${key}.hint`)}
                        </span>
                      </div>
                      <span className="font-mono text-sm tabular-nums">{value}</span>
                    </div>
                    <input
                      type="range" min={0} max={10} step={1}
                      value={value}
                      onChange={(e) => setScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                      className="w-full accent-foreground"
                    />
                  </div>
                );
              })}
            </div>

            {/* Live score block */}
            <div className="border-t border-border">
              <div className="py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono uppercase text-muted-foreground/70" style={{ fontSize: 10, letterSpacing: "0.15em" }}>
                    {t("editor.compositeScore")}
                  </span>
                  <span
                    className="font-serif tabular-nums text-foreground"
                    style={{ fontSize: 36, fontWeight: 400, fontVariationSettings: '"opsz" 144', lineHeight: 1 }}
                  >
                    {score.toFixed(1)}
                  </span>
                </div>
                <p
                  className="font-serif italic text-muted-foreground dark:text-[hsl(var(--editorial-emphasis))] mt-2.5"
                  style={{ fontSize: 14, lineHeight: 1.5 }}
                >
                  {t(`recommendations.${recKey}`)}
                </p>
              </div>
              <div className="border-b border-border" />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                ← {t("welcome.step3.back")}
              </button>
              <button
                onClick={submit}
                className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
              >
                {t("welcome.step3.addToWorkspace")} →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
