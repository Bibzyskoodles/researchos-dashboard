import React from 'react';
import { motion } from 'framer-motion';
import { colors, spacing, radius, transitions } from '../../designTokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizeStyles = {
    sm: { padding: `${spacing.xs}px ${spacing.md}px`, fontSize: 12, gap: spacing.xs },
    md: { padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: 13, gap: spacing.sm },
    lg: { padding: `${spacing.md}px ${spacing.xl}px`, fontSize: 14, gap: spacing.md },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: colors.primary,
      color: colors.white,
      border: `1px solid ${colors.primary}`,
    },
    secondary: {
      background: colors.primaryLighter,
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    tertiary: {
      background: 'transparent',
      color: colors.textSecondary,
      border: `1px solid ${colors.border}`,
    },
    danger: {
      background: colors.error,
      color: colors.white,
      border: `1px solid ${colors.error}`,
    },
  };

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      disabled={disabled || loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: transitions.normal,
        opacity: disabled || loading ? 0.6 : 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      {...props}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ opacity: loading ? 0.5 : 1 }}>{children}</span>
    </motion.button>
  );
}
