/**
 * Shared types for questionnaire question library components
 */

export type QuestionType = 'multiple-choice' | 'text' | 'scale' | 'ranking' | 'matrix';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  text: string;
  description?: string;
  type: QuestionType;
  tags: string[];
  options?: QuestionOption[];
  metadata: {
    usageCount: number;
    rating: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface QuestionCard extends Question {
  usageCount: number;
  rating: number;
  isUsedInThisQuestionnaire?: boolean;
}

export interface QuestionnaireQuestion {
  questionId: string;
  position: number;
  isVariant: boolean;
  originalQuestionId?: string;
}

export interface SearchFilters {
  searchTerm?: string;
  tags?: string[];
  type?: QuestionType | 'all';
}

export interface DeduplicationWarning {
  existingQuestionId: string;
  existingQuestionText: string;
  existingQuestionPosition: number;
  similarity: number;
  suggestedAction: 'reuse' | 'variant' | 'add';
}
