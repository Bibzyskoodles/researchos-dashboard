import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { SourceSegmentControl } from './SourceSegmentControl';
import { SourceDistributionBadge } from './SourceDistributionBadge';

interface AnalyticsData {
  questionnaire_id: string;
  generated_at: string;
  total_responses: number;
  source_distribution: {
    total_responses: number;
    source_counts: { [key: string]: number };
    source_percentages: { [key: string]: number };
  };
  source_metrics: { [key: string]: any };
  completion_rate_by_source: { [key: string]: number };
  avg_time_by_source: { [key: string]: number };
  device_recommendations: { [key: string]: string };
}

interface AnalyticsDashboardProps {
  questionnaireId: string;
  onDataLoad?: (data: AnalyticsData) => void;
  loading?: boolean;
  error?: string | null;
}

const COLORS = {
  primary: '#2463EB',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  fieldScore: '#3B82F6',
  kobo: '#10B981',
  neutral: '#6B7280',
};

const DEVICE_ICONS: { [key: string]: string } = {
  mobile: '📱',
  web: '🖥️',
  tablet: '📱',
  unknown: '❓',
};

export function AnalyticsDashboard({
  questionnaireId,
  onDataLoad,
  loading: externalLoading = false,
  error: externalError = null,
}: AnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(externalLoading || true);
  const [error, setError] = useState<string | null>(externalError);
  const [activeSource, setActiveSource] = useState<'all' | 'fieldscore_direct' | 'kobotools'>('all');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const url = `/api/questionnaires/${questionnaireId}/analytics?group_by=source`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'success') {
          setAnalyticsData(data.analytics);
          onDataLoad?.(data.analytics);
          setError(null);
        } else {
          throw new Error(data.message || 'Failed to load analytics');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [questionnaireId, onDataLoad]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          color: '#6B7280',
          fontSize: 14,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
          <div>Loading analytics...</div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '20px 24px',
          background: '#FEE2E2',
          border: `1px solid #FCA5A5`,
          borderRadius: 12,
          color: '#991B1B',
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Error loading analytics</div>
        <div>{error}</div>
      </motion.div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  const { source_distribution, source_metrics, completion_rate_by_source, avg_time_by_source } =
    analyticsData;

  // Prepare data for charts
  const completionData = Object.entries(completion_rate_by_source).map(([source, rate]) => ({
    name: source === 'fieldscore_direct' ? 'FieldScore' : 'KoboTools',
    rate: Math.round(rate * 100),
    source,
  }));

  const timeData = Object.entries(avg_time_by_source).map(([source, seconds]) => ({
    name: source === 'fieldscore_direct' ? 'FieldScore' : 'KoboTools',
    minutes: Math.round(seconds / 60),
    source,
  }));

  const responseCountData = Object.entries(source_distribution.source_counts).map(([source, count]) => ({
    name: source === 'fieldscore_direct' ? 'FieldScore Direct' : 'KoboToolbox',
    value: count,
    fill: source === 'fieldscore_direct' ? COLORS.fieldScore : COLORS.kobo,
  }));

  // Get device data for active source
  const activeSourceKey =
    activeSource === 'all'
      ? Object.keys(source_distribution.source_counts)[0]
      : activeSource;

  const activeSourceMetrics = source_metrics[activeSourceKey];
  const deviceData = activeSourceMetrics
    ? Object.entries(activeSourceMetrics.device_distribution).map(([device, count]: [string, any]) => ({
        name: device.charAt(0).toUpperCase() + device.slice(1),
        value: count,
        icon: DEVICE_ICONS[device],
      }))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Header with Controls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#080D1A' }}>
            Response Analytics
          </h2>
          <SourceDistributionBadge
            sourceDistribution={source_distribution.source_counts}
            sourcePercentages={source_distribution.source_percentages}
            totalResponses={source_distribution.total_responses}
          />
        </div>
        <SourceSegmentControl
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          sourceDistribution={source_distribution.source_counts}
        />
      </motion.div>

      {/* Key Metrics Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <MetricCard
          label="Total Responses"
          value={source_distribution.total_responses}
          icon="📝"
          color={COLORS.primary}
        />
        <MetricCard
          label="Avg Completion Rate"
          value={`${Math.round(Object.values(completion_rate_by_source).reduce((a, b) => a + b, 0) / Object.keys(completion_rate_by_source).length * 100)}%`}
          icon="✅"
          color={COLORS.success}
        />
        <MetricCard
          label="Avg Time"
          value={`${Math.round(Object.values(avg_time_by_source).reduce((a, b) => a + b, 0) / Object.keys(avg_time_by_source).length / 60)} min`}
          icon="⏱️"
          color={COLORS.warning}
        />
      </motion.div>

      {/* Charts Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}
      >
        {/* Response Distribution */}
        <ChartCard title="Response Distribution by Source">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={responseCountData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {responseCountData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Completion Rate Comparison */}
        <ChartCard title="Completion Rate by Source">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={completionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rate" fill={COLORS.success} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Average Completion Time */}
        <ChartCard title="Avg Completion Time">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="minutes" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Device Distribution */}
        {deviceData.length > 0 && (
          <ChartCard title={`Device Distribution (${activeSource === 'all' ? 'All' : activeSource === 'fieldscore_direct' ? 'FieldScore' : 'KoboTools'})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
              {deviceData.map((device) => (
                <motion.div
                  key={device.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{device.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                      {device.name}
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: '#E5E7EB',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(device.value / Math.max(...deviceData.map((d) => d.value))) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        style={{
                          height: '100%',
                          background: COLORS.primary,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', minWidth: 40 }}>
                    {device.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </ChartCard>
        )}
      </motion.div>

      {/* Source-Specific Metrics */}
      <AnimatePresence>
        {Object.entries(source_metrics).map(([source, metrics]: [string, any]) => (
          <motion.div
            key={source}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <SourceMetricsCard
              source={source}
              metrics={metrics}
              recommendation={analyticsData.device_recommendations[source]}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Helper Components

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

function MetricCard({ label, value, icon, color }: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      style={{
        padding: 20,
        background: 'white',
        border: `1px solid ${color}15`,
        borderRadius: 12,
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>
        {value}
      </div>
    </motion.div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <motion.div
      whileHover={{ boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
      style={{
        padding: 20,
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        transition: 'all 0.2s ease',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600, color: '#080D1A' }}>
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

interface SourceMetricsCardProps {
  source: string;
  metrics: any;
  recommendation?: string;
}

function SourceMetricsCard({ source, metrics, recommendation }: SourceMetricsCardProps) {
  const sourceName = source === 'fieldscore_direct' ? 'FieldScore Direct' : 'KoboToolbox';
  const sourceColor = source === 'fieldscore_direct' ? COLORS.fieldScore : COLORS.kobo;

  return (
    <motion.div
      whileHover={{ boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
      style={{
        padding: 20,
        background: 'white',
        border: `1px solid ${sourceColor}30`,
        borderRadius: 12,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: sourceColor,
          }}
        />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#080D1A' }}>
          {sourceName} Metrics
        </h3>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MetricItem label="Total Responses" value={metrics.total_responses} />
        <MetricItem label="Completed" value={metrics.completed_responses} />
        <MetricItem label="Completion Rate" value={`${Math.round(metrics.completion_rate * 100)}%`} />
        <MetricItem label="Avg Time" value={`${Math.round(metrics.avg_completion_time_seconds / 60)} min`} />
      </div>

      {recommendation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            padding: 12,
            background: `${sourceColor}10`,
            border: `1px solid ${sourceColor}30`,
            borderRadius: 8,
            fontSize: 12,
            color: sourceColor,
            lineHeight: 1.5,
          }}
        >
          <strong>Recommendation:</strong> {recommendation}
        </motion.div>
      )}
    </motion.div>
  );
}

interface MetricItemProps {
  label: string;
  value: string | number;
}

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#080D1A' }}>
        {value}
      </div>
    </div>
  );
}
