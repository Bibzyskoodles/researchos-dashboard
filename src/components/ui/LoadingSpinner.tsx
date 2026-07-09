import React from 'react';
import { motion } from 'framer-motion';
import { colors } from '../../designTokens';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function LoadingSpinner({
  size = 'md',
  color = colors.primary,
}: LoadingSpinnerProps) {
  const s = sizeMap[size];

  return (
    <motion.svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="60"
        strokeDashoffset="0"
        opacity="0.3"
      />
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="20"
        strokeLinecap="round"
        animate={{
          strokeDashoffset: [0, -60],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.svg>
  );
}

export function LoadingDots({
  size = 'md',
  color = colors.primary,
}: LoadingSpinnerProps) {
  const dotSize = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const gap = size === 'sm' ? 4 : size === 'md' ? 6 : 8;

  return (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.2,
            delay: i * 0.2,
            repeat: Infinity,
          }}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: color,
          }}
        />
      ))}
    </div>
  );
}
