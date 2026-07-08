import {
  LayoutDashboard, FileText, Users, Map, Sparkles, ClipboardList, BookOpen, Puzzle, Settings,
} from "lucide-react";
import { Capability, CapabilityId, LicenseTier, NavSectionRef } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// The Platform (Capability) Registry — seeded from the PROVEN, working routes
// only (ADR-008). No dead/experimental/placeholder pages. Adding a capability
// makes it appear everywhere it's licensed and permitted, with no page edits.
// The seed reproduces today's sidebar exactly (backward compatible).
// ─────────────────────────────────────────────────────────────────────────

const WORKSPACE: NavSectionRef = { id: "workspace", label: "WORKSPACE", order: 0 };
const INTELLIGENCE: NavSectionRef = { id: "intelligence", label: "INTELLIGENCE", order: 1 };
const PROJECT: NavSectionRef = { id: "project", label: "PROJECT", order: 2 };

export const CAPABILITIES: Capability[] = [
  {
    id: "overview", name: "Overview", description: "Research overview and KPIs",
    requiredLicense: "starter", alwaysOn: true,
    navigation: [{ to: "/overview", label: "Overview", icon: LayoutDashboard, section: WORKSPACE, order: 0 }],
  },
  {
    id: "fieldscore", name: "FieldScore", description: "Field data quality verification",
    requiredLicense: "starter",
    navigation: [
      { to: "/submissions", label: "Submissions", icon: FileText, section: WORKSPACE, order: 1 },
      { to: "/enumerators", label: "Enumerators", icon: Users, section: WORKSPACE, order: 2, labelKey: "enumerators" },
      { to: "/map", label: "Coverage Map", icon: Map, section: WORKSPACE, order: 3 },
    ],
  },
  {
    id: "insightscore", name: "InsightScore", description: "Qualitative analysis",
    requiredLicense: "professional",
    navigation: [{ to: "/insights", label: "AI Analysis", icon: Sparkles, section: INTELLIGENCE, order: 0 }],
  },
  {
    id: "questionnaire", name: "Questionnaire", description: "AI questionnaire design",
    requiredLicense: "professional",
    navigation: [{ to: "/questionnaire", label: "Questionnaire", icon: ClipboardList, section: INTELLIGENCE, order: 1 }],
  },
  {
    id: "reports", name: "Reports", description: "Report generation and delivery",
    requiredLicense: "starter",
    navigation: [{ to: "/reports", label: "Reports", icon: BookOpen, section: INTELLIGENCE, order: 2 }],
  },
  {
    id: "integrations", name: "Integrations", description: "Connect data platforms",
    requiredLicense: "starter",
    navigation: [{ to: "/integrations", label: "Integrations", icon: Puzzle, section: PROJECT, order: 0 }],
  },
  {
    id: "settings", name: "Settings", description: "Configuration",
    requiredLicense: "starter", alwaysOn: true,
    navigation: [{ to: "/settings", label: "Settings", icon: Settings, section: PROJECT, order: 1 }],
  },
];

export const ALL_CAPABILITY_IDS = CAPABILITIES.map(c => c.id);

// Which capabilities a plan licenses (ADR-011). Gating is by requiredLicense.
// Backward-compatibility safety: a missing/unknown plan and `trial` get FULL
// access, so existing sessions and trials never lose features. `enterprise`
// gets everything. Only the named lower tiers (`starter`, `professional`) are
// actually gated — which matches what those plans are sold (07_PRICING).
const TIER_RANK: Record<LicenseTier, number> = { starter: 0, professional: 1, enterprise: 2 };

export function capabilitiesForPlan(plan?: string | null): CapabilityId[] {
  if (!plan || plan === "trial" || plan === "enterprise") return ALL_CAPABILITY_IDS;
  const rank = TIER_RANK[plan as LicenseTier];
  if (rank === undefined) return ALL_CAPABILITY_IDS; // unknown → don't hide anything
  return CAPABILITIES.filter(c => TIER_RANK[c.requiredLicense] <= rank).map(c => c.id);
}
