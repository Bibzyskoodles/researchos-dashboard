import React, { useState, useEffect } from 'react';
import KoboAuthModal from './KoboAuthModal';
import { KoboConnectionResult } from './kobo.types';

/**
 * Example integration of KoboAuthModal component
 * Shows how to handle connection lifecycle and state management
 */

export function KoboAuthExample() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    state: 'idle' | 'testing' | 'connected' | 'error' | 'disconnected';
    username?: string;
    message?: string;
  }>({ state: 'idle' });

  // On component mount, check if already connected
  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      const response = await fetch('/api/kobo/status');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus({
          state: 'connected',
          username: data.username,
        });
      }
    } catch (error) {
      // Not connected, that's fine
      setConnectionStatus({ state: 'idle' });
    }
  };

  const handleConnect = async (
    server: string,
    token: string
  ): Promise<KoboConnectionResult> => {
    const response = await fetch('/api/kobo/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to connect to KoboToolbox');
    }

    return response.json();
  };

  const handleDisconnect = async () => {
    const response = await fetch('/api/kobo/disconnect', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect from KoboToolbox');
    }

    setConnectionStatus({ state: 'idle' });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Data Sync Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Connect your KoboToolbox account to enable automated data synchronization
        </p>
      </div>

      {/* Connection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 max-w-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              KoboToolbox Connection
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {connectionStatus.state === 'connected'
                ? `Connected as ${connectionStatus.username}`
                : 'Not connected'}
            </p>
          </div>

          {connectionStatus.state === 'connected' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-900 dark:text-emerald-200">
                Status: Connected
              </p>
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {connectionStatus.state === 'connected'
              ? 'Manage Connection'
              : 'Connect KoboToolbox'}
          </button>
        </div>
      </div>

      {/* Modal */}
      <KoboAuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        currentStatus={connectionStatus}
      />
    </div>
  );
}

export default KoboAuthExample;
