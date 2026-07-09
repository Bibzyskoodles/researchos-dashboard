/**
 * Hook for managing questionnaire questions with library integration
 * Handles adding, removing, reordering, and syncing with library
 */

import { useState, useCallback, useEffect } from 'react';
import { Question, QuestionnaireQuestion } from './types';
import { detectDuplicates } from './questionUtils';

interface UseQuestionnaireQuestionsOptions {
  questionnaireId: string;
  onDuplicateDetected?: (warning: any) => void;
  duplicateSimilarityThreshold?: number;
}

export function useQuestionnaireQuestions({
  questionnaireId,
  onDuplicateDetected,
  duplicateSimilarityThreshold = 0.75,
}: UseQuestionnaireQuestionsOptions) {
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [questionDetails, setQuestionDetails] = useState<Map<string, Question>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch questions for this questionnaire on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/questionnaires/${questionnaireId}/questions`);
        if (!response.ok) throw new Error('Failed to fetch questions');

        const data = await response.json();
        setQuestions(data.questions);

        // Fetch full question details for each
        const detailsMap = new Map<string, Question>();
        for (const q of data.questions) {
          const detailResponse = await fetch(`/api/questions/${q.questionId}`);
          if (detailResponse.ok) {
            detailsMap.set(q.questionId, await detailResponse.json());
          }
        }
        setQuestionDetails(detailsMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [questionnaireId]);

  /**
   * Add a question to the questionnaire
   */
  const addQuestion = useCallback(
    async (questionId: string, asVariant: boolean = false) => {
      try {
        const libraryQuestion = questionDetails.get(questionId);
        if (!libraryQuestion) return;

        // Check for duplicates
        const duplicate = detectDuplicates(
          libraryQuestion.text,
          questions,
          questionDetails,
          duplicateSimilarityThreshold
        );

        if (duplicate && !asVariant) {
          onDuplicateDetected?.(duplicate);
          return { duplicate };
        }

        // Prepare new question entry
        const newPosition = Math.max(...questions.map(q => q.position), 0) + 1;
        const newQuestion: QuestionnaireQuestion = {
          questionId,
          position: newPosition,
          isVariant: asVariant,
          originalQuestionId: asVariant ? questionId : undefined,
        };

        // Add to backend
        const response = await fetch(`/api/questionnaires/${questionnaireId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQuestion),
        });

        if (!response.ok) throw new Error('Failed to add question');

        // Add to local state
        setQuestions(prev => [...prev, newQuestion]);

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add question';
        setError(message);
        return { error: message };
      }
    },
    [questionnaireId, questions, questionDetails, duplicateSimilarityThreshold, onDuplicateDetected]
  );

  /**
   * Remove a question from the questionnaire
   */
  const removeQuestion = useCallback(
    async (questionId: string) => {
      try {
        const response = await fetch(
          `/api/questionnaires/${questionnaireId}/questions/${questionId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) throw new Error('Failed to remove question');

        setQuestions(prev => prev.filter(q => q.questionId !== questionId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove question';
        setError(message);
      }
    },
    [questionnaireId]
  );

  /**
   * Reorder questions (drag and drop)
   */
  const reorderQuestions = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      try {
        // Optimistic update
        const newQuestions = [...questions];
        const [removed] = newQuestions.splice(fromIndex, 1);
        newQuestions.splice(toIndex, 0, removed);

        // Update positions
        const updated = newQuestions.map((q, idx) => ({
          ...q,
          position: idx + 1,
        }));

        setQuestions(updated);

        // Persist to backend
        const response = await fetch(
          `/api/questionnaires/${questionnaireId}/questions/reorder`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questions: updated.map(q => ({ questionId: q.questionId, position: q.position })),
            }),
          }
        );

        if (!response.ok) throw new Error('Failed to reorder questions');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reorder questions';
        setError(message);
        // Revert on error
        await fetchQuestions();
      }
    },
    [questionnaireId, questions]
  );

  /**
   * Sync all questions with library
   * Updates non-modified variants to match library versions
   */
  const syncWithLibrary = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId}/questions/sync`,
        { method: 'POST' }
      );

      if (!response.ok) throw new Error('Failed to sync with library');

      const data = await response.json();
      if (data.synced > 0) {
        // Refresh questions
        const refreshResponse = await fetch(`/api/questionnaires/${questionnaireId}/questions`);
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setQuestions(refreshedData.questions);
        }
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      return { synced: 0, error: message };
    }
  }, [questionnaireId]);

  /**
   * Update a question's text/metadata (for variants)
   */
  const updateQuestion = useCallback(
    async (questionId: string, updates: Partial<Question>) => {
      try {
        const response = await fetch(`/api/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to update question');

        const updated = await response.json();
        setQuestionDetails(prev => new Map(prev).set(questionId, updated));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update question';
        setError(message);
      }
    },
    []
  );

  return {
    questions,
    questionDetails,
    loading,
    error,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    updateQuestion,
    syncWithLibrary,
  };
}
