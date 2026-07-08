import { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Platform spine types. See docs/04_ARCHITECTURE.md and docs/11_DECISIONS.md.
// Everything the UI shows is resolved from metadata, never hardcoded.
// ─────────────────────────────────────────────────────────────────────────

export type CapabilityId =
  | "overview" | "fieldscore" | "insightscore" | "questionnaire"
  | "reports" | "integrations" | "settings";

export type LicenseTier = "starter" | "professional" | "enterprise";

// Platform roles (current + Phase-1 role experiences)
export type Role =
  | "admin" | "manager" | "viewer"
  | "ceo" | "research_director" | "project_manager" | "analyst" | "field_supervisor";

// Business model — distinct from industry (ADR-006). Changes workflows/structure.
export type CustomerType = "research_agency" | "ngo" | "corporate" | "university" | "government";

// Research lifecycle stage (ADR-005). Makes the platform stage-aware.
export type ResearchStage = "planning" | "fieldwork" | "cleaning" | "analysis" | "reporting" | "completed";

// Industry lens — terminology only (ADR-003/006). Aligned to the live IndustryContext keys.
export type ExperiencePackId =
  | "research_agency" | "ngo" | "fmcg" | "government" | "health" | "education" | "consultancy";

export interface NavSectionRef { id: string; label: string; order: number; }

export interface NavItemDef {
  to: string;
  label: string;
  icon: LucideIcon;
  section: NavSectionRef;
  order: number;
  permission?: string;
}

// Sub-registry declaration types — declared now, filled incrementally (ADR-007).
export interface DashboardCardDef { id: string; capabilityId: CapabilityId; title: string; roles?: Role[]; stages?: ResearchStage[]; }
export interface CommandDef { id: string; label: string; run?: string; permission?: string; }
export interface SettingsSchemaDef { id: string; scope: "organization" | "workspace" | "project"; }
export interface IntegrationDef { id: string; name: string; }
export interface ReportDef { id: string; name: string; formats: string[]; }
export interface NotificationDef { id: string; event: string; }

// A capability describes itself across every registry (ADR-007).
export interface Capability {
  id: CapabilityId;
  name: string;
  description: string;
  requiredLicense: LicenseTier;
  alwaysOn?: boolean;                       // licensed regardless of plan (core)
  experiencePacks?: ExperiencePackId[];     // where it applies (default: all)
  customerTypes?: CustomerType[];           // where it applies (default: all)
  navigation?: NavItemDef[];
  dashboardCards?: DashboardCardDef[];
  commands?: CommandDef[];
  settings?: SettingsSchemaDef[];
  integrations?: IntegrationDef[];
  reports?: ReportDef[];
  notifications?: NotificationDef[];
  permissions?: string[];
}

export interface NavItem { to: string; label: string; icon: LucideIcon; capabilityId: CapabilityId; }
export interface NavSection { id: string; label: string; order: number; items: NavItem[]; }

export interface PlatformContext {
  role: Role;
  customerType: CustomerType;
  experiencePack: ExperiencePackId;
  licensedCapabilities: CapabilityId[];
  researchStage?: ResearchStage | null;
  permissions?: string[];                   // undefined = admin / all allowed
}

export interface ResolvedExperience {
  navigation: NavSection[];
  homePage: string;
  dashboard: DashboardCardDef[];
  capabilities: CapabilityId[];
  stage: ResearchStage | null;
  t: (key: string, fallback?: string) => string;
}
