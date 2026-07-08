# ResearchOS — Architecture

Pure engineering. No product philosophy (that's the [BIBLE](01_PRODUCT_BIBLE.md)).

## Repositories & services
| Repo | Service | Stack | Host |
|------|---------|-------|------|
| `researchos-dashboard` | Web app + Ada | React 18 + TypeScript (CRA), inline styles, Framer Motion, Recharts, React-Leaflet | Vercel |
| `fieldscore-backend` | Verification API | Python / Flask | Railway |
| `insightscore` | Qualitative analysis | Python / FastAPI | Railway |

External: **OpenAI** (vision, Whisper, GPT), **KoboToolbox** (intake + media),
**Google Sheets** (submission store), **SQLite / Supabase** (auth store).

## Data flow (Collect → Verify → Deliver)
```
Field platform (Kobo/SurveyCTO/ODK/…)
      │  push: POST /webhook/<org_id>     pull: POST /kobo/import
      ▼
normaliser.py  ── detect platform, map to the FieldScore schema
      ▼
scorer.py  ── engines: gps · timing · image(AI) · audio(Whisper+AI) · duplicate · back-to-back
      ▼                       ▼
score_engine (weighted)   media.py (auth'd fetch)
      ▼
sheets.py  → Google Sheets "Report" tab  (durable store, incl. Org_ID, Detail_JSON)
      ▼                                        ▲
api.py  ──────────────── dashboard reads ──────┘  (cached, org-scoped when multitenant)
      │  optional bridge
      ▼
insightscore  /projects/{id}/ingest → analyse → report (docx/pptx/xlsx)
```

Auth: JWT (`auth.py`, HS256). Org/user store is SQLite by default or Supabase
(`AUTH_BACKEND=supabase`). Submissions persist in Sheets regardless.

---

# The Platform Spine (Phase 1)

The current app hardcodes navigation, terminology, and page structure. Phase 1
replaces that with **metadata-driven resolution**. This is the most important
architectural decision in the product's life — build it once, build it right.

## The No-Hardcoding Rule (law)
Everything below must eventually be **metadata-driven**, never hardcoded:

> navigation · roles · capabilities · settings · dashboard cards · experience
> packs · terminology · integrations · reports · notifications · commands · permissions

**The UI describes itself through metadata.** A screen, a nav item, a label, or a
command that is hardcoded is a bug against this rule — migrate it when touched.

## The resolution pipeline (the heart of ResearchOS)
Everything is an output of one function. Roles, permissions, packs, navigation,
terminology, and dashboards are **not** separate systems — they resolve together:

```
Organization
   ↓
Workspace
   ↓
Project
   ↓
Research Stage        ← Planning · Fieldwork · Cleaning · Analysis · Reporting · Completed
   ↓
Role                  ← CEO · Research Director · Project Manager · Analyst · Field Supervisor · Admin
   ↓
Experience Pack       ← terminology + defaults (industry lens)
   ↓
Licensed Capabilities
   ↓
resolveExperience(context) → ResolvedExperience
```

```ts
interface PlatformContext {
  organization: Organization;
  workspace?: Workspace;
  project?: Project;
  researchStage?: ResearchStage;   // makes the whole platform stage-aware
  role: Role;
  customerType: CustomerType;      // business model — see below
  experiencePack: ExperiencePackId;// industry lens — terminology
  licensedCapabilities: CapabilityId[];
}

interface ResolvedExperience {
  navigation:   NavItem[];         // adaptive sidebar
  homePage:     RouteId;           // role-specific landing
  dashboard:    DashboardCard[];   // role/industry/stage dashboard
  t:            (key: string) => string;  // Experience-Pack terminology
  capabilities: CapabilityId[];    // enabled ∩ licensed
  stage:        ResearchStage | null;
  ada:          AdaContext;        // same context, handed to the Intelligence Layer
}
```

Every surface **consumes** `ResolvedExperience`: sidebar, dashboard, widgets,
search, reports, settings, the pricing page later, and Ada. Nothing hardcodes a
nav item, a label, or a role check again.

## Two independent axes: Customer Type vs Experience Pack
They are different and must not be conflated:

- **Experience Pack (industry)** changes **terminology**: respondent /
  beneficiary / citizen / consumer / patient / student.
- **Customer Type (business model)** changes **workflows and structure**:
  - *Research Agency* — works for clients → needs clients, billing, white-label.
  - *NGO* — needs donors, baseline/endline, M&E.
  - *Corporate* — internal research, no clients.
  - *University* — studies, publications, ethics.
  - *Government* — districts, national surveys.

An NGO and a corporate can share an industry lens yet need different workflows;
an agency and an NGO can serve the same sector with different business models.

## Research Stage (stage-awareness)
`Planning → Fieldwork → Cleaning → Analysis → Reporting → Completed`. The
platform, dashboards, recommendations, navigation, and Ada all read the stage.
ResearchOS never suggests generating a report before interviews exist.

## The Platform Registry (not just capabilities)
Everything declares itself. The Platform Registry is a family of registries:

```
Platform Registry
  ├── Capability Registry     ── what a capability is
  ├── Dashboard Registry      ── cards & widgets per capability/role/stage
  ├── Command Registry        ── ⌘K palette entries (searchable, later executable)
  ├── Settings Registry       ── config schema (Org → Workspace → Project inheritance)
  ├── Integration Registry    ── connectable platforms
  ├── Report Registry         ── report types & formats
  └── Notification Registry   ── event types & intelligence
```

A **Capability** self-describes across all of them:
```ts
interface Capability {
  id: CapabilityId; name: string; description: string;
  requiredLicense: LicenseTier;
  experiencePacks?: ExperiencePackId[];   // where it applies (default: all)
  customerTypes?: CustomerType[];          // where it applies (default: all)
  navigation?: NavItem[];       // sidebar entries
  routes?: RouteDef[];
  dashboardCards?: DashboardCard[];
  widgets?: WidgetDef[];
  commands?: CommandDef[];
  settings?: SettingsSchema;
  integrations?: IntegrationDef[];
  reports?: ReportDef[];
  notifications?: NotificationDef[];
  permissions?: Permission[];
}
```
**The homepage builds itself** from the resolved dashboard cards; the sidebar from
resolved navigation; the palette from resolved commands. Add a capability → it
appears everywhere it's licensed and permitted, with zero page edits.

## Migration: seed only what's proven
Seed the registry from the **working, proven** routes only. **Do not migrate**
dead code, experimental pages, or placeholders — this is an opportunity to
simplify, not to preserve cruft. Backward-compatible by construction: the seed
reproduces today's navigation exactly, then behaviour evolves behind the resolver.

## Incremental rollout (no big-bang, each step ships green)
1. Platform Registry + `resolveExperience`, seeded from proven routes (nav identical).
2. Sidebar reads resolved navigation.
3. Terminology → `t()` (IndustryContext is the seed).
4. Dashboard Registry → role/stage home pages.
5. Settings split + Org→Workspace→Project inheritance.
6. Command Registry → ⌘K palette.
7. Migrate remaining proven pages into capabilities; delete the rest.

## Guardrail
Every layer must solve a **today** problem while making tomorrow easier. If a
layer is elegant but earns nothing now, defer it. Architecture serves the product,
not the reverse. Record the *why* for each accepted layer in
[DECISIONS](11_DECISIONS.md).
