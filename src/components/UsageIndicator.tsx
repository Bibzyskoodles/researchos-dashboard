import React, { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { licensingApi } from '../services/api';

interface UsageData {
  current_submissions: number;
  limit_submissions: number;
  remaining_submissions: number;
  percentage_used: number;
  allowed: boolean;
}

export function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setIsLoading(true);
        const res = await licensingApi.getUsage();
        setUsage(res.data);
        setError('');
      } catch (err: any) {
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          console.warn('Failed to fetch usage:', err.message);
        }
        setUsage(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsage();
    // Refresh usage every 60 seconds
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !usage) return null;

  const isWarning = usage.percentage_used >= 80;
  const isDanger = usage.percentage_used >= 95;

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4',
      borderLeft: `4px solid ${isDanger ? '#dc2626' : isWarning ? '#f59e0b' : '#22c55e'}`,
      borderRadius: '6px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <TrendingUp
            size={16}
            color={isDanger ? '#dc2626' : isWarning ? '#f59e0b' : '#22c55e'}
          />
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: isDanger ? '#991b1b' : isWarning ? '#92400e' : '#166534',
          }}>
            Monthly Usage
          </span>
        </div>
        <span style={{
          fontSize: '12px',
          color: isDanger ? '#7f1d1d' : isWarning ? '#b45309' : '#3f6212',
          marginLeft: 'auto',
        }}>
          {usage.current_submissions} / {usage.limit_submissions}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '6px',
        backgroundColor: isDanger ? '#fee2e2' : isWarning ? '#fef3c7' : '#dcfce7',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <div style={{
          width: `${Math.min(usage.percentage_used, 100)}%`,
          height: '100%',
          backgroundColor: isDanger ? '#dc2626' : isWarning ? '#f59e0b' : '#22c55e',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Status message */}
      <div style={{
        fontSize: '12px',
        color: isDanger ? '#7f1d1d' : isWarning ? '#b45309' : '#166534',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        {isDanger && (
          <>
            <AlertCircle size={14} />
            <span>
              <strong>Limit nearly reached:</strong> {usage.remaining_submissions} submissions remaining
            </span>
          </>
        )}
        {isWarning && !isDanger && (
          <>
            <AlertCircle size={14} />
            <span>
              <strong>Usage at {usage.percentage_used.toFixed(0)}%:</strong> {usage.remaining_submissions} submissions remaining
            </span>
          </>
        )}
        {!isWarning && (
          <span>
            {usage.remaining_submissions} submissions remaining this month
          </span>
        )}
      </div>
    </div>
  );
}
