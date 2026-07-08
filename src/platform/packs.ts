import { ExperiencePackId } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Experience Packs — industry terminology (ADR-003). This is the SINGLE
// source of truth for vocabulary across the platform: the resolver's t()
// reads from it, and IndustryContext derives its vocab from it (no second
// table). Keys align to the ExperiencePackId / IndustryContext industries.
// ─────────────────────────────────────────────────────────────────────────

export type Vocab = {
  respondent: string; respondents: string;
  enumerator: string; enumerators: string;
  fieldwork: string;
  metricPrimary: string;   // headline metric label
  metricCoverage: string;  // coverage / performance metric label
  adaContext: string;      // short domain phrase Ada can slot into copy
};

export const PACKS: Record<ExperiencePackId, { label: string; terminology: Vocab }> = {
  research_agency: { label: "Research Agency", terminology: { respondent: "respondent", respondents: "respondents", enumerator: "enumerator", enumerators: "enumerators", fieldwork: "fieldwork", metricPrimary: "Interviews Verified", metricCoverage: "Enumerator Performance", adaContext: "data quality across your fieldwork" } },
  ngo:            { label: "NGO / Development", terminology: { respondent: "beneficiary", respondents: "beneficiaries", enumerator: "field officer", enumerators: "field officers", fieldwork: "household surveys", metricPrimary: "Beneficiaries Reached", metricCoverage: "Field Coverage", adaContext: "MEAL compliance across your household surveys" } },
  fmcg:           { label: "FMCG / Consumer Goods", terminology: { respondent: "store", respondents: "stores", enumerator: "merchandiser", enumerators: "merchandisers", fieldwork: "retail audits", metricPrimary: "Stores Audited", metricCoverage: "Shelf Compliance Rate", adaContext: "shelf compliance across your store visits" } },
  government:     { label: "Government / Public Sector", terminology: { respondent: "citizen", respondents: "citizens", enumerator: "field agent", enumerators: "field agents", fieldwork: "programme evaluation", metricPrimary: "Citizens Surveyed", metricCoverage: "Programme Coverage", adaContext: "programme evaluation across your field agents" } },
  health:         { label: "Health / Pharmaceutical", terminology: { respondent: "patient", respondents: "patients", enumerator: "health worker", enumerators: "health workers", fieldwork: "health surveys", metricPrimary: "Patients Surveyed", metricCoverage: "Facility Coverage", adaContext: "data quality across your health surveys" } },
  education:      { label: "Education", terminology: { respondent: "learner", respondents: "learners", enumerator: "assessor", enumerators: "assessors", fieldwork: "school assessments", metricPrimary: "Learners Assessed", metricCoverage: "School Coverage", adaContext: "assessment quality across your schools" } },
  consultancy:   { label: "Consultancy", terminology: { respondent: "stakeholder", respondents: "stakeholders", enumerator: "consultant", enumerators: "consultants", fieldwork: "stakeholder interviews", metricPrimary: "Interviews Verified", metricCoverage: "Consultant Performance", adaContext: "insight quality across your engagements" } },
};

// Terminology as a function (ADR-003): t("respondent") everywhere, never hardcoded.
export function makeT(pack: ExperiencePackId) {
  const vocab = PACKS[pack]?.terminology as Record<string, string> | undefined;
  return (key: string, fallback?: string) => vocab?.[key] ?? fallback ?? key;
}
