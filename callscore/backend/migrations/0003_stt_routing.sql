-- Per-project speech-engine routing. The router (services/stt.py::
-- resolve_order) decides which STT providers run for each interview:
-- explicit project choices win, else the interview language picks a
-- specialist-first order, else the global default. All values are
-- provider names ('deepgram','intron','spitch','assemblyai',
-- 'openai-whisper'); unknown/unconfigured values are skipped safely.
ALTER TABLE call_project_config ADD COLUMN IF NOT EXISTS stt_language TEXT;  -- e.g. 'en','yo','ig','ha','pcm'
ALTER TABLE call_project_config ADD COLUMN IF NOT EXISTS stt_primary TEXT;
ALTER TABLE call_project_config ADD COLUMN IF NOT EXISTS stt_verify TEXT;
