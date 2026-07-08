import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { colors, spacing, components } from '../../designTokens';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const confirmStyle = isDangerous ? components.buttonDanger : components.buttonPrimary;
  const confirmHoverStyle = isDangerous ? components.buttonDangerHover : components.buttonPrimaryHover;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
      }}>
        {isDangerous && (
          <div style={{
            display: 'flex',
            gap: spacing.md,
            padding: spacing.lg,
            background: colors.errorBg,
            borderRadius: 8,
          }}>
            <AlertCircle size={20} color={colors.error} style={{ flexShrink: 0 }} />
            <p style={{
              fontSize: 14,
              color: colors.error,
              margin: 0,
              lineHeight: 1.5,
            }}>
              This action cannot be undone.
            </p>
          </div>
        )}

        <p style={{
          fontSize: 15,
          color: colors.textSecondary,
          lineHeight: 1.6,
          margin: 0,
        }}>
          {description}
        </p>

        <div style={{
          display: 'flex',
          gap: spacing.md,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={loading || isLoading}
            style={{
              ...components.buttonSecondary,
              opacity: loading || isLoading ? 0.6 : 1,
              cursor: loading || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelText}
          </button>

          <motion.button
            onClick={handleConfirm}
            disabled={loading || isLoading}
            whileHover={!loading && !isLoading ? { y: -1 } : {}}
            whileTap={!loading && !isLoading ? { scale: 0.98 } : {}}
            style={{
              ...confirmStyle,
              opacity: loading || isLoading ? 0.6 : 1,
              cursor: loading || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading || isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'flex' }}
                >
                  ⏳
                </motion.div>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}

export function useConfirmDialog() {
  const [state, setState] = React.useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDangerous: false,
    onConfirm: () => {},
  });

  const confirm = (options: Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'> & { onConfirm: () => void | Promise<void> }) => {
    setState({
      isOpen: true,
      title: options.title,
      description: options.description,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      isDangerous: options.isDangerous || false,
      onConfirm: options.onConfirm,
    });
  };

  const close = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return { state, confirm, close };
}
