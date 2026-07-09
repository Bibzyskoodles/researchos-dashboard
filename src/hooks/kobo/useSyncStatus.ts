import { useState, useCallback, useEffect, useRef } from 'react';

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

interface UseSyncStatusReturn {
  currentStatus: 'success' | 'failed' | 'idle' | 'syncing';
  lastSyncTime: Date | null;
  autoSyncEnabled: boolean;
  koboResponseCount: number;
  directResponseCount: number;
  syncHistory: SyncRecord[];
  lastError: string | null;
  performSync: () => Promise<void>;
  toggleAutoSync: (enabled: boolean) => void;
  clearError: () => void;
}

interface SyncStatusHookOptions {
  autoSyncInterval?: number; // in milliseconds (default: 5 minutes)
  onSyncStart?: () => void | Promise<void>;
  onSyncComplete?: (record: SyncRecord) => void | Promise<void>;
  onSyncError?: (error: Error) => void | Promise<void>;
  fetchKoboData?: () => Promise<{ count: number; responses: any[] }>;
  fetchDirectData?: () => Promise<{ count: number; responses: any[] }>;
}

export const useSyncStatus = (
  options: SyncStatusHookOptions = {}
): UseSyncStatusReturn => {
  const {
    autoSyncInterval = 5 * 60 * 1000, // 5 minutes default
    onSyncStart,
    onSyncComplete,
    onSyncError,
    fetchKoboData,
    fetchDirectData,
  } = options;

  const [currentStatus, setCurrentStatus] = useState<
    'success' | 'failed' | 'idle' | 'syncing'
  >('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [koboResponseCount, setKoboResponseCount] = useState(0);
  const [directResponseCount, setDirectResponseCount] = useState(0);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Perform sync
  const performSync = useCallback(async () => {
    setCurrentStatus('syncing');
    setLastError(null);

    try {
      if (onSyncStart) {
        await onSyncStart();
      }

      // Fetch data from both sources in parallel
      const [koboData, directData] = await Promise.all([
        fetchKoboData?.() ?? Promise.resolve({ count: 0, responses: [] }),
        fetchDirectData?.() ?? Promise.resolve({ count: 0, responses: [] }),
      ]);

      const koboCount = koboData?.count ?? 0;
      const directCount = directData?.count ?? 0;
      const totalCount = koboCount + directCount;

      setKoboResponseCount(koboCount);
      setDirectResponseCount(directCount);
      setCurrentStatus('success');
      setLastSyncTime(new Date());

      // Create sync record
      const syncRecord: SyncRecord = {
        id: `sync_${Date.now()}`,
        timestamp: new Date(),
        status: 'success',
        responseCount: totalCount,
        koboCount,
        directCount,
        conflictCount: 0,
      };

      setSyncHistory((prev) => [syncRecord, ...prev].slice(0, 50)); // Keep last 50

      if (onSyncComplete) {
        await onSyncComplete(syncRecord);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Sync failed';

      setCurrentStatus('failed');
      setLastError(errorMessage);

      // Create failed sync record
      const syncRecord: SyncRecord = {
        id: `sync_${Date.now()}`,
        timestamp: new Date(),
        status: 'failed',
        responseCount: koboResponseCount + directResponseCount,
        koboCount: koboResponseCount,
        directCount: directResponseCount,
        errorMessage,
      };

      setSyncHistory((prev) => [syncRecord, ...prev].slice(0, 50));

      if (onSyncError) {
        await onSyncError(
          error instanceof Error ? error : new Error(errorMessage)
        );
      }
    }
  }, [
    onSyncStart,
    onSyncComplete,
    onSyncError,
    fetchKoboData,
    fetchDirectData,
    koboResponseCount,
    directResponseCount,
  ]);

  // Toggle auto-sync
  const toggleAutoSync = useCallback((enabled: boolean) => {
    setAutoSyncEnabled(enabled);

    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
    }

    if (enabled) {
      autoSyncIntervalRef.current = setInterval(() => {
        performSync();
      }, autoSyncInterval);
    }
  }, [autoSyncInterval, performSync]);

  // Clear error
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Setup auto-sync on mount
  useEffect(() => {
    if (autoSyncEnabled) {
      autoSyncIntervalRef.current = setInterval(() => {
        performSync();
      }, autoSyncInterval);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSyncEnabled, autoSyncInterval, performSync]);

  return {
    currentStatus,
    lastSyncTime,
    autoSyncEnabled,
    koboResponseCount,
    directResponseCount,
    syncHistory,
    lastError,
    performSync,
    toggleAutoSync,
    clearError,
  };
};

export default useSyncStatus;
