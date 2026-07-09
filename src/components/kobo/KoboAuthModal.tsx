import React, { useState, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Server,
  Zap,
} from 'lucide-react';

interface KoboServer {
  id: string;
  label: string;
  url: string;
}

interface ConnectionStatus {
  state: 'idle' | 'testing' | 'connected' | 'error' | 'disconnected';
  username?: string;
  message?: string;
}

interface KoboAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (server: string, token: string) => Promise<{ username: string }>;
  onDisconnect: () => Promise<void>;
  currentStatus?: ConnectionStatus;
  isLoading?: boolean;
}

const KOBO_SERVERS: KoboServer[] = [
  {
    id: 'humanitarianresponse',
    label: 'Humanitarian Response',
    url: 'https://api.kobo.humanitarianresponse.info',
  },
  {
    id: 'kobo',
    label: 'KoboToolbox (Main)',
    url: 'https://kc.kobotoolbox.org',
  },
  {
    id: 'custom',
    label: 'Custom Server',
    url: '',
  },
];

const KoboAuthModal: React.FC<KoboAuthModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  currentStatus,
  isLoading = false,
}) => {
  const [selectedServer, setSelectedServer] = useState<string>('humanitarianresponse');
  const [customServerUrl, setCustomServerUrl] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    currentStatus || { state: 'idle' }
  );
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [showAutoSync, setShowAutoSync] = useState<boolean>(false);

  const isConnected = connectionStatus.state === 'connected';
  const currentServer = KOBO_SERVERS.find((s) => s.id === selectedServer);
  const serverUrl = selectedServer === 'custom' ? customServerUrl : currentServer?.url || '';

  const validateToken = useCallback((): boolean => {
    if (!token.trim()) {
      setValidationError('API token is required');
      return false;
    }
    if (token.length < 20) {
      setValidationError('API token appears invalid (too short)');
      return false;
    }
    setValidationError('');
    return true;
  }, [token]);

  const handleTestConnection = useCallback(async () => {
    if (!validateToken()) {
      return;
    }

    setTestingConnection(true);
    setConnectionStatus({ state: 'testing' });

    try {
      const result = await onConnect(serverUrl, token);
      setConnectionStatus({
        state: 'connected',
        username: result.username,
        message: `Connected as ${result.username}`,
      });
      setShowAutoSync(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setConnectionStatus({
        state: 'error',
        message: message,
      });
    } finally {
      setTestingConnection(false);
    }
  }, [token, serverUrl, onConnect, validateToken]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
      setConnectionStatus({ state: 'disconnected', message: 'Disconnected' });
      setToken('');
      setShowAutoSync(false);
      setShowDisconnectConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Disconnection failed';
      setConnectionStatus({
        state: 'error',
        message: `Failed to disconnect: ${message}`,
      });
    } finally {
      setDisconnecting(false);
    }
  }, [onDisconnect]);

  const handleClose = useCallback(() => {
    if (!isConnected) {
      setToken('');
      setValidationError('');
      setConnectionStatus({ state: 'idle' });
    }
    onClose();
  }, [isConnected, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-lg dark:shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              KoboToolbox Connection
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your KoboToolbox account to enable data synchronization
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Connection Status Indicator */}
          {isConnected && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">
                    Connected as: {connectionStatus.username}
                  </p>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">
                    Your account is securely connected
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {connectionStatus.state === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-200">
                    Connection Failed
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                    {connectionStatus.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isConnected && (
            <>
              {/* Server Selector */}
              <div>
                <label htmlFor="server" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Server
                </label>
                <select
                  id="server"
                  value={selectedServer}
                  onChange={(e) => {
                    setSelectedServer(e.target.value);
                    setValidationError('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  {KOBO_SERVERS.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Server URL */}
              {selectedServer === 'custom' && (
                <div>
                  <label htmlFor="customUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Server URL
                  </label>
                  <input
                    id="customUrl"
                    type="url"
                    value={customServerUrl}
                    onChange={(e) => {
                      setCustomServerUrl(e.target.value);
                      setValidationError('');
                    }}
                    placeholder="https://kobo.example.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              )}

              {/* API Token Input */}
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  API Token
                </label>
                <div className="relative">
                  <input
                    id="token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setValidationError('');
                    }}
                    placeholder="Paste your API token here"
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
                      validationError
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
                        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    aria-label={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {validationError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationError}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Find your token in KoboToolbox account settings → API tokens
                </p>
              </div>
            </>
          )}

          {/* Auto-Sync Option */}
          {showAutoSync && isConnected && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Enable Auto-Sync
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                    Automatically sync data changes with KoboToolbox
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3">
          {isConnected ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Done
              </button>
              {showDisconnectConfirm ? (
                <>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Keep Connected
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Disconnecting
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        Disconnect
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || !token.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || !token.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KoboAuthModal;
