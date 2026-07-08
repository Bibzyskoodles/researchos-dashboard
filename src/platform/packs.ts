import { ExperiencePackId } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Experience Packs — industry terminology (ADR-003). This is the resolver's
// source for t(); IndustryContext is the live seed and will be migrated to
// consume this in a later step. Keys align to IndustryContext's industries.
// ─────────────────────────────────────────────────────────────────────────

type Vocab = Record<string, string>;

export const PACKS: Record<ExperiencePackId, { label: string; terminology: Vocab }> = {
  research_agency: { label: "Research Agency", terminology: { respondent: "respondent", respondents: "respondents", enumerator: "enumerator", enumerators: "enumerators", fieldwork: "fieldwork" } },
  ngo:            { label: "NGO / Development", terminology: { respondent: "beneficiary", respondents: "beneficiaries", enumerator: "field officer", enumerators: "field officers", fieldwork: "household surveys" } },
  fmcg:           { label: "Retail / FMCG", terminology: { respondent: "store", respondents: "stores", enumerator: "merchandiser", enumerators: "merchandisers", fieldwork: "retail audits" } },
  government:     { label: "Government", terminology: { respondent: "citizen", respondents: "citizens", enumerator: "field agent", enumerators: "field agents", fieldwork: "programme evaluation" } },
  health:         { label: "Health", terminology: { respondent: "patient", respondents: "patients", enumerator: "health worker", enumerators: "health workers", fieldwork: "health surveys" } },
  education:      { label: "Education", terminology: { respondent: "learner", respondents: "learners", enumerator: "assessor", enumerators: "assessors", fieldwork: "school assessments" } },
  consultancy:   { label: "Consultancy", terminology: { respondent: "stakeholder", respondents: "stakeholders", enumerator: "consultant", enumerators: "consultants", fieldwork: "stakeholder interviews" } },
};

// Terminology as a function (ADR-003): t("respondent") everywhere, never hardcoded.
export function makeT(pack: ExperiencePackId) {
  const vocab = PACKS[pack]?.terminology || {};
  return (key: string, fallback?: string) => vocab[key] ?? fallback ?? key;
}
