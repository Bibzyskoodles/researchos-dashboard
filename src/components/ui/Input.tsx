import React from 'react';
import { motion } from 'framer-motion';
import { colors, spacing, radius, typography, transitions } from '../../designTokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function Input({
  label,
  error,
  success,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}: InputProps) {
  const [focused, setFocused] = React.useState(false);

  const borderColor = error
    ? colors.error
    : success
    ? colors.success
    : focused
    ? colors.primary
    : colors.border;

  const bgColor = error
    ? colors.errorBg
    : success
    ? colors.successBg
    : colors.white;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      {label && (
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.textPrimary,
            display: 'block',
          }}
        >
          {label}
        </label>
      )}

      <motion.div
        animate={{
          borderColor,
          boxShadow: focused
            ? `0 0 0 3px ${colors.primaryLighter}`
            : 'none',
        }}
        transition={{ duration: 0.15 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing.md}px ${spacing.md}px`,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: radius.md,
          transition: transitions.normal,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      >
        {icon && iconPosition === 'left' && (
          <span style={{ display: 'flex', alignItems: 'center', color: colors.textTertiary }}>
            {icon}
          </span>
        )}

        <input
          {...props}
          disabled={disabled}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
            outline: 'none',
            ...props.style,
          }}
        />

        {icon && iconPosition === 'right' && (
          <span style={{ display: 'flex', alignItems: 'center', color: colors.textTertiary }}>
            {icon}
          </span>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          style={{
            fontSize: 12,
            color: colors.error,
            fontWeight: 500,
          }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
