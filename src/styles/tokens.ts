import React from "react";

// ─────────────────────────────────────────────────────────────────────────
// ResearchOS design tokens — single source of truth for colours, card styles,
// typography and score/verdict colour logic. Import from here instead of
// redefining the same constants in every page.
// ─────────────────────────────────────────────────────────────────────────

export const COLORS = {
  blue: "#2463EB",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  purple: "#7C3AED",
  cyan: "#06B6D4",
  ink: "#080D1A",
  slate: "#374151",
  muted: "#9CA3AF",
  line: "#E8EDF5",
  surface: "#F8FAFF",
};

// score 0-100 → colour  |  verdict → colour
export const scoreColor = (s: number): string =>
  s >= 70 ? COLORS.green : s >= 45 ? COLORS.amber : COLORS.red;
export const verdictColor = (v: string): string =>
  v === "PASS" ? COLORS.green : v === "FLAG" ? COLORS.amber : COLORS.red;

export const CARD: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  border: "1px solid #E8EDF5",
  boxShadow: "0 2px 12px rgba(10,15,28,.06)",
};

export const LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: COLORS.muted,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

export const BTN_PRIMARY: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, background: COLORS.blue, border: "none",
  color: "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif",
};

export const BTN_GHOST: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, background: "white", border: "1px solid #E2E8F0",
  color: COLORS.slate, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif",
};

// The dark gradient used by every Ada hero / plan card
export const DARK_GRADIENT = "linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)";

// ─────────────────────────────────────────────────────────────────────────
// Lifecycle stage manifest — THE single source of truth for the five
// stages (constitution 01: navigation reflects the research lifecycle,
// not engine boundaries). Icons/labels/accents were previously duplicated
// across Sidebar, ProjectPage and each stage page, and had already
// drifted (📋 vs 📝). Import from here; never redeclare.
// ─────────────────────────────────────────────────────────────────────────

export type StageId = "design" | "collect" | "verify" | "analyse" | "report";
export type CollectionMode = "field" | "call" | "hybrid";

export interface StageDef {
  id: StageId;
  num: number;
  label: string;
  icon: string;
  accent: string;       // per-stage identity colour
  blurb: string;        // one-line purpose, mode-neutral
}

export const STAGES: StageDef[] = [
  { id: "design",  num: 1, label: "Design",  icon: "📝", accent: "#7C3AED",
    blurb: "Questionnaire, framework and methodology." },
  { id: "collect", num: 2, label: "Collect", icon: "📡", accent: "#2463EB",
    blurb: "Data capture — field, call or both." },
  { id: "verify",  num: 3, label: "Verify",  icon: "🔍", accent: "#D97706",
    blurb: "AI verification engine — every interview, evidence-backed." },
  { id: "analyse", num: 4, label: "Analyse", icon: "✨", accent: "#06B6D4",
    blurb: "InsightScore — themes, statistics and patterns from verified data." },
  { id: "report",  num: 5, label: "Report",  icon: "📄", accent: "#059669",
    blurb: "Dashboards, exports and shared reports." },
];

export const stageDef = (id: StageId): StageDef =>
  STAGES.find((s) => s.id === id) as StageDef;

export const MODE_META: Record<CollectionMode, { icon: string; label: string; engine: string }> = {
  field:  { icon: "🧭", label: "Field",  engine: "FieldScore" },
  call:   { icon: "📞", label: "Call",   engine: "CallScore" },
  hybrid: { icon: "🔀", label: "Hybrid", engine: "FieldScore + CallScore" },
};
