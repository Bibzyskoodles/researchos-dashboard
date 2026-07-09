/**
 * RealtimeAlerts.tsx - Ada Realtime Insights Dashboard Component
 *
 * Displays real-time alerts and insights from response analysis
 * Features:
 * - Alert dashboard with severity-based filtering
 * - Toast notifications for critical alerts
 * - Click-through to problematic questions in builder
 * - Auto-fix suggestion application
 * - Learning insights display
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Lightbulb, Zap, X, ChevronRight, CheckCircle } from 'lucide-react';

/**
 * Type definitions
 */
interface AlertMetadata {
  [key: string]: any;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  title: string;
  description: string;
  question_id?: string;
  pattern_type: 'drop_off' | 'device_issue' | 'sentiment' | 'optimization' | 'general';
  metadata: AlertMetadata;
  created_at: string;
  action_suggested?: string;
}

interface RealtimeAlertsProps {
  /** Function to navigate to question in builder */
  onNavigateToQuestion?: (questionId: string) => void;
  /** Function to apply a suggestion/fix */
  onApplySuggestion?: (alert: Alert) => Promise<void>;
  /** Auto-dismiss toast notifications after ms (default: 5000) */
  toastDuration?: number;
  /** Poll for new alerts every N ms (default: 5000) */
  pollInterval?: number;
  /** API endpoint for fetching alerts */
  alertsEndpoint?: string;
}

/**
 * Toast notification component
 */
interface ToastProps {
  alert: Alert;
  onDismiss: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ alert, onDismiss, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const getIcon = () => {
    switch (alert.severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'suggestion':
        return <Lightbulb className="w-5 h-5 text-blue-500" />;
    }
  };

  const bgColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    suggestion: 'bg-blue-50 border-blue-200'
  }[alert.severity];

  return (
    <div className={`${bgColor} border rounded-lg p-4 shadow-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300`}>
      {getIcon()}
      <div className="flex-1">
        <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
        <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Alert Card component - displays individual alert
 */
interface AlertCardProps {
  alert: Alert;
  onNavigateToQuestion?: (questionId: string) => void;
  onApplySuggestion?: (alert: Alert) => Promise<void>;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onNavigateToQuestion, onApplySuggestion }) => {
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApplySuggestion = async () => {
    if (onApplySuggestion) {
      setIsApplying(true);
      try {
        await onApplySuggestion(alert);
        setApplied(true);
        setTimeout(() => setApplied(false), 2000);
      } catch (error) {
        console.error('Error applying suggestion:', error);
      } finally {
        setIsApplying(false);
      }
    }
  };

  const handleNavigate = () => {
    if (alert.question_id && onNavigateToQuestion) {
      onNavigateToQuestion(alert.question_id);
    }
  };

  const getIcon = () => {
    switch (alert.severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'suggestion':
        return <Lightbulb className="w-5 h-5 text-blue-600" />;
    }
  };

  const bgColor = {
    critical: 'bg-red-50 border-red-200 hover:bg-red-100/50',
    warning: 'bg-amber-50 border-amber-200 hover:bg-amber-100/50',
    suggestion: 'bg-blue-50 border-blue-200 hover:bg-blue-100/50'
  }[alert.severity];

  const formatTime = (isoTime: string) => {
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className={`${bgColor} border rounded-lg p-4 transition-colors`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm text-gray-900">{alert.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{formatTime(alert.created_at)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 mt-2">{alert.description}</p>

          {/* Metadata display */}
          {Object.keys(alert.metadata).length > 0 && (
            <div className="mt-3 text-xs bg-white/50 rounded p-2">
              {Object.entries(alert.metadata).map(([key, value]) => {
                if (typeof value === 'object') return null;
                return (
                  <div key={key} className="flex justify-between gap-4 text-gray-600">
                    <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-700">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {alert.question_id && onNavigateToQuestion && (
              <button
                onClick={handleNavigate}
                className="text-xs px-3 py-1.5 bg-white rounded border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-1 transition-colors"
              >
                View Question
                <ChevronRight className="w-3 h-3" />
              </button>
            )}

            {alert.action_suggested && onApplySuggestion && (
              <button
                onClick={handleApplySuggestion}
                disabled={isApplying || applied}
                className={`text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors ${
                  applied
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50'
                }`}
              >
                {applied ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Applied
                  </>
                ) : isApplying ? (
                  <>
                    <Zap className="w-3 h-3 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3" />
                    Apply Suggestion
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Learning Insights Card
 */
interface LearningInsightsProps {
  insights: string;
}

const LearningInsights: React.FC<LearningInsightsProps> = ({ insights }) => {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
      <div className="flex gap-3">
        <div className="text-purple-600 text-lg">🧠</div>
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Ada's Learning</h3>
          <div className="text-xs text-gray-700 mt-2 space-y-1 whitespace-pre-line">
            {insights}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main RealtimeAlerts Dashboard Component
 */
export const RealtimeAlerts: React.FC<RealtimeAlertsProps> = ({
  onNavigateToQuestion,
  onApplySuggestion,
  toastDuration = 5000,
  pollInterval = 5000,
  alertsEndpoint = '/api/alerts'
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toastAlerts, setToastAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'suggestion'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch alerts from API
   */
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(alertsEndpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.statusText}`);
      }

      const data = await response.json();
      const newAlerts = data.alerts || [];
      const newInsights = data.insights || '';

      // Identify new critical/warning alerts for toast notifications
      const currentAlertIds = new Set(alerts.map(a => a.id));
      const newCriticalAlerts = newAlerts.filter(
        (alert: Alert) =>
          !currentAlertIds.has(alert.id) &&
          (alert.severity === 'critical' || alert.severity === 'warning')
      );

      if (newCriticalAlerts.length > 0) {
        setToastAlerts(prev => [...prev, ...newCriticalAlerts]);
      }

      setAlerts(newAlerts);
      setInsights(newInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [alertsEndpoint, alerts]);

  /**
   * Set up polling for new alerts
   */
  useEffect(() => {
    // Fetch immediately
    fetchAlerts();

    // Set up polling
    const interval = setInterval(fetchAlerts, pollInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, pollInterval]);

  /**
   * Filter alerts by severity
   */
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  /**
   * Dismiss toast notification
   */
  const dismissToast = (alertId: string) => {
    setToastAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  /**
   * Get alert counts by severity
   */
  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    suggestion: alerts.filter(a => a.severity === 'suggestion').length
  };

  return (
    <div className="space-y-6">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 space-y-2 z-50 max-w-md">
        {toastAlerts.map(alert => (
          <Toast
            key={alert.id}
            alert={alert}
            onDismiss={() => dismissToast(alert.id)}
            duration={toastDuration}
          />
        ))}
      </div>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          Ada Realtime Insights
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Analyzing survey responses and generating optimization recommendations
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Learning Insights */}
      {insights && <LearningInsights insights={insights} />}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {(['all', 'critical', 'warning', 'suggestion'] as const).map(sev => {
          const icons = {
            all: '📊',
            critical: '🔴',
            warning: '🟡',
            suggestion: '💡'
          };

          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                filter === sev
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {icons[sev]} {sev.charAt(0).toUpperCase() + sev.slice(1)}
              {alertCounts[sev] > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-xs font-semibold">
                  {alertCounts[sev]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading && filteredAlerts.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
            <p className="text-sm text-gray-600 mt-3">Analyzing survey responses...</p>
          </div>
        )}

        {!loading && filteredAlerts.length === 0 && (
          <div className="text-center py-8">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              {alerts.length === 0
                ? 'No alerts yet. Responses will be analyzed every 5 minutes.'
                : `No ${filter} alerts to display.`}
            </p>
          </div>
        )}

        {filteredAlerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onNavigateToQuestion={onNavigateToQuestion}
            onApplySuggestion={onApplySuggestion}
          />
        ))}
      </div>

      {/* Status Footer */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 border border-gray-200">
        <div className="flex items-center justify-between">
          <span>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Last updated: just now
              </span>
            )}
          </span>
          <span>Polling every {pollInterval / 1000}s • {alerts.length} total alerts</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for integrating alerts into builder context
 */
export const useRealtimeAlerts = (alertsEndpoint?: string) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<string>('');

  useEffect(() => {
    const endpoint = alertsEndpoint || '/api/alerts';
    const fetchAlerts = async () => {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
          setInsights(data.insights || '');
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [alertsEndpoint]);

  return { alerts, insights };
};

export default RealtimeAlerts;
