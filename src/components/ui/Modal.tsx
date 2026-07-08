import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { colors, spacing, radius, shadows, components, transitions } from '../../designTokens';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 400,
  md: 600,
  lg: 800,
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: colors.dialogBackdrop,
              zIndex: 1000,
            }}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: sizeMap[size],
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: colors.surface,
              borderRadius: radius.xl,
              boxShadow: shadows.xl,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1001,
            }}
          >
            {/* Header */}
            {title && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${spacing.lg}px ${spacing.lg}px`,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    margin: 0,
                  }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: spacing.sm,
                    color: colors.textTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    transition: transitions.fast,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'none';
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: spacing.lg,
              }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                style={{
                  padding: spacing.lg,
                  borderTop: `1px solid ${colors.border}`,
                  display: 'flex',
                  gap: spacing.md,
                  justifyContent: 'flex-end',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = React.useState(initialState);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return { isOpen, open, close, toggle };
}
