# Staged Rollout Plan

Every capability ships dark and is switched on per wave, after testing —
"we are moving forward" without exposing anything unproven. Two gate
layers, and the rule is: **UI gates hide, server gates enforce.** A
feature is only "on" when both agree.

## Gate inventory

| Capability | Server gate (Railway env) | UI gate (Vercel env) | Default |
|---|---|---|---|
| Call mode (human remote interviews) | always on once service deployed | `REACT_APP_CALL_MODE_ENABLED` (`false` hides Call tab + Verify queue entry) | **on** |
| Agent mode (AI interviews) | `AGENT_MODE_ENABLED` + Vapi keys | `REACT_APP_AGENT_MODE_ENABLED` (`true` shows 🤖 tab) | **off / hidden** |
| STT providers | `DEEPGRAM_API_KEY` / `INTRON_API_KEY` / `SPITCH_API_KEY` / `ASSEMBLYAI_API_KEY` | n/a (invisible to users) | off |
| LLM judgment agents | `OPENAI_API_KEY` | n/a | off |
| Translation + Ada TTS | `SPITCH_API_KEY` (or OpenAI for translation) | n/a | off |
| AI back-check calls | Vapi keys | AI button degrades to "use human" when off | off (human always on) |
| PII-bearing respondent import | `CONSENT_ENCRYPTION_KEY` | n/a — import fails closed | off |

`GET /health` reports the live server-side state of every gate — use it
as the release checklist before flipping any UI flag.

## Suggested waves

**Wave 0 — deploy dark (now).** Merge, deploy service + dashboard with
`REACT_APP_CALL_MODE_ENABLED=false`. Production users see zero change;
the team pilots Call mode against production infrastructure.

**Wave 1 — Call mode.** After internal pilot interviews score correctly:
flip the UI flag. Announceable: remote interviews, offline app, review
queue, human back-checks.

**Wave 2 — intelligence.** After the language benchmark picks providers:
add STT/LLM keys. Existing interviews start getting transcripts,
findings, Ada summaries. Announceable: AI verification agents.

**Wave 3 — language layer.** Spitch key + per-project languages:
translation, localized Ada, TTS. Announceable: any-language interviews.

**Wave 4 — Agent mode.** After Vapi pilot calls + regulatory check
(caller ID, robocall rules per country): both agent gates on.
Announceable: AI-conducted interviews as a distinct product tier.

Each wave is independently reversible — unset the env var, redeploy,
and the wave is gone without touching code.
