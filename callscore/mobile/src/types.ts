export interface Respondent {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  metadata: Record<string, unknown> | null;
}

export interface QuestionnaireItem {
  question_key: string;
  question_text: string;
  is_required: boolean;
  sort_order: number;
  question_type?: 'text' | 'numeric' | 'select_one' | 'select_multiple';
  choices?: { name: string; label: string }[] | null;
}

// One Start/Stop cycle — the core unit (Bible 5.1). Stored locally first
// (offline-first, Design Principle 5); the id is generated on this device
// so retried uploads are idempotent (Bible 5.3).
export interface LocalSession {
  id: string;
  org_id: string;
  project_id: string;
  respondent_id: string;
  respondent_name: string;
  enumerator_id: string;
  started_at: string | null;
  stopped_at: string | null;
  consent_uri: string | null;   // local recording file — the hard gate
  audio_uri: string | null;     // local interview recording file
  // Fields confirmed from the enumerator's call-screen screenshot, plus
  // the image itself (screenshot_uri) — upgraded from fields-only by
  // founder decision: the image (number + duration + timestamp in one
  // shot) is the ironclad proof, and we already store full audio.
  screenshot_fields: { number?: string; name?: string } | null;
  screenshot_uri?: string | null;
  answers: Record<string, string>;
  sync_status: 'local' | 'pending' | 'syncing' | 'synced' | 'failed';
  created_at: string;
}
