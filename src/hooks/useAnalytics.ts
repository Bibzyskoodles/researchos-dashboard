import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../services/api';
import { AnalyticsReport } from '../types';

interface UseAnalyticsOptions {
  autoFetch?: boolean;
  includeDetails?: boolean;
}

interface UseAnalyticsReturn {
  data: AnalyticsReport | null;
  summary: any | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing analytics data
 * @param questionnaireId - The questionnaire ID to fetch analytics for
 * @param options - Configuration options
 * @returns Analytics data and loading state
 */
export function useAnalytics(
  questionnaireId: string | null,
  options: UseAnalyticsOptions = {}
): UseAnalyticsReturn {
  const { autoFetch = true, includeDetails: _includeDetails = true } = options;

  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!questionnaireId) {
      setData(null);
      setSummary(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const analyticsResponse = await analyticsApi.getQuestionnaireAnalytics(
        questionnaireId,
        'source'
      );

      if (analyticsResponse.data.status === 'success') {
        setData(analyticsResponse.data.analytics);
        setSummary(analyticsResponse.data.summary);
      } else {
        throw new Error(analyticsResponse.data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [questionnaireId]);

  useEffect(() => {
    if (autoFetch) {
      fetchAnalytics();
    }
  }, [questionnaireId, autoFetch, fetchAnalytics]);

  return {
    data,
    summary,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}

/**
 * Hook for fetching source-specific metrics
 */
export function useSourceMetrics(questionnaireId: string | null) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionnaireId) {
      setMetrics(null);
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await analyticsApi.getSourceMetrics(questionnaireId);
        if (response.data.status === 'success') {
          setMetrics(response.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch source metrics');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [questionnaireId]);

  return { metrics, loading, error };
}

/**
 * Hook for fetching drop-off analysis
 */
export function useDropOffAnalysis(questionnaireId: string | null) {
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionnaireId) {
      setAnalysis(null);
      return;
    }

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await analyticsApi.getDropOffAnalysis(questionnaireId);
        if (response.data.status === 'success') {
          setAnalysis(response.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch drop-off analysis');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [questionnaireId]);

  return { analysis, loading, error };
}
