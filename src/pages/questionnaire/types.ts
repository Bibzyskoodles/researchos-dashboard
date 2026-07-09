export type QuestionType =
  | 'open'
  | 'select'
  | 'multi_select'
  | 'scale'
  | 'number'
  | 'date'
  | 'audio'
  | 'image'
  | 'gps'
  | 'ranking'
  | 'matrix';

export interface SkipLogic {
  sourceQuestionId: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_labels?: Record<string, string>;
  matrix_rows?: string[];
  matrix_columns?: string[];
  interviewer_instruction?: string;
  skip_logic?: string;
  validation?: string;
  methodological_flag?: string;
  ada_note?: string;
}

export interface Section {
  id: string;
  title: string;
  purpose?: string;
  questions: Question[];
}

export interface QualityIssue {
  type: 'leading_question' | 'double_barrelled' | 'ambiguous' | 'sensitive' | 'ordering_bias' | 'platform_incompatible' | 'missing_skip_logic';
  question_id: string;
  issue: string;
  suggestion: string;
}

export interface GeneratedQuestionnaire {
  id?: string;
  title: string;
  estimated_duration_mins: number;
  methodology_notes?: string;
  sections: Section[];
  quality_checks?: QualityIssue[];
  xlsform_notes?: string;
}

export interface ConsultationState {
  decision: string | null;
  audience: string | null;
  context: string | null;
  duration_mins: number | null;
  language: string | null;
  platform: string | null;
  literacy_level: 'high' | 'medium' | 'low' | null;
  interview_mode: 'face_to_face' | 'phone' | 'self_complete' | null;
  sensitivity: 'low' | 'medium' | 'high' | null;
  ready_to_generate: boolean;
}

export interface QuestionnaireState {
  phase: 'consultation' | 'generating' | 'workspace' | 'export';
  consultation: ConsultationState;
  questionnaire: GeneratedQuestionnaire | null;
  selectedQuestionId: string | null;
  selectedSectionId: string | null;
  unsavedChanges: boolean;
  qualityIssues: QualityIssue[];
  adaContext: string;
}
