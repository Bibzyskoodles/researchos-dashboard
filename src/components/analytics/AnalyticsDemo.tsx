/**
 * Analytics Dashboard Demo Component
 *
 * This component demonstrates how to use the analytics system in various contexts:
 * - Full analytics dashboard
 * - Summary statistics view
 * - Source-filtered analytics
 * - Integration with questionnaire pages
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useAnalytics, useSourceMetrics, useDropOffAnalysis } from '../../hooks/useAnalytics';

interface AnalyticsDemoProps {
  questionnaireId: string;
}

/**
 * Demo: Full Analytics Dashboard
 * Shows all analytics features including charts, metrics, and source filtering
 */
export function FullAnalyticsDemoView({ questionnaireId }: AnalyticsDemoProps) {
  return (
    <div style={{ padding: '20px', background: '#F9FAFB', borderRadius: 12 }}>
      <AnalyticsDashboard questionnaireId={questionnaireId} />
    </div>
  );
}

/**
 * Demo: Summary Statistics Panel
 * Shows quick key metrics without full dashboard
 */
export function SummaryStatisticsDemoView({ questionnaireId }: AnalyticsDemoProps) {
  const { data: analytics, loading, error } = useAnalytics(questionnaireId);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ color: '#DC2626' }}>Error: {error}</div>;
  }

  if (!analytics) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>No data available</div>;
  }

  const { source_distribution, completion_rate_by_source, avg_time_by_source } = analytics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 16,
        padding: 20,
      }}
    >
      {/* Total Responses */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          padding: 20,
          background: 'white',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', color: '#6B7280', fontSize: 12, fontWeight: 600 }}>
          TOTAL RESPONSES
        </h3>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#080D1A' }}>
          {source_distribution.total_responses}
        </div>
      </motion.div>

      {/* Source Breakdown */}
      {Object.entries(source_distribution.source_counts).map(([source, count]) => (
        <motion.div
          key={source}
          whileHover={{ y: -2 }}
          style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #E5E7EB',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#6B7280', fontSize: 12, fontWeight: 600 }}>
            {source === 'fieldscore_direct' ? 'FIELDSCORE DIRECT' : 'KOBOTOOLS'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#080D1A' }}>
              {count}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              ({Math.round(source_distribution.source_percentages[source])}%)
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            Completion:{' '}
            <strong style={{ color: '#059669' }}>
              {Math.round((completion_rate_by_source[source] || 0) * 100)}%
            </strong>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Avg time: {Math.round((avg_time_by_source[source] || 0) / 60)} min
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Demo: Source Metrics Detailed View
 * Shows in-depth metrics for each data source
 */
export function SourceMetricsDetailedView({ questionnaireId }: AnalyticsDemoProps) {
  const { metrics, loading, error } = useSourceMetrics(questionnaireId);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ color: '#DC2626' }}>Error: {error}</div>;
  }

  if (!metrics) {
    return <div>No source metrics available</div>;
  }

  const { source_metrics, device_recommendations } = metrics;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {Object.entries(source_metrics).map(([source, data]: [string, any]) => (
        <motion.div
          key={source}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #E5E7EB',
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700 }}>
            {source === 'fieldscore_direct' ? '📱 FieldScore Direct' : '🌐 KoboToolbox'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Total Responses</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#080D1A' }}>
                {data.total_responses}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Completed</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
                {data.completed_responses} ({Math.round(data.completion_rate * 100)}%)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Avg Completion Time</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#080D1A' }}>
                {Math.round(data.avg_completion_time_seconds / 60)} min
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Median Time</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#080D1A' }}>
                {Math.round(data.median_completion_time_seconds / 60)} min
              </div>
            </div>
          </div>

          {/* Device Distribution */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
              Device Distribution
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {Object.entries(data.device_distribution).map(([device, count]: [string, any]) => (
                <div
                  key={device}
                  style={{
                    padding: 12,
                    background: '#F9FAFB',
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                    {device.charAt(0).toUpperCase() + device.slice(1)}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#080D1A' }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          {device_recommendations && device_recommendations[source] && (
            <div
              style={{
                padding: 12,
                background: '#DBEAFE',
                borderLeft: '4px solid #2463EB',
                borderRadius: 6,
                fontSize: 13,
                color: '#1E40AF',
              }}
            >
              💡 {device_recommendations[source]}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Demo: Drop-Off Analysis View
 * Shows where respondents abandon questionnaires
 */
export function DropOffAnalysisDemoView({ questionnaireId }: AnalyticsDemoProps) {
  const { analysis, loading, error } = useDropOffAnalysis(questionnaireId);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ color: '#DC2626' }}>Error: {error}</div>;
  }

  if (!analysis || !analysis.drop_off_analysis || analysis.drop_off_analysis.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>No drop-off data</div>;
  }

  const { drop_off_analysis, total_responses } = analysis;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        padding: 20,
        background: 'white',
        borderRadius: 12,
        border: '1px solid #E5E7EB',
      }}
    >
      <h2 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700 }}>
        Drop-Off Analysis
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {drop_off_analysis.map((item: any, index: number) => (
          <motion.div
            key={item.question_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              padding: 12,
              background: '#F9FAFB',
              borderRadius: 8,
              borderLeft: `4px solid ${item.drop_off_rate > 0.1 ? '#DC2626' : '#059669'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 12, fontWeight: 600 }}>
                  Q{item.question_position}: {item.question_text}
                </h4>
              </div>
              <div
                style={{
                  padding: '4px 8px',
                  background: item.drop_off_rate > 0.1 ? '#FECACA' : '#D1FAE5',
                  color: item.drop_off_rate > 0.1 ? '#991B1B' : '#065F46',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {Math.round(item.drop_off_rate * 100)}% drop-off
              </div>
            </div>

            <div
              style={{
                height: 6,
                background: '#E5E7EB',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.drop_off_rate * 100}%` }}
                transition={{ duration: 0.6, delay: index * 0.05 + 0.2 }}
                style={{
                  height: '100%',
                  background: item.drop_off_rate > 0.1 ? '#DC2626' : '#059669',
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {item.responses_at_question} responses → {item.responses_at_next_question} continued
              ({item.drop_off_count} abandoned)
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Demo: Full Page Integration
 * Shows how to use all components together in a page layout
 */
export function AnalyticsPageDemoView({ questionnaireId }: AnalyticsDemoProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'summary' | 'sources' | 'dropoff'>('overview');

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'summary', label: '📈 Summary', icon: '📈' },
    { id: 'sources', label: '🔄 By Source', icon: '🔄' },
    { id: 'dropoff', label: '📉 Drop-Off', icon: '📉' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        minHeight: '100vh',
        background: '#F9FAFB',
        padding: 20,
      }}
    >
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 700 }}>
          Analytics Dashboard
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          Questionnaire ID: {questionnaireId}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #2463EB' : 'none',
              background: 'none',
              color: activeTab === tab.id ? '#2463EB' : '#6B7280',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' && <FullAnalyticsDemoView questionnaireId={questionnaireId} />}
        {activeTab === 'summary' && <SummaryStatisticsDemoView questionnaireId={questionnaireId} />}
        {activeTab === 'sources' && <SourceMetricsDetailedView questionnaireId={questionnaireId} />}
        {activeTab === 'dropoff' && <DropOffAnalysisDemoView questionnaireId={questionnaireId} />}
      </motion.div>
    </motion.div>
  );
}
