import { Capability, NavItem, NavSection, PlatformContext, ResolvedExperience } from "./types";
import { CAPABILITIES } from "./registry";
import { makeT } from "./packs";

// resolveExperience(context) → ResolvedExperience  (ADR-001)
// The single function every surface consumes. Pure and testable.

function isLicensed(cap: Capability, ctx: PlatformContext): boolean {
  return !!cap.alwaysOn || ctx.licensedCapabilities.includes(cap.id);
}

function appliesTo(cap: Capability, ctx: PlatformContext): boolean {
  if (cap.experiencePacks && !cap.experiencePacks.includes(ctx.experiencePack)) return false;
  if (cap.customerTypes && !cap.customerTypes.includes(ctx.customerType)) return false;
  return true;
}

function permitted(permission: string | undefined, ctx: PlatformContext): boolean {
  if (!permission) return true;
  if (!ctx.permissions) return true; // undefined permissions = admin / all
  return ctx.permissions.includes(permission);
}

// Title-case an industry term for use as a label ("field officers" → "Field Officers").
function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export function resolveExperience(
  ctx: PlatformContext,
  capabilities: Capability[] = CAPABILITIES,
): ResolvedExperience {
  const active = capabilities.filter(c => isLicensed(c, ctx) && appliesTo(c, ctx));
  const t = makeT(ctx.experiencePack);

  // Navigation: gather nav items from active capabilities, grouped by section.
  const flat: { sectionId: string; sectionLabel: string; sectionOrder: number; order: number; item: NavItem }[] = [];
  for (const cap of active) {
    for (const nav of cap.navigation || []) {
      if (!permitted(nav.permission, ctx)) continue;
      // Industry-adaptive label: t() falls back to the static label when the
      // pack has no term, so default (research_agency) reproduces today's text.
      const label = nav.labelKey ? titleCase(t(nav.labelKey, nav.label)) : nav.label;
      flat.push({
        sectionId: nav.section.id,
        sectionLabel: nav.section.label,
        sectionOrder: nav.section.order,
        order: nav.order,
        item: { to: nav.to, label, icon: nav.icon, capabilityId: cap.id },
      });
    }
  }
  const sections = new Map<string, NavSection>();
  for (const f of flat) {
    if (!sections.has(f.sectionId)) {
      sections.set(f.sectionId, { id: f.sectionId, label: f.sectionLabel, order: f.sectionOrder, items: [] });
    }
  }
  for (const f of [...flat].sort((a, b) => a.order - b.order)) {
    sections.get(f.sectionId)!.items.push(f.item);
  }
  const navigation = Array.from(sections.values()).sort((a, b) => a.order - b.order);

  // Dashboard: role/stage-aware cards (Dashboard Registry — filled incrementally).
  const dashboard = active.flatMap(c => (c.dashboardCards || []).filter(card =>
    (!card.roles || card.roles.includes(ctx.role)) &&
    (!card.stages || !ctx.researchStage || card.stages.includes(ctx.researchStage))
  ));

  return {
    navigation,
    homePage: navigation[0]?.items[0]?.to || "/overview",
    dashboard,
    capabilities: active.map(c => c.id),
    stage: ctx.researchStage ?? null,
    t,
  };
}
