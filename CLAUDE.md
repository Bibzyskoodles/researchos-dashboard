# researchos-dashboard

React/TypeScript frontend for FieldScore — dashboard, project lifecycle UI,
Ada's chat interface, and Settings.

## Before working on this repo

The backend repo (`fieldscore-backend`) carries the actual security
constitution — `SECURITY.md` and `AI_SECURITY.md` — since almost every real
enforcement point (auth, tenant isolation, ownership checks) lives there.
Read those first if the change touches anything security-relevant. This
file only covers what's specific to the frontend.

## Non-negotiables

- **Never ship a third-party API key via `REACT_APP_*`.** Anything with
  that prefix is compiled into the public JS bundle and readable by any
  visitor via devtools — this already happened once (an ElevenLabs key)
  and was fixed by moving the call server-side (`services/tts.ts` →
  `fieldscore-backend`'s `/ada/speak`). If a new feature needs a paid
  third-party API, add a backend proxy route that holds the key, the same
  way `certificateApi`/`insightScoreApi`/TTS already do — don't call the
  provider directly from the browser.
- **This backend authenticates via Bearer header, not a session cookie.**
  No `fs_token` cookie is ever set by the server (`auth.py`/`auth_routes.py`
  have no `set_cookie` call) — the fallback cookie checks in backend auth
  code are dead paths. A plain `<a href>`/`window.open(url)` to a backend
  route will NOT carry auth. Fetch through the `api` axios instance (which
  attaches the Bearer token via its interceptor) and hand the browser the
  result directly — see `certificatePrint.ts`'s `openCertificate()` for the
  pattern (fetch as text/blob, then `document.write` or a Blob-URL
  download).
- **UI-level role/plan gating is a nicety, not the enforcement.** `Sidebar.tsx`
  hides nav items for `role === 'client'`, and `platform/registry.ts` gates
  capabilities by billing plan — both are just so the UI doesn't show dead
  ends. The real enforcement is server-side (`project_allowed()` and friends
  in `fieldscore-backend`); never assume hiding a button in this repo is
  sufficient protection for anything.
- **CSV/Excel exports must sanitize free-text cells.** Use
  `sanitizeCsvCell()` from `services/csvImport.ts` on any field that
  ultimately traces back to submission/enumerator data before writing a
  CSV — a leading `=`/`+`/`-`/`@` is interpreted as a formula by
  Excel/Sheets when the file is reopened.

## Verifying a change before pushing

**`npx tsc --noEmit -p .` is necessary but not sufficient — it does not
run ESLint.** Vercel builds this repo with `CI=true`, which makes CRA's
`react-scripts build` treat every ESLint warning (unused vars/imports,
`react-hooks/exhaustive-deps`, etc.) as a hard build failure. This
already happened for real: commit `245b8c2` shipped with tsc passing but
an unused `ExternalLink` import, and every deploy for the next 2+ hours
and 6 commits failed in production before anyone noticed (fixed in
`75d41c0`). Before pushing anything touching `.tsx`/`.ts` files, run the
actual build Vercel runs — `CI=true npm run build` — not just tsc. It's
slower (needs `npm ci` if `node_modules` isn't already installed) but
it's the only thing that reproduces what Vercel will actually do.

## Where things live

- `services/api.ts` — every backend call. `certificateApi`, `insightScoreApi`
  (routed through `fieldscore-backend`'s authenticated proxy, not
  InsightScore directly), `orgSettingsApi` (invites, including the `client`
  role's project grants).
- `ada/` — Ada's command dispatch (`AdaContext.tsx`), client-side prompt
  guards (`adaSafeguards.ts` — a speed/UX layer, not the real defense).
- `gamify/` — credits/milestones UX, including the certificate issue flow
  (`DataIntegrityCard.tsx`, `certificatePrint.ts`).
