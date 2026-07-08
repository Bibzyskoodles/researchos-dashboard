import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, radius, shadows, transitions } from '../../designTokens';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionStyles = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: spacing.sm,
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: spacing.sm,
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: spacing.sm,
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: spacing.sm,
  },
};

const arrowStyles = {
  top: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    borderTop: `6px solid ${colors.textPrimary}`,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottom: 'none',
  },
  bottom: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    borderBottom: `6px solid ${colors.textPrimary}`,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: 'none',
  },
  left: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    borderLeft: `6px solid ${colors.textPrimary}`,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderRight: 'none',
  },
  right: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    borderRight: `6px solid ${colors.textPrimary}`,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: 'none',
  },
};

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [delayHandler, setDelayHandler] = React.useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const handler = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setDelayHandler(handler);
  };

  const handleMouseLeave = () => {
    if (delayHandler) clearTimeout(delayHandler);
    setIsVisible(false);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              ...positionStyles[position],
              background: colors.textPrimary,
              color: colors.white,
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radius.md,
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              zIndex: 999,
              boxShadow: shadows.lg,
              pointerEvents: 'none',
            }}
          >
            {content}
            <div
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                ...arrowStyles[position],
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
