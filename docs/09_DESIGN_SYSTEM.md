# ResearchOS — Design System

One system. No per-page reinvention. The code source of truth is
`src/styles/tokens.ts` and `src/components/ui/`.

## Tokens (`src/styles/tokens.ts`)
- **Colours** — blue `#2463EB`, green `#059669`, amber `#D97706`, red `#DC2626`,
  purple `#7C3AED`, cyan `#06B6D4`, ink `#080D1A`; plus surface/line/muted.
- **Helpers** — `scoreColor(0-100)`, `verdictColor(PASS|FLAG|REJECT)`.
- **Card** — white, radius 16, `1px solid #E8EDF5`, soft shadow.
- **Label** — 10.5px, 700, uppercase, letter-spacing, muted.
- **Buttons** — primary (blue) / ghost (bordered white).
- **Dark gradient** — the Ada hero / plan-card background.

## Components (`src/components/ui/`)
Shared, reusable: `ScoreRing`, `EngineBar`, `VerdictBadge` (extracted). To lift the
same way: `KpiCard`, `AdaBriefingCard`, `PageHeader`, `CapacityBar`,
`SettingsSection`, `DataTable`.

## Principles
- Inline styles, driven by tokens — no Tailwind.
- Calm and premium: evidence over decoration; motion is subtle and purposeful.
- Theme-consistent: every metric colour comes from `scoreColor`/`verdictColor`.
- Responsive: key views (Overview, Submissions, Detail) stack on mobile via
  `useIsMobile`.
- Brand: the ResearchOS wordmark on dark; the "OS" globe as the app/favicon mark.

*(To expand: spacing scale, typography ramp, motion spec, accessibility, dark
mode, and the full component gallery.)*
