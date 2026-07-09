import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Questionnaire,
  PublishConfig,
  PublishResult,
  SyncResult,
  RevisionHistory,
} from '../../services/kobo/kobo.types';
import {
  publishToKoboToolbox,
  syncResponses,
  listKoboAssets,
} from '../../services/kobo/koboToolboxApi';

interface UseKoboPublishState {
  isLoading: boolean;
  isPublished: boolean;
  error: string | null;
  lastPublishedAt: string | null;
  assetUid: string | null;
  shareLink: string | null;
  revisions: RevisionHistory[];
  isSyncing: boolean;
  lastSyncAt: string | null;
}

interface UseKoboPublishActions {
  publish: (questionnaire: Questionnaire, config: PublishConfig) => Promise<PublishResult>;
  unpublish: () => Promise<void>;
  syncKoboResponses: () => Promise<SyncResult>;
  loadRevisions: () => Promise<void>;
  clearError: () => void;
}

interface UseKoboPublishOptions {
  token?: string;
  onSuccess?: (result: PublishResult) => void;
  onError?: (error: string) => void;
  persistRevisions?: boolean;
}

/**
 * Custom hook for managing KoboToolbox publish operations
 */
export function useKoboPublish(options: UseKoboPublishOptions = {}): [
  UseKoboPublishState,
  UseKoboPublishActions
] {
  const [state, setState] = useState<UseKoboPublishState>({
    isLoading: false,
    isPublished: false,
    error: null,
    lastPublishedAt: null,
    assetUid: null,
    shareLink: null,
    revisions: [],
    isSyncing: false,
    lastSyncAt: null,
  });

  const tokenRef = useRef(options.token || localStorage.getItem('koboToken') || '');

  // Initialize from localStorage
  useEffect(() => {
    if (options.persistRevisions) {
      const saved = localStorage.getItem('koboRevisions');
      if (saved) {
        try {
          const revisions = JSON.parse(saved);
          setState((prev) => ({ ...prev, revisions }));
        } catch (e) {
          console.error('Failed to parse saved revisions', e);
        }
      }
    }
  }, [options.persistRevisions]);

  const saveRevisions = useCallback((revisions: RevisionHistory[]) => {
    if (options.persistRevisions) {
      try {
        localStorage.setItem('koboRevisions', JSON.stringify(revisions));
      } catch (e) {
        console.error('Failed to save revisions', e);
      }
    }
  }, [options.persistRevisions]);

  const publish = useCallback(
    async (questionnaire: Questionnaire, config: PublishConfig): Promise<PublishResult> => {
      if (!tokenRef.current) {
        const error = 'KoboToolbox token not configured';
        setState((prev) => ({ ...prev, error }));
        options.onError?.(error);
        return { success: false, error, timestamp: new Date().toISOString() };
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await publishToKoboToolbox(tokenRef.current, questionnaire, {
          projectName: config.projectName,
          description: config.description,
          isPublic: config.isPublic,
        });

        if (result.success && result.assetUid && result.shareLink) {
          const newRevision: RevisionHistory = {
            version: parseInt(config.versionNumber, 10),
            publishedAt: new Date().toISOString(),
            assetUid: result.assetUid,
            shareLink: result.shareLink,
            description: config.description,
            questionCount: questionnaire.questions?.length || 0,
            syncEnabled: config.syncResponses,
          };

          setState((prev) => {
            const updatedRevisions = [...prev.revisions, newRevision];
            saveRevisions(updatedRevisions);
            return {
              ...prev,
              isLoading: false,
              isPublished: true,
              assetUid: result.assetUid || null,
              shareLink: result.shareLink || null,
              lastPublishedAt: new Date().toISOString(),
              revisions: updatedRevisions,
            };
          });

          options.onSuccess?.(result);
        } else {
          const error = result.error || 'Failed to publish questionnaire';
          setState((prev) => ({ ...prev, isLoading: false, error }));
          options.onError?.(error);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error occurred';
        setState((prev) => ({ ...prev, isLoading: false, error }));
        options.onError?.(error);
        return { success: false, error, timestamp: new Date().toISOString() };
      }
    },
    [options, saveRevisions]
  );

  const unpublish = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isPublished: false,
      assetUid: null,
      shareLink: null,
      lastPublishedAt: null,
    }));
  }, []);

  const syncKoboResponses = useCallback(async (): Promise<SyncResult> => {
    if (!tokenRef.current || !state.assetUid) {
      return {
        success: false,
        submissionsImported: 0,
        submissionsUpdated: 0,
        submissionsSkipped: 0,
        timestamp: new Date().toISOString(),
      };
    }

    setState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await syncResponses(
        tokenRef.current,
        state.assetUid,
        '',
        state.lastSyncAt || undefined
      );

      if (result.success) {
        setState((prev) => ({ ...prev, isSyncing: false, lastSyncAt: new Date().toISOString() }));
      } else {
        const error = result.error || 'Failed to sync responses';
        setState((prev) => ({ ...prev, isSyncing: false, error }));
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      setState((prev) => ({ ...prev, isSyncing: false, error }));
      return {
        success: false,
        submissionsImported: 0,
        submissionsUpdated: 0,
        submissionsSkipped: 0,
        error,
        timestamp: new Date().toISOString(),
      };
    }
  }, [state.assetUid, state.lastSyncAt]);

  const loadRevisions = useCallback(async () => {
    if (!tokenRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const assets = await listKoboAssets(tokenRef.current);
      const revisions: RevisionHistory[] = assets.slice(0, 10).map((asset) => ({
        version: parseInt(asset.settings.version as string || '1', 10),
        publishedAt: asset.created,
        assetUid: asset.uid,
        shareLink: `https://kf.kobotoolbox.org/#/forms/${asset.uid}`,
        description: asset.settings.description as string,
        questionCount: asset.version_count,
        syncEnabled: false,
      }));

      setState((prev) => ({ ...prev, isLoading: false, revisions }));
      saveRevisions(revisions);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load revisions';
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [saveRevisions]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return [
    state,
    {
      publish,
      unpublish,
      syncKoboResponses,
      loadRevisions,
      clearError,
    },
  ];
}
