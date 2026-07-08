import React, { createContext, useContext, useState, useCallback } from "react";
import { PACKS } from "../platform/packs";
import { ExperiencePackId } from "../platform/types";

// ─────────────────────────────────────────────────────────────────────────
// Industry-aware experience. The platform adapts its vocabulary (Ada's
// language) and dashboard metric labels to the organisation's industry.
// Terminology is NOT defined here — it is derived from the Experience Packs
// in src/platform/packs.ts, the single source of truth (ADR-003). This
// context remains the live selector + localStorage seed for the resolver.
// Stored in localStorage as `fs_industry` until the org profile API supports it.
// ─────────────────────────────────────────────────────────────────────────

export type IndustryKey = ExperiencePackId;

export interface IndustryVocab {
  label: string;
  respondent: string; respondents: string;
  enumerator: string; enumerators: string;
  fieldwork: string;
  metricPrimary: string;   // headline metric label
  metricCoverage: string;  // coverage / performance metric label
  adaContext: string;      // short domain phrase Ada can slot into copy
}

const VOCAB: Record<IndustryKey, IndustryVocab> = Object.fromEntries(
  (Object.keys(PACKS) as IndustryKey[]).map(key => [
    key,
    { label: PACKS[key].label, ...PACKS[key].terminology },
  ]),
) as Record<IndustryKey, IndustryVocab>;

interface IndustryCtx {
  industry: IndustryKey;
  setIndustry: (k: IndustryKey) => void;
  vocab: IndustryVocab;
  INDUSTRIES: { key: IndustryKey; label: string }[];
}

const IndustryContext = createContext<IndustryCtx | undefined>(undefined);
const STORAGE_KEY = "fs_industry";

function loadIndustry(): IndustryKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as IndustryKey | null;
    if (v && v in VOCAB) return v;
  } catch { /* ignore */ }
  return "research_agency";
}

export function IndustryProvider({ children }: { children: React.ReactNode }) {
  const [industry, setIndustryState] = useState<IndustryKey>(loadIndustry);
  const setIndustry = useCallback((k: IndustryKey) => {
    setIndustryState(k);
    try { localStorage.setItem(STORAGE_KEY, k); } catch { /* ignore */ }
  }, []);
  const value: IndustryCtx = {
    industry, setIndustry, vocab: VOCAB[industry],
    INDUSTRIES: (Object.keys(VOCAB) as IndustryKey[]).map(key => ({ key, label: VOCAB[key].label })),
  };
  return <IndustryContext.Provider value={value}>{children}</IndustryContext.Provider>;
}

export function useIndustry(): IndustryCtx {
  const ctx = useContext(IndustryContext);
  if (!ctx) throw new Error("useIndustry must be used within IndustryProvider");
  return ctx;
}
