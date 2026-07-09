/**
 * Hook for managing questionnaire questions with library integration
 * Handles adding, removing, reordering, and syncing with library
 */

import { useState, useCallback, useEffect } from 'react';
import { Question, QuestionnaireQuestion } from './types';
import { detectDuplicates } from './questionUtils';

interface UseQuestionnaireQuestionsOptions {
  questionnaireId: string;
  onDuplicateDetected?: (warning: ReturnType<typeof detectDuplicates>) => void;
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

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/questionnaires/${questionnaireId}/questions`);
      if (!response.ok) throw new Error('Failed to fetch questions');
      const data = await response.json();
      setQuestions(data.questions);

      const detailsMap = new Map<string, Question>();
      for (const q of data.questions as QuestionnaireQuestion[]) {
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
  }, [questionnaireId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const addQuestion = useCallback(
    async (questionId: string, asVariant: boolean = false) => {
      try {
        const libraryQuestion = questionDetails.get(questionId);
        if (!libraryQuestion) return;

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

        const newPosition = Math.max(...questions.map(q => q.position), 0) + 1;
        const newQuestion: QuestionnaireQuestion = {
          questionId,
          position: newPosition,
          isVariant: asVariant,
          originalQuestionId: asVariant ? questionId : undefined,
        };

        const response = await fetch(`/api/questionnaires/${questionnaireId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQuestion),
        });

        if (!response.ok) throw new Error('Failed to add question');
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

  const reorderQuestions = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      try {
        const newQuestions = [...questions];
        const [removed] = newQuestions.splice(fromIndex, 1);
        newQuestions.splice(toIndex, 0, removed);
        const updated = newQuestions.map((q, idx) => ({ ...q, position: idx + 1 }));
        setQuestions(updated);

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
        await fetchQuestions();
      }
    },
    [questionnaireId, questions, fetchQuestions]
  );

  const syncWithLibrary = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId}/questions/sync`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to sync with library');
      const data = await response.json();
      if (data.synced > 0) {
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
