import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { httpClient } from '../../services/httpClient';

interface AnalyticsData {
  sources: Array<{
    source: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  quality_metrics: {
    fieldscore_direct: QualityMetric;
    kobotools: QualityMetric;
  };
  sync_status: SyncStatus;
}

interface QualityMetric {
  source: string;
  response_count: number;
  completion_rate: number;
  average_time_to_complete_seconds: number;
  missing_field_rate: number;
}

interface SyncStatus {
  sync_status: string;
  last_sync_at: string;
  error_message?: string;
  auto_sync_enabled: boolean;
}

interface MultiSourceAnalyticsDashboardProps {
  questionnaireId: number;
}

export default function MultiSourceAnalyticsDashboard({ questionnaireId }: MultiSourceAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'quality' | 'sync'>('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [questionnaireId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get(`/api/v2/analytics/questionnaires/${questionnaireId}/comparison`);
      setData(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await httpClient.post(`/api/v2/analytics/questionnaires/${questionnaireId}/export-analytics`, {
        format: 'csv'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${questionnaireId}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      setError('Failed to export analytics');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>
        <div style={{ fontSize: 14 }}>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 24,
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: 8,
        color: '#DC2626',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#080D1A' }}>Multi-Source Analytics</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchAnalytics}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: '#2463EB'
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#2463EB',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500
            }}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #E2E8F0' }}>
        {(['overview', 'quality', 'sync'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === tab ? '#2463EB' : '#6B7280',
              borderBottom: activeTab === tab ? '2px solid #2463EB' : 'none',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'quality' && <QualityTab data={data} />}
      {activeTab === 'sync' && <SyncTab questionnaireId={questionnaireId} />}
    </div>
  );
}

function OverviewTab({ data }: { data: AnalyticsData }) {
  const pieData = data.sources.map(s => ({
    name: s.label,
    value: s.count,
    color: s.source === 'fieldscore_direct' ? '#2463EB' : '#7C3AED'
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
      {/* Response Distribution */}
      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: 16
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#080D1A' }}>
          Response Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
            >
              {pieData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Response Counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.sources.map(source => (
          <div
            key={source.source}
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{source.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#080D1A' }}>{source.count}</div>
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: source.source === 'fieldscore_direct' ? '#2463EB' : '#7C3AED'
            }}>
              {source.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityTab({ data }: { data: AnalyticsData }) {
  const metrics = [
    { label: 'Response Count', key: 'response_count' },
    { label: 'Completion Rate (%)', key: 'completion_rate' },
    { label: 'Avg Time (sec)', key: 'average_time_to_complete_seconds' },
    { label: 'Missing Rate (%)', key: 'missing_field_rate' }
  ];

  const chartData = metrics.map(m => ({
    name: m.label,
    fieldscore_direct: data.quality_metrics.fieldscore_direct[m.key as keyof QualityMetric],
    kobotools: data.quality_metrics.kobotools[m.key as keyof QualityMetric]
  }));

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: 16
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#080D1A' }}>
          Quality Comparison
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="fieldscore_direct" fill="#2463EB" />
            <Bar dataKey="kobotools" fill="#7C3AED" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {[
          { title: 'FieldScore Direct', metrics: data.quality_metrics.fieldscore_direct },
          { title: 'KoboToolbox', metrics: data.quality_metrics.kobotools }
        ].map(section => (
          <div
            key={section.title}
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 16
            }}
          >
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#080D1A' }}>
              {section.title}
            </h4>
            {Object.entries(section.metrics).map(([key, value]) => (
              key !== 'source' && (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: '#6B7280' }}>{key}</span>
                  <span style={{ fontWeight: 600, color: '#080D1A' }}>{value}</span>
                </div>
              )
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncTab({ questionnaireId }: { questionnaireId: number }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await httpClient.get(`/api/v2/analytics/questionnaires/${questionnaireId}/sync-status`);
        setSyncStatus(response.data);
      } catch (err) {
        console.error('Failed to fetch sync status', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSyncStatus();
  }, [questionnaireId]);

  if (loading) return <div style={{ padding: 24 }}>Loading sync status...</div>;
  if (!syncStatus) return <div style={{ padding: 24 }}>No sync data available</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10B981';
      case 'error': return '#DC2626';
      case 'syncing': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {syncStatus.sync_status === 'success' ? (
            <CheckCircle size={18} color={getStatusColor('success')} />
          ) : (
            <AlertCircle size={18} color={getStatusColor('error')} />
          )}
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#080D1A' }}>Sync Status</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>Status</div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: getStatusColor(syncStatus.sync_status),
              textTransform: 'capitalize'
            }}>
              {syncStatus.sync_status}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>Last Sync</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#080D1A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} />
              {syncStatus.last_sync_at ? new Date(syncStatus.last_sync_at).toLocaleString() : 'Never'}
            </div>
          </div>

          {syncStatus.error_message && (
            <div>
              <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 4, textTransform: 'uppercase' }}>Error</div>
              <div style={{ fontSize: 12, color: '#DC2626', fontFamily: 'monospace' }}>{syncStatus.error_message}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: 16
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#080D1A' }}>Settings</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>Auto-Sync</div>
            <div style={{
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: 4,
              background: syncStatus.auto_sync_enabled ? '#DBEAFE' : '#F3F4F6',
              color: syncStatus.auto_sync_enabled ? '#2463EB' : '#6B7280',
              fontSize: 12,
              fontWeight: 600
            }}>
              {syncStatus.auto_sync_enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
