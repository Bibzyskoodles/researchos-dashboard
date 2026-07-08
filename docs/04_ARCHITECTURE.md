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

## The platform spine (Phase 1 target)

The current app hardcodes navigation, terminology, and page structure. Phase 1
replaces that with **one metadata-driven resolution pipeline**. This is the
single most important architectural decision in the product's life — build it once,
build it right.

### One resolver, not four systems
Navigation, role experiences, and experience packs are **not** separate features.
They are outputs of one function:

```
resolveExperience(context) → ResolvedExperience

context = {
  organization, workspace, project,
  role, experiencePack, licensedCapabilities
}

ResolvedExperience = {
  navigation:   NavItem[]        // adaptive sidebar
  homePage:     RouteId          // role-specific landing
  dashboard:    CardId[]         // role/industry dashboard cards
  terminology:  (key) => string  // Experience-Pack vocabulary, t()
  capabilities: CapabilityId[]   // what's enabled + licensed
  ada:          AdaContext       // same context, handed to the Intelligence Layer
}
```

Every page, the sidebar, and Ada **consume** `ResolvedExperience`. Nothing
hardcodes a nav item, a label, or a role check again.

### 1. Capability Registry
Every capability describes itself in typed metadata:
```ts
interface Capability {
  id: string;                 // "fieldscore" | "insightscore" | "questionnaire" | …
  name: string;
  description: string;
  routes: RouteDef[];
  sidebar: SidebarItem[];
  permissions: Permission[];
  requiredLicense: LicenseTier;
  experiencePacks: PackId[];  // where it applies
  settings?: SettingsSchema;
  dashboardCards?: CardDef[];
  widgets?: WidgetDef[];
}
```
The registry is **seeded from the existing routes/pages first** — so behaviour is
identical on day one — then hardcoded nav/pages migrate into it incrementally.

### 2. Experience Packs (terminology + defaults)
```ts
interface ExperiencePack {
  id: "research_agency" | "ngo" | "government" | "healthcare" | "education" | "fmcg";
  terminology: Record<string, string>;   // respondent → beneficiary/citizen/…
  defaultMetrics: MetricId[];
  defaults: ResearchConfig;               // seeds Research Configuration
}
```
Terminology is a resolver `t(key)` — i18n applied to industry. `IndustryContext`
(already live) is the seed of this; Phase 1 promotes it into the pipeline.

### 3. Role experiences
Roles resolve to a **home page + dashboard set**, not just hidden buttons:
CEO → Executive Summary / Portfolio / Impact / At-Risk; Research Director →
Capacity / Portfolio / Quality Trends; Project Manager → Progress / Tasks /
Deliverables; Analyst → Assigned Projects / Analysis / Reports; Field Supervisor →
Coverage / GPS / Fraud / Enumerator Performance.

### 4. Settings hierarchy (inheritance)
`Research Configuration` resolves **Organization → Workspace → Project**, each
level overriding the last. Organization Settings vs Project Settings are distinct
surfaces reading the same schema.

### 5. Global command palette (⌘K)
Searches projects, users, settings, reports, templates, integrations, docs —
permission-filtered — and later **executes** ("Create Project", "Connect Kobo",
"Open GPS Settings").

### 6. Ada as a consumer of the spine
Ada receives the same `context`/`ResolvedExperience`, so her language, her
suggestions, and her command palette are automatically correct per industry and
role. Ada is the Intelligence Layer sitting on the platform context — not a
sidecar. See [ADA_BIBLE](08_ADA_BIBLE.md).

### Engineering principles for the spine
Modular · metadata-driven · strongly typed · reusable · enterprise-scalable ·
**backward compatible**. No hardcoded navigation, terminology, roles, or pages.
A new capability should be a registry entry plus its components — minimal wiring.

### Incremental rollout (no big-bang)
1. Introduce the registry + resolver, seeded from current routes (behaviour identical).
2. Sidebar reads resolved navigation (still the same items).
3. Terminology moves to `t()` (already started).
4. Role home pages added behind the resolver.
5. Settings split + inheritance.
6. Command palette.
7. Migrate remaining hardcoded pages into capabilities.
Each step ships independently and green (`CI=true npm run build`).
