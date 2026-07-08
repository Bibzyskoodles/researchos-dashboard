// ─────────────────────────────────────────────────────────────────────────
// ResearchOS — AI model configuration
//
// Single source of truth for which model handles which task. Backend endpoints
// that call OpenAI should reference the same task keys so the model used is
// consistent (and can be logged in submission metadata).
//
// Keep the most capable model for reasoning-heavy tasks (analysis, report
// writing, Ada conversation) and a cheaper/faster model for short, mechanical
// tasks (quick summaries, translation).
// ─────────────────────────────────────────────────────────────────────────

export const AI_MODELS = {
  ada_chat: "gpt-4o",                    // Ada conversation — most capable
  ada_brief: "gpt-4o",                   // Morning briefing — most capable
  theme_extraction: "gpt-4o",            // InsightScore analysis — most capable
  report_writing: "gpt-4o",              // Report generation — most capable
  quick_summary: "gpt-4o-mini",          // Short summaries — faster/cheaper
  questionnaire_suggestions: "gpt-4o",   // Question generation
  translation: "gpt-4o-mini",            // Translation tasks
} as const;

export type AiTask = keyof typeof AI_MODELS;

export function modelFor(task: AiTask): string {
  return AI_MODELS[task];
}
