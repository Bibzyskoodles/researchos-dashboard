import React, { createContext, useContext, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Industry-aware experience. The platform adapts its vocabulary (Ada's
// language) and dashboard metric labels to the organisation's industry.
// Stored in localStorage as `fs_industry` until the org profile API supports it.
// ─────────────────────────────────────────────────────────────────────────

export type IndustryKey =
  | "research_agency" | "ngo" | "fmcg" | "government" | "health" | "education" | "consultancy";

export interface IndustryVocab {
  label: string;
  respondent: string; respondents: string;
  enumerator: string; enumerators: string;
  fieldwork: string;
  metricPrimary: string;   // headline metric label
  metricCoverage: string;  // coverage / performance metric label
  adaContext: string;      // short domain phrase Ada can slot into copy
}

const VOCAB: Record<IndustryKey, IndustryVocab> = {
  research_agency: { label: "Research Agency", respondent: "respondent", respondents: "respondents", enumerator: "enumerator", enumerators: "enumerators", fieldwork: "fieldwork", metricPrimary: "Interviews Verified", metricCoverage: "Enumerator Performance", adaContext: "data quality across your fieldwork" },
  ngo: { label: "NGO / Development", respondent: "beneficiary", respondents: "beneficiaries", enumerator: "field officer", enumerators: "field officers", fieldwork: "household surveys", metricPrimary: "Beneficiaries Reached", metricCoverage: "Field Coverage", adaContext: "MEAL compliance across your household surveys" },
  fmcg: { label: "FMCG / Consumer Goods", respondent: "store", respondents: "stores", enumerator: "merchandiser", enumerators: "merchandisers", fieldwork: "retail audits", metricPrimary: "Stores Audited", metricCoverage: "Shelf Compliance Rate", adaContext: "shelf compliance across your store visits" },
  government: { label: "Government / Public Sector", respondent: "citizen", respondents: "citizens", enumerator: "field agent", enumerators: "field agents", fieldwork: "programme evaluation", metricPrimary: "Citizens Surveyed", metricCoverage: "Programme Coverage", adaContext: "programme evaluation across your field agents" },
  health: { label: "Health / Pharmaceutical", respondent: "patient", respondents: "patients", enumerator: "health worker", enumerators: "health workers", fieldwork: "health surveys", metricPrimary: "Patients Surveyed", metricCoverage: "Facility Coverage", adaContext: "data quality across your health surveys" },
  education: { label: "Education", respondent: "learner", respondents: "learners", enumerator: "assessor", enumerators: "assessors", fieldwork: "school assessments", metricPrimary: "Learners Assessed", metricCoverage: "School Coverage", adaContext: "assessment quality across your schools" },
  consultancy: { label: "Consultancy", respondent: "stakeholder", respondents: "stakeholders", enumerator: "consultant", enumerators: "consultants", fieldwork: "stakeholder interviews", metricPrimary: "Interviews Verified", metricCoverage: "Consultant Performance", adaContext: "insight quality across your engagements" },
};

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
