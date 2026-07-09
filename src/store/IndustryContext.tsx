import React, { createContext, useContext, useState, useCallback } from "react";
import { PACKS } from "../platform/packs";
import { ExperiencePackId } from "../platform/types";

export type IndustryKey = ExperiencePackId;

export interface IndustryVocab {
  label: string;
  respondent: string; respondents: string;
  enumerator: string; enumerators: string;
  fieldwork: string;
  metricPrimary: string;
  metricCoverage: string;
  adaContext: string;
}

const VOCAB: Record<IndustryKey, IndustryVocab> = Object.fromEntries(
  (Object.keys(PACKS) as IndustryKey[]).map(key => [
    key,
    { label: PACKS[key].label, ...PACKS[key].terminology },
  ]),
) as Record<IndustryKey, IndustryVocab>;

interface IndustryCtx {
  industry: IndustryKey;           // org default (localStorage)
  sessionIndustry: IndustryKey;    // active this session (overrides org default)
  setIndustry: (k: IndustryKey) => void;       // change org default
  setSessionIndustry: (k: IndustryKey) => void; // change for this session only
  vocab: IndustryVocab;            // always reflects sessionIndustry
  INDUSTRIES: { key: IndustryKey; label: string }[];
  isSessionOverride: boolean;      // true when session differs from org default
  clearSessionOverride: () => void;
}

const IndustryContext = createContext<IndustryCtx | undefined>(undefined);
const LS_KEY = "fs_industry";
const SS_KEY = "fs_industry_session";

function loadIndustry(): IndustryKey {
  try {
    const v = localStorage.getItem(LS_KEY) as IndustryKey | null;
    if (v && v in VOCAB) return v;
  } catch { /* ignore */ }
  return "research_agency";
}

function loadSession(orgDefault: IndustryKey): IndustryKey {
  try {
    const v = sessionStorage.getItem(SS_KEY) as IndustryKey | null;
    if (v && v in VOCAB) return v;
  } catch { /* ignore */ }
  return orgDefault;
}

export function IndustryProvider({ children }: { children: React.ReactNode }) {
  const [industry, setIndustryState] = useState<IndustryKey>(loadIndustry);
  const [sessionIndustry, setSessionState] = useState<IndustryKey>(() => loadSession(loadIndustry()));

  const setIndustry = useCallback((k: IndustryKey) => {
    setIndustryState(k);
    try { localStorage.setItem(LS_KEY, k); } catch { /* ignore */ }
  }, []);

  const setSessionIndustry = useCallback((k: IndustryKey) => {
    setSessionState(k);
    try { sessionStorage.setItem(SS_KEY, k); } catch { /* ignore */ }
  }, []);

  const clearSessionOverride = useCallback(() => {
    setSessionState(industry);
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
  }, [industry]);

  const value: IndustryCtx = {
    industry,
    sessionIndustry,
    setIndustry,
    setSessionIndustry,
    vocab: VOCAB[sessionIndustry],
    INDUSTRIES: (Object.keys(VOCAB) as IndustryKey[]).map(key => ({ key, label: VOCAB[key].label })),
    isSessionOverride: sessionIndustry !== industry,
    clearSessionOverride,
  };

  return <IndustryContext.Provider value={value}>{children}</IndustryContext.Provider>;
}

export function useIndustry(): IndustryCtx {
  const ctx = useContext(IndustryContext);
  if (!ctx) throw new Error("useIndustry must be used within IndustryProvider");
  return ctx;
}
