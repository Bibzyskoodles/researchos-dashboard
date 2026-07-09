/**
 * Utility functions for question management, deduplication, and library integration
 */

import { Question, QuestionCard, DeduplicationWarning, QuestionnaireQuestion } from './types';

// ============================================================================
// Text Similarity & Deduplication
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for detecting duplicate or near-duplicate questions
 */
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

/**
 * Calculate similarity score between 0 and 1
 * Normalize Levenshtein distance to similarity percentage
 */
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

/**
 * Detect potential duplicates in a questionnaire
 * Returns warnings for questions above the similarity threshold
 */
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

/**
 * Convert a Question to a QuestionCard (display-friendly format)
 */
export function questionToCard(question: Question): QuestionCard {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    tags: question.tags,
    usageCount: question.metadata.usageCount,
    rating: question.metadata.rating,
    isUsedInThisQuestionnaire: false, // Set by consumer based on context
  };
}

/**
 * Create a preview excerpt of question text
 * Truncates to specified length and adds ellipsis if needed
 */
export function getPreviewText(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '…';
}

// ============================================================================
// Library Management
// ============================================================================

/**
 * Group questions by tag for filtering UI
 */
export function groupQuestionsByTag(questions: Question[]): Record<string, Question[]> {
  const groups: Record<string, Question[]> = {};

  questions.forEach(q => {
    if (q.tags.length === 0) {
      groups['uncategorized'] = groups['uncategorized'] || [];
      groups['uncategorized'].push(q);
    } else {
      q.tags.forEach(tag => {
        groups[tag] = groups[tag] || [];
        groups[tag].push(q);
      });
    }
  });

  return groups;
}

/**
 * Sort questions by multiple criteria
 */
export function sortQuestions(
  questions: QuestionCard[],
  sortBy: 'relevance' | 'usage' | 'rating' | 'recent' = 'relevance'
): QuestionCard[] {
  const sorted = [...questions];

  switch (sortBy) {
    case 'usage':
      return sorted.sort((a, b) => b.usageCount - a.usageCount);
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'recent':
      // Assume recency is embedded in ID or metadata
      return sorted.reverse();
    case 'relevance':
    default:
      return sorted;
  }
}

// ============================================================================
// Question Variant Management
// ============================================================================

/**
 * Create a variant of a question (copy with modifications)
 * Variants reference the original but can be edited independently
 */
export function createQuestionVariant(
  original: Question,
  modifications: Partial<Question>
): Question {
  return {
    ...original,
    id: `${original.id}_variant_${Date.now()}`,
    metadata: {
      ...original.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...modifications,
  };
}

/**
 * Check if question is a variant of another
 */
export function isVariant(questionId: string): boolean {
  return questionId.includes('_variant_');
}

/**
 * Get the original question ID from a variant
 */
export function getOriginalQuestionId(variantId: string): string | null {
  const match = variantId.match(/^(.+?)_variant_/);
  return match ? match[1] : null;
}

// ============================================================================
// Question Sync & Updates
// ============================================================================

/**
 * Sync a question variant with its library version
 * If variant hasn't been modified, update it to match library
 * If variant has diverged, keep local version
 */
export async function syncQuestionVariant(
  variantId: string,
  libraryVersion: Question,
  localVersion: Question,
  updateFn: (id: string, data: Partial<Question>) => Promise<void>
): Promise<boolean> {
  // Compare local modifications to determine if user changed it
  const hasLocalModifications =
    localVersion.text !== libraryVersion.text ||
    localVersion.type !== libraryVersion.type ||
    JSON.stringify(localVersion.tags) !== JSON.stringify(libraryVersion.tags);

  if (!hasLocalModifications) {
    // Safe to update
    await updateFn(variantId, libraryVersion);
    return true;
  }

  // User modified local version; skip sync
  return false;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Import multiple questions from CSV or JSON
 * Format: { text, type, tags, description, options }
 */
export function importQuestions(
  data: any[],
  userId: string
): (Omit<Question, 'id' | 'metadata' | 'questionnaireIds'> & { metadata: Omit<Question['metadata'], 'createdAt' | 'updatedAt'> })[] {
  return data
    .filter(item => item.text && item.type) // Validate required fields
    .map(item => ({
      text: item.text.trim(),
      type: item.type as Question['type'],
      tags: item.tags || [],
      description: item.description,
      options: item.options,
      isPublic: item.isPublic !== false,
      metadata: {
        createdBy: userId,
        usageCount: 0,
        rating: 0,
      },
    }));
}

/**
 * Export questions to JSON
 */
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

/**
 * Export questions to CSV
 */
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

/**
 * Get most commonly used tags
 * Useful for recommendation engine and filter UI
 */
export function getMostUsedTags(questions: Question[], limit = 10): { tag: string; count: number }[] {
  const tagCounts: Record<string, number> = {};

  questions.forEach(q => {
    q.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get highest-rated questions
 */
export function getHighestRatedQuestions(questions: Question[], limit = 10): Question[] {
  return [...questions]
    .filter(q => q.metadata.rating > 0)
    .sort((a, b) => b.metadata.rating - a.metadata.rating)
    .slice(0, limit);
}

/**
 * Get most frequently used questions
 */
export function getMostUsedQuestions(questions: Question[], limit = 10): Question[] {
  return [...questions]
    .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
    .slice(0, limit);
}

/**
 * Recommend questions based on questionnaire context
 * Simple heuristic: questions with matching tags and high usage/rating
 */
export function recommendQuestions(
  questionnaireTopics: string[],
  availableQuestions: Question[],
  limit = 5
): Question[] {
  const scored = availableQuestions.map(q => {
    const tagMatches = q.tags.filter(tag => questionnaireTopics.includes(tag)).length;
    const usageScore = q.metadata.usageCount / 100; // Normalize
    const ratingScore = q.metadata.rating / 5; // Normalize

    return {
      question: q,
      score: tagMatches * 2 + usageScore * 0.5 + ratingScore * 0.5,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.question);
}
