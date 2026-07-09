/**
 * Utility functions for question management, deduplication, and library integration
 */

import { Question, QuestionCard, DeduplicationWarning, QuestionnaireQuestion } from './types';

// ============================================================================
// Text Similarity & Deduplication
// ============================================================================

export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

export function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (str: string) => str.toLowerCase().trim();
  const s1 = normalize(text1);
  const s2 = normalize(text2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return Math.max(0, 1 - distance / maxLength);
}

export function detectDuplicates(
  newQuestionText: string,
  existingQuestions: QuestionnaireQuestion[],
  allQuestions: Map<string, Question>,
  threshold = 0.75
): DeduplicationWarning | null {
  for (const existing of existingQuestions) {
    const existingQuestion = allQuestions.get(existing.questionId);
    if (!existingQuestion) continue;

    const similarity = calculateSimilarity(newQuestionText, existingQuestion.text);

    if (similarity >= threshold) {
      return {
        existingQuestionId: existing.questionId,
        existingQuestionText: existingQuestion.text,
        existingQuestionPosition: existing.position,
        similarity,
        suggestedAction: 'reuse',
      };
    }
  }

  return null;
}

// ============================================================================
// Question Card Formatting
// ============================================================================

export function questionToCard(question: Question): QuestionCard {
  return {
    id: question.id,
    text: question.text,
    description: question.description,
    type: question.type,
    tags: question.tags,
    options: question.options,
    metadata: question.metadata,
    usageCount: question.metadata.usageCount,
    rating: question.metadata.rating,
  };
}

// ============================================================================
// Export utilities
// ============================================================================

export function exportQuestions(questions: Question[]): string {
  return JSON.stringify(
    questions.map(q => ({
      text: q.text,
      description: q.description,
      type: q.type,
      tags: q.tags,
      options: q.options,
      rating: q.metadata.rating,
      usageCount: q.metadata.usageCount,
    })),
    null,
    2
  );
}

export function exportQuestionsToCSV(questions: Question[]): string {
  const headers = ['Question Text', 'Type', 'Tags', 'Usage Count', 'Rating', 'Description'];
  const rows = questions.map(q => [
    `"${q.text.replace(/"/g, '""')}"`,
    q.type,
    q.tags.join(';'),
    q.metadata.usageCount,
    q.metadata.rating.toFixed(1),
    `"${(q.description || '').replace(/"/g, '""')}"`,
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// ============================================================================
// Analytics & Recommendations
// ============================================================================

export function getMostUsedTags(questions: Question[], limit = 10): { tag: string; count: number }[] {
  const tagCounts: Record<string, number> = {};
  questions.forEach(q => {
    q.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
  });
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getHighestRatedQuestions(questions: Question[], limit = 10): Question[] {
  return [...questions]
    .filter(q => q.metadata.rating > 0)
    .sort((a, b) => b.metadata.rating - a.metadata.rating)
    .slice(0, limit);
}

export function getMostUsedQuestions(questions: Question[], limit = 10): Question[] {
  return [...questions]
    .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
    .slice(0, limit);
}

export function recommendQuestions(
  questionnaireTopics: string[],
  availableQuestions: Question[],
  limit = 5
): Question[] {
  const scored = availableQuestions.map(q => {
    const tagMatches = q.tags.filter(tag => questionnaireTopics.includes(tag)).length;
    const usageScore = q.metadata.usageCount / 100;
    const ratingScore = q.metadata.rating / 5;
    return { question: q, score: tagMatches * 2 + usageScore * 0.5 + ratingScore * 0.5 };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.question);
}
