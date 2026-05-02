import type { ItemStatus } from "@/lib/decision/types";

export interface DemoItemDraft {
  title: string;
  note: string;
  impact: number;
  effort: number;
  importance: number;
  satisfaction: number;
  confidence: number;
  risk: number;
  status: ItemStatus;
}

export const DEMO_ITEMS: DemoItemDraft[] = [
  { title: "Rewrite onboarding flow", note: "drop-off at step 3 is brutal",     impact: 9, effort: 6, importance: 9, satisfaction: 3, confidence: 7, risk: 3, status: "active" },
  { title: "Add dark mode",           note: "users keep asking",                impact: 4, effort: 3, importance: 5, satisfaction: 2, confidence: 9, risk: 1, status: "active" },
  { title: "Migrate to new database", note: "performance ceiling soon",         impact: 7, effort: 9, importance: 6, satisfaction: 6, confidence: 4, risk: 8, status: "active" },
  { title: "Weekly user interviews",  note: "stop guessing",                    impact: 8, effort: 2, importance: 8, satisfaction: 2, confidence: 8, risk: 1, status: "active" },
  { title: "Refactor auth module",    note: "tech debt",                        impact: 3, effort: 7, importance: 4, satisfaction: 7, confidence: 6, risk: 4, status: "active" },
  { title: "Launch referral program", note: "growth lever",                     impact: 7, effort: 5, importance: 7, satisfaction: 4, confidence: 5, risk: 4, status: "active" },
];
