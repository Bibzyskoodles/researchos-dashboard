# CallScore — Enumerator App (Device 2)

React Native (Expo) app implementing the MVP scope from the Architecture
Bible Part 10: standalone Device 2 app, manual screenshot attach, full
offline queuing. The CallScore Link companion app (Device 1, BLE
call-state, on-device OCR) is a V1 item and is **not** part of this app.

## The flow (Bible 2.3)

1. Sign in with the same FieldScore account used everywhere else
2. Enter the project ID once; pick the assigned respondent (list cached
   for offline days)
3. **Consent screen** — script displayed verbatim, recorded as its own
   artifact. Hard gate: no consent recording, no Start Interview.
4. **Start Interview** — deliberate press, anchor timestamp #1; audio
   capture begins; questionnaire renders as Glance-Confirm rows
5. Manual call-screen evidence: enumerator confirms the dialled number;
   any screenshot stays on-device, never uploads (Bible 6.1)
6. **Stop Interview** — anchor timestamp #2; required-question check;
   session saved to SQLite and queued
7. Sync happens whenever connectivity exists — automatically on
   reconnect, or manually from the Sync Queue screen. Uploads are
   idempotent on the device-generated session id (Bible 5.3).

## Run it

```bash
cd callscore/mobile
npm install
npm run typecheck   # tsc --noEmit
npm start           # Expo dev server; scan QR with Expo Go
```

Backend URLs are in `src/api/client.ts` (`FIELDSCORE_URL`, `CALLSCORE_URL`).

## Design-principle enforcement map

| Principle (Bible Part 3) | Where |
|---|---|
| 2 — Consent hard gate | `ConsentScreen` gates navigation; server rejects bundles without a consent artifact |
| 3 — Deliberate Start/Stop | `InterviewScreen` button presses are the only way timestamps exist |
| 4 — Communication-agnostic | No call APIs anywhere; the phone call happens on whatever Device 1 is |
| 5 — Offline-first | SQLite system of record, NetInfo-triggered idempotent sync |
| 6 — Minimum permission | Mic + photo picker only, each justified in `app.json` |
| 7 — Cognitive load | One linear flow; Glance-Confirm rows render instantly (8.5) |

## Known MVP gaps (tracked honestly)

- **Audio bytes don't upload yet.** Artifacts sync with `device://` refs +
  structured payloads; recordings stay on-device until the backend gets a
  signed-URL upload route (object storage). This is the next backend task.
- Questionnaire items are placeholders — wire to `questionnaire_items`
  once XLSForm import (backend `routes/projects.py`) is implemented.
- Consent script is a placeholder — must come from project config,
  localized per jurisdiction (Bible Part 7).
- Glance-Confirm `settled`/`confirm` states exist in the component but MVP
  runs all-manual; they activate when the on-device copilot pre-fill ships.
- Project selection is a one-time manual ID entry; replace with
  assignment-driven lists alongside the trust-record query work.
- No storage-cap warning yet (Bible 6.4) — add before field pilots.
