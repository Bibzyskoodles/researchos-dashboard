import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Info, AlertTriangle, X } from 'lucide-react';
import { colors, spacing, radius, shadows, transitions } from '../../designTokens';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const toastConfig = {
  success: {
    icon: Check,
    bg: colors.successBg,
    text: colors.success,
  },
  error: {
    icon: AlertCircle,
    bg: colors.errorBg,
    text: colors.error,
  },
  info: {
    icon: Info,
    bg: colors.infoBg,
    text: colors.info,
  },
  warning: {
    icon: AlertTriangle,
    bg: colors.warningBg,
    text: colors.warning,
  },
};

export function Toast({
  message,
  type = 'info',
  duration = 4000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      background: config.bg,
      border: `1px solid ${config.text}20`,
      boxShadow: shadows.md,
      animation: 'slideIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      transition: transitions.normal,
    }}>
      <Icon size={20} color={config.text} style={{ flexShrink: 0 }} />
      <p style={{
        flex: 1,
        fontSize: 14,
        fontWeight: 500,
        color: config.text,
        margin: 0,
      }}>
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: config.text,
          padding: spacing.xs,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
          transition: transitions.fast,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
}: {
  toasts: (ToastProps & { id: string })[];
}) {
  return (
    <div style={{
      position: 'fixed',
      bottom: spacing.lg,
      right: spacing.lg,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.sm,
      maxWidth: 400,
    }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

  const addToast = (props: ToastProps) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast = { ...props, id };
    setToasts((prev) => [...prev, toast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showSuccess = (message: string) => addToast({ message, type: 'success' });
  const showError = (message: string) => addToast({ message, type: 'error' });
  const showInfo = (message: string) => addToast({ message, type: 'info' });
  const showWarning = (message: string) => addToast({ message, type: 'warning' });

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };
}
