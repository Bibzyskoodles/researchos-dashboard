import React, { createContext, useContext, useMemo } from "react";
import { useIndustry } from "../store/IndustryContext";
import { useAuth } from "../store/AuthContext";
import { resolveExperience } from "./resolve";
import { capabilitiesForPlan } from "./registry";
import { PlatformContext as PCtx, ResolvedExperience, Role, ExperiencePackId, CustomerType } from "./types";

// Provides the single ResolvedExperience the whole UI consumes (ADR-001).
// Context is now derived from real auth data — the signed-in user's role and
// the organisation's plan (ADR-011). Licensing is backward-compatible: trial
// and unknown/missing plans get full access, so no current session loses
// features. Customer-type and research-stage remain generous until an org
// profile / active-project source exists.

const Ctx = createContext<ResolvedExperience | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const { industry } = useIndustry();
  const { user, org } = useAuth();

  const resolved = useMemo(() => {
    const ctx: PCtx = {
      role: (user?.role as Role) || "admin",
      customerType: "research_agency" as CustomerType,       // TODO: from org profile
      experiencePack: industry as ExperiencePackId,           // IndustryContext is the seed
      licensedCapabilities: capabilitiesForPlan(org?.plan),   // real: from org plan
      researchStage: null,                                    // TODO: from active project
      permissions: undefined,                                 // role-based gating deferred (ADR-011)
    };
    return resolveExperience(ctx);
  }, [industry, user, org]);

  return <Ctx.Provider value={resolved}>{children}</Ctx.Provider>;
}

export function usePlatform(): ResolvedExperience {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlatform must be used within PlatformProvider");
  return v;
}
