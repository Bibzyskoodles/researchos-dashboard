import React, { useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle, Copy, ExternalLink, Loader, Lock, Unlock, X } from 'lucide-react';
import QRCode from 'qrcode.react';

// Types
interface KoboAsset {
  uid: string;
  name: string;
  version: number;
  xls_form: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface PublishConfig {
  projectName: string;
  versionNumber: string;
  description: string;
  isPublic: boolean;
  syncResponses: boolean;
}

interface PublishResult {
  success: boolean;
  assetUid?: string;
  shareLink?: string;
  xlsLink?: string;
  version?: number;
  error?: string;
}

interface PublishToKoboButtonProps {
  questionnaireId: string;
  questionnaireName: string;
  xlsFormData: Record<string, unknown>;
  koboToken?: string;
  onPublishSuccess?: (result: PublishResult) => void;
  onPublishError?: (error: string) => void;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (token: string) => void;
  isLoading?: boolean;
}

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionnaireName: string;
  onPublish: (config: PublishConfig) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  existingVersions?: number[];
}

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  assetUid: string;
  projectName: string;
  version: number;
}

// Auth Modal Component
const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, isLoading }) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onAuthSuccess(token);
      setToken('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Connect to KoboToolbox</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              KoboToolbox API Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your KoboToolbox API token"
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Get your token from <a href="https://kf.kobotoolbox.org/settings/security" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                KoboToolbox Settings
              </a>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800">
              <strong>Security Note:</strong> Your token is stored locally and only sent to KoboToolbox API. Never share your token.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!token.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Publish Modal Component
const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  questionnaireName,
  onPublish,
  isLoading,
  error,
  existingVersions = [],
}) => {
  const [config, setConfig] = useState<PublishConfig>({
    projectName: questionnaireName,
    versionNumber: String((Math.max(...existingVersions, 0) + 1)),
    description: '',
    isPublic: false,
    syncResponses: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onPublish(config);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            Publish to KoboToolbox
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900">Publication Error</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={config.projectName}
              onChange={(e) => setConfig({ ...config, projectName: e.target.value })}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter project name"
            />
            <p className="text-xs text-gray-500 mt-1">This will be the title in KoboToolbox</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version
              </label>
              <input
                type="text"
                value={config.versionNumber}
                onChange={(e) => setConfig({ ...config, versionNumber: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="v1"
              />
              <p className="text-xs text-gray-500 mt-1">Revision tracking</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, isPublic: !config.isPublic })}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    config.isPublic
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                  }`}
                >
                  {config.isPublic ? <Unlock size={16} /> : <Lock size={16} />}
                  <span className="text-sm">
                    {config.isPublic ? 'Public' : 'Private'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Optional: Add notes about this survey..."
            />
          </div>

          <div className="space-y-3 border-t pt-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.syncResponses}
                onChange={(e) => setConfig({ ...config, syncResponses: e.target.checked })}
                disabled={isLoading}
                className="mt-1 rounded border-gray-300"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Sync responses back to FieldScore
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically import completed responses from KoboToolbox into FieldScore
                </p>
              </div>
            </label>

            {isUpdating && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLoading}
                  className="mt-1 rounded border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Update existing asset
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Replace the previously published version
                  </p>
                </div>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!config.projectName.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish to KoboToolbox'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Success Modal Component
const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  shareLink,
  assetUid,
  projectName,
  version,
}) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${projectName}-qr.png`;
      link.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 text-center border-b">
          <div className="flex justify-center mb-4">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Published Successfully!</h2>
          <p className="text-sm text-gray-600 mt-2">
            {projectName} (v{version}) is now on KoboToolbox
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Code */}
          <div className="flex flex-col items-center">
            <div ref={qrRef} className="bg-white p-2 border border-gray-200 rounded">
              <QRCode value={shareLink} size={200} level="H" includeMargin={true} />
            </div>
            <button
              onClick={handleDownloadQR}
              className="text-sm text-blue-600 hover:underline mt-3"
            >
              Download QR Code
            </button>
          </div>

          {/* Share Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shareable Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 truncate"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Copy link"
              >
                <Copy size={18} className={copied ? 'text-green-600' : 'text-gray-600'} />
              </button>
            </div>
            {copied && <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <a
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
            >
              <ExternalLink size={16} />
              Open in KoboToolbox
            </a>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
export const PublishToKoboButton: React.FC<PublishToKoboButtonProps> = ({
  questionnaireId,
  questionnaireName,
  xlsFormData,
  koboToken,
  onPublishSuccess,
  onPublishError,
}) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(koboToken || '');
  const [successData, setSuccessData] = useState<{
    shareLink: string;
    assetUid: string;
    projectName: string;
    version: number;
  } | null>(null);
  const [existingVersions, setExistingVersions] = useState<number[]>([]);

  const handleAuthSuccess = useCallback((newToken: string) => {
    setToken(newToken);
    setShowAuthModal(false);
    setShowPublishModal(true);
    localStorage.setItem('koboToken', newToken);
  }, []);

  const convertToXLSForm = useCallback((data: Record<string, unknown>): string => {
    // Convert questionnaire data to XLSForm format
    const settings: Record<string, string> = {
      form_title: questionnaireName,
      form_id: questionnaireId,
      version: new Date().getTime().toString(),
    };

    const settingsSheet = Object.entries(settings)
      .map(([key, value]) => `${key}\t${value}`)
      .join('\n');

    const surveyRows = ((data as any).questions || []).map(
      (q: any, idx: number) => {
        const type = q.type === 'text' ? 'text' : q.type === 'number' ? 'integer' : 'select_one';
        const required = q.required ? 'yes' : '';
        const relevance = q.condition || '';

        return [
          type,
          q.name || `q${idx}`,
          q.label || q.name || `Question ${idx + 1}`,
          '',
          relevance,
          required,
        ]
          .filter((v) => v !== undefined)
          .join('\t');
      }
    );

    const surveyHeader = ['type', 'name', 'label', 'hint', 'relevant', 'required'].join('\t');
    const survey = [surveyHeader, ...surveyRows].join('\n');

    return `[settings]\n${settingsSheet}\n\n[survey]\n${survey}`;
  }, [questionnaireName, questionnaireId]);

  const publishToKobo = useCallback(
    async (config: PublishConfig) => {
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Convert to XLSForm
        const xlsForm = convertToXLSForm(xlsFormData);

        // Step 1: Create/Update asset on KoboToolbox
        const assetPayload = {
          name: config.projectName,
          settings: {
            id_string: questionnaireId,
            version: config.versionNumber,
            description: config.description,
          },
          xls_form: xlsForm,
        };

        const response = await fetch('https://kf.kobotoolbox.org/api/v2/assets/', {
          method: 'POST',
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assetPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.detail || `KoboToolbox API error: ${response.statusText}`
          );
        }

        const asset = await response.json();

        // Step 2: Deploy the form (make it active)
        const deployResponse = await fetch(
          `https://kf.kobotoolbox.org/api/v2/assets/${asset.uid}/deployment/`,
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              active: true,
            }),
          }
        );

        if (!deployResponse.ok) {
          const errorData = await deployResponse.json();
          throw new Error(
            errorData.detail || `Deployment failed: ${deployResponse.statusText}`
          );
        }

        // Step 3: Setup sync if requested
        if (config.syncResponses) {
          // This would integrate with your FieldScore backend
          // to set up automated response syncing
          console.log('Setting up response sync for asset:', asset.uid);
        }

        // Step 4: Generate success data
        const shareLink = `https://kf.kobotoolbox.org/#/forms/${asset.uid}`;
        const result: PublishResult = {
          success: true,
          assetUid: asset.uid,
          shareLink,
          xlsLink: `https://kf.kobotoolbox.org/api/v2/assets/${asset.uid}/xls/`,
          version: parseInt(config.versionNumber, 10),
        };

        setSuccessData({
          shareLink,
          assetUid: asset.uid,
          projectName: config.projectName,
          version: parseInt(config.versionNumber, 10),
        });

        setShowPublishModal(false);
        setShowSuccessModal(true);

        onPublishSuccess?.(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        onPublishError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [token, questionnaireId, xlsFormData, convertToXLSForm, onPublishSuccess, onPublishError]
  );

  const handleClickPublish = () => {
    if (!token) {
      setShowAuthModal(true);
    } else {
      setShowPublishModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClickPublish}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium text-sm"
        title="Publish this questionnaire to KoboToolbox"
      >
        {isLoading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <ExternalLink size={18} />
            Publish to KoboToolbox
          </>
        )}
      </button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        isLoading={isLoading}
      />

      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        questionnaireName={questionnaireName}
        onPublish={publishToKobo}
        isLoading={isLoading}
        error={error || undefined}
        existingVersions={existingVersions}
      />

      {successData && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          shareLink={successData.shareLink}
          assetUid={successData.assetUid}
          projectName={successData.projectName}
          version={successData.version}
        />
      )}
    </>
  );
};

export default PublishToKoboButton;
