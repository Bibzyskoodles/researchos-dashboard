import React, { useState, useEffect } from 'react';
import { Check, Loader, AlertCircle, ArrowRight, GitBranch, Database, BarChart3, Zap } from 'lucide-react';
import { httpClient } from '../../services/httpClient';

interface PipelineStatus {
  questionnaire_id: number;
  questionnaire_name: string;
  is_published: boolean;
  kobo_asset_id?: string;
  sync_status: string;
  last_sync_at?: string;
  auto_sync_enabled: boolean;
  total_responses: number;
  response_sources: Array<{
    source: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  quality_metrics: any;
}

interface QuestionnairePipelineControllerProps {
  questionnaireId: number;
  questionnaireTitle: string;
}

export default function QuestionnairePipelineController({
  questionnaireId,
  questionnaireTitle
}: QuestionnairePipelineControllerProps) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    fetchStatus();
  }, [questionnaireId]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get(
        `/api/v2/pipeline/questionnaires/${questionnaireId}/status`
      );
      setStatus(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      setSyncing(true);
      await httpClient.post(
        `/api/v2/pipeline/questionnaires/${questionnaireId}/publish-and-sync`,
        {
          auto_sync_enabled: true,
          sync_interval_minutes: 10
        }
      );
      setActiveStep(1);
      setTimeout(fetchStatus, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Publish failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await httpClient.post(
        `/api/v2/pipeline/questionnaires/${questionnaireId}/full-sync`
      );
      setActiveStep(2);
      setTimeout(fetchStatus, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading pipeline status...</div>;
  }

  if (!status) return null;

  const steps = [
    {
      title: 'Questionnaire Ready',
      description: 'Design and finalize your survey',
      icon: '📋',
      status: 'complete'
    },
    {
      title: 'Publish to KoboToolbox',
      description: 'Deploy and collect responses',
      icon: '📤',
      status: status.is_published ? 'complete' : 'pending',
      action: !status.is_published ? handlePublish : null
    },
    {
      title: 'Collect & Merge',
      description: 'Pull responses, detect duplicates',
      icon: '🔄',
      status: status.total_responses > 0 ? 'complete' : 'pending',
      action: status.is_published && !syncing ? handleSync : null
    },
    {
      title: 'Analyze & Insights',
      description: 'View analytics and send to InsightScore',
      icon: '📊',
      status: status.total_responses > 0 ? 'complete' : 'pending'
    }
  ];

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'success': return '#10B981';
      case 'error': return '#DC2626';
      case 'syncing': return '#F59E0B';
      default: return '#9CA3AF';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && (
        <div style={{
          padding: 12,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 8,
          color: '#DC2626',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Pipeline Timeline */}
      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 24,
        position: 'relative'
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 24, color: '#080D1A' }}>
          Questionnaire Pipeline
        </h3>

        {/* Timeline */}
        <div style={{ position: 'relative' }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: '5%',
            right: '5%',
            height: 2,
            background: '#E2E8F0',
            zIndex: 0
          }} />

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative', zIndex: 1 }}>
            {steps.map((step, idx) => {
              const isComplete = step.status === 'complete';
              const isActive = idx === activeStep;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Circle */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: isComplete ? '#10B981' : isActive ? '#2463EB' : '#F3F4F6',
                    border: `2px solid ${isComplete ? '#10B981' : isActive ? '#2463EB' : '#E2E8F0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isComplete || isActive ? 'white' : '#9CA3AF',
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 12
                  }}>
                    {isComplete ? <Check size={18} /> : idx + 1}
                  </div>

                  {/* Label */}
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#080D1A',
                      marginBottom: 2
                    }}>
                      {step.title}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: '#9CA3AF',
                      lineHeight: 1.3
                    }}>
                      {step.description}
                    </div>
                  </div>

                  {/* Action Button */}
                  {step.action && (
                    <button
                      onClick={step.action}
                      disabled={syncing}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '6px 10px',
                        background: '#2463EB',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: syncing ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: syncing ? 0.7 : 1
                      }}
                    >
                      {syncing ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
                      {step.title === 'Publish to KoboToolbox' ? 'Publish' : 'Sync'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard
          icon={<Database size={18} />}
          title="Total Responses"
          value={status.total_responses}
          color="#2463EB"
        />
        <StatCard
          icon={<GitBranch size={18} />}
          title="Sources"
          value={status.response_sources.length}
          color="#7C3AED"
        />
        <StatCard
          icon={<BarChart3 size={18} />}
          title="Completion Rate"
          value={`${status.quality_metrics.fieldscore_direct?.completion_rate || 0}%`}
          color="#10B981"
        />
        <StatCard
          icon={<Check size={18} />}
          title="Auto-Sync"
          value={status.auto_sync_enabled ? 'Enabled' : 'Disabled'}
          color={status.auto_sync_enabled ? '#10B981' : '#9CA3AF'}
        />
      </div>

      {/* Source Breakdown */}
      {status.response_sources.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 16
        }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#080D1A' }}>
            Response Sources
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {status.response_sources.map((source, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 8,
                background: '#F9FAFB',
                borderRadius: 6
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{source.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#080D1A' }}>{source.count} responses</div>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#2463EB',
                  background: '#EFF6FF',
                  padding: '4px 8px',
                  borderRadius: 4
                }}>
                  {source.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Sync */}
      {status.last_sync_at && (
        <div style={{
          fontSize: 11,
          color: '#6B7280',
          textAlign: 'center',
          padding: 12
        }}>
          Last synced: {new Date(status.last_sync_at).toLocaleString()}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      <div style={{ color, display: 'flex' }}>{icon}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#080D1A' }}>
        {value}
      </div>
    </div>
  );
}
