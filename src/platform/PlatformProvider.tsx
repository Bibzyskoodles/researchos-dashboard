import React, { createContext, useContext, useMemo } from "react";
import { useIndustry } from "../store/IndustryContext";
import { useAuth } from "../store/AuthContext";
import { resolveExperience } from "./resolve";
import { ALL_CAPABILITY_IDS } from "./registry";
import { PlatformContext as PCtx, ResolvedExperience, Role, ExperiencePackId, CustomerType } from "./types";

// Provides the single ResolvedExperience the whole UI consumes (ADR-001).
// For now the context is generous (all capabilities licensed, admin permissions)
// so behaviour is identical to today; org plan / role / customer-type will
// tighten it in later steps without touching consumers.

const Ctx = createContext<ResolvedExperience | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const { industry } = useIndustry();
  const { user } = useAuth();

  const resolved = useMemo(() => {
    const ctx: PCtx = {
      role: (user?.role as Role) || "admin",
      customerType: "research_agency" as CustomerType, // TODO: from org profile
      experiencePack: industry as ExperiencePackId,     // IndustryContext is the seed
      licensedCapabilities: ALL_CAPABILITY_IDS,         // TODO: from org plan
      researchStage: null,                              // TODO: from active project
      permissions: undefined,                           // admin / all for now
    };
    return resolveExperience(ctx);
  }, [industry, user]);

  return <Ctx.Provider value={resolved}>{children}</Ctx.Provider>;
}

export function usePlatform(): ResolvedExperience {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlatform must be used within PlatformProvider");
  return v;
}
