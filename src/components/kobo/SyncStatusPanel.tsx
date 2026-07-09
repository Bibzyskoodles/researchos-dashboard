import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Circle,
  RotateCw,
  X,
} from 'lucide-react';

// Types
interface SyncRecord {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'in_progress';
  responseCount: number;
  koboCount: number;
  directCount: number;
  errorMessage?: string;
  conflictCount?: number;
}

interface SyncStatusPanelProps {
  onSync?: () => Promise<void>;
  syncHistory?: SyncRecord[];
  currentStatus?: 'success' | 'failed' | 'idle' | 'syncing';
  lastSyncTime?: Date;
  autoSyncEnabled?: boolean;
  onAutoSyncToggle?: (enabled: boolean) => void;
  koboResponseCount?: number;
  directResponseCount?: number;
  lastError?: string;
}

// Status Indicator Component
const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  let bgColor = 'bg-gray-100';
  let dotColor = 'bg-gray-500';
  let label = 'Unknown';

  switch (status) {
    case 'success':
      bgColor = 'bg-green-50';
      dotColor = 'bg-green-500';
      label = 'Synced';
      break;
    case 'syncing':
      bgColor = 'bg-yellow-50';
      dotColor = 'bg-yellow-500';
      label = 'Syncing...';
      break;
    case 'failed':
      bgColor = 'bg-red-50';
      dotColor = 'bg-red-500';
      label = 'Failed';
      break;
    case 'idle':
      bgColor = 'bg-gray-50';
      dotColor = 'bg-gray-400';
      label = 'Idle';
      break;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor}`}>
      <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
};

// Format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// Main Component
export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({
  onSync,
  syncHistory = [],
  currentStatus = 'idle',
  lastSyncTime,
  autoSyncEnabled = true,
  onAutoSyncToggle,
  koboResponseCount = 5,
  directResponseCount = 12,
  lastError,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setRetryError(null);

    try {
      if (onSync) {
        await onSync();
      }
      // Simulate sync
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAutoSyncToggle = () => {
    if (onAutoSyncToggle) {
      onAutoSyncToggle(!autoSyncEnabled);
    }
  };

  const displayStatus = isSyncing ? 'syncing' : currentStatus;
  const lastFiveSync = syncHistory.slice(0, 5);

  return (
    <div className="w-full bg-white border-t border-gray-200">
      {/* Main Panel */}
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            KoboToolbox Sync Status
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="Toggle sync history"
          >
            {isExpanded ? (
              <ChevronUp size={18} className="text-gray-600" />
            ) : (
              <ChevronDown size={18} className="text-gray-600" />
            )}
          </button>
        </div>

        {/* Status Indicator */}
        <StatusIndicator status={displayStatus} />

        {/* Last Sync Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock size={16} />
          <span>
            Last sync:{' '}
            <span className="font-medium text-gray-900">
              {lastSyncTime ? formatTimeAgo(lastSyncTime) : 'Never synced'}
            </span>
          </span>
        </div>

        {/* Response Count */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Response Count
          </p>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-600">From KoboToolbox</p>
              <p className="text-lg font-bold text-blue-600">
                {koboResponseCount}
              </p>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <p className="text-xs text-gray-600">Direct Entry</p>
              <p className="text-lg font-bold text-purple-600">
                {directResponseCount}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
            Total: {koboResponseCount + directResponseCount} responses
          </p>
        </div>

        {/* Error Display */}
        {(lastError || retryError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Sync Error</p>
                <p className="text-xs text-red-700 mt-1">
                  {lastError || retryError}
                </p>
              </div>
              <button
                onClick={() => setRetryError(null)}
                className="text-red-600 hover:text-red-700"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCw size={14} />
                  Retry
                </>
              )}
            </button>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
          aria-label="Sync now"
        >
          {isSyncing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Sync Now
            </>
          )}
        </button>

        {/* Auto-Sync Toggle */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span className="text-sm font-medium text-gray-900">Auto-sync</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">
              {autoSyncEnabled ? 'On (every 5 min)' : 'Off'}
            </span>
            <button
              onClick={handleAutoSyncToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={autoSyncEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Expandable History Section */}
        {isExpanded && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Sync History
              </h3>
              <button
                onClick={() => setShowDetailsModal(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View details →
              </button>
            </div>

            {lastFiveSync.length > 0 ? (
              <div className="space-y-2">
                {lastFiveSync.map((record) => (
                  <div
                    key={record.id}
                    className={`text-xs p-2.5 rounded-lg border ${
                      record.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : record.status === 'failed'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1">
                        {record.status === 'success' ? (
                          <CheckCircle
                            size={14}
                            className="text-green-600 flex-shrink-0"
                          />
                        ) : record.status === 'failed' ? (
                          <AlertCircle
                            size={14}
                            className="text-red-600 flex-shrink-0"
                          />
                        ) : (
                          <Circle
                            size={14}
                            className="text-yellow-600 flex-shrink-0"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {formatTimeAgo(record.timestamp)}
                        </p>
                        <p className="text-gray-600 mt-0.5">
                          {record.koboCount} from KoboToolbox +{' '}
                          {record.directCount} direct
                        </p>
                        {record.status === 'failed' && record.errorMessage && (
                          <p className="text-red-600 mt-1">
                            {record.errorMessage}
                          </p>
                        )}
                        {record.conflictCount ? (
                          <p className="text-amber-600 mt-1">
                            {record.conflictCount} conflict
                            {record.conflictCount > 1 ? 's' : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">
                No sync history yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Full Sync Log
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label="Close modal"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-3">
              {syncHistory.length > 0 ? (
                syncHistory.map((record) => (
                  <div
                    key={record.id}
                    className={`border rounded-lg p-4 ${
                      record.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : record.status === 'failed'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {record.status === 'success' ? (
                          <CheckCircle
                            size={18}
                            className="text-green-600 flex-shrink-0"
                          />
                        ) : record.status === 'failed' ? (
                          <AlertCircle
                            size={18}
                            className="text-red-600 flex-shrink-0"
                          />
                        ) : (
                          <Circle
                            size={18}
                            className="text-yellow-600 flex-shrink-0"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">
                            {record.status === 'success'
                              ? 'Successful'
                              : record.status === 'failed'
                                ? 'Failed'
                                : 'In Progress'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {record.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {record.status === 'failed' && (
                        <button
                          onClick={handleSync}
                          disabled={isSyncing}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                        >
                          {isSyncing ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <RotateCw size={12} />
                          )}
                          Retry
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs text-gray-600">Total Responses</p>
                          <p className="font-semibold text-gray-900">
                            {record.responseCount}
                          </p>
                        </div>
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs text-gray-600">KoboToolbox</p>
                          <p className="font-semibold text-blue-600">
                            {record.koboCount}
                          </p>
                        </div>
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs text-gray-600">Direct Entry</p>
                          <p className="font-semibold text-purple-600">
                            {record.directCount}
                          </p>
                        </div>
                      </div>

                      {record.conflictCount ? (
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-amber-700 font-medium">
                            ⚠️ {record.conflictCount} conflict
                            {record.conflictCount > 1 ? 's' : ''} detected
                          </p>
                        </div>
                      ) : null}

                      {record.errorMessage && (
                        <div className="bg-red-100 bg-opacity-60 rounded p-2">
                          <p className="text-red-800 font-medium">
                            Error: {record.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No sync history available
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusPanel;
