import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SourceSegmentControlProps {
  activeSource: 'all' | 'fieldscore_direct' | 'kobotools';
  onSourceChange: (source: 'all' | 'fieldscore_direct' | 'kobotools') => void;
  sourceDistribution: {
    [key: string]: number;
  };
}

const SEGMENT_OPTIONS = [
  { value: 'all' as const, label: 'All sources', icon: '📊' },
  { value: 'fieldscore_direct' as const, label: 'FieldScore only', icon: '📱' },
  { value: 'kobotools' as const, label: 'KoboTools only', icon: '🌐' },
];

const COLORS = {
  active: '#2463EB',
  hover: '#DBEAFE',
  text: '#374151',
  border: '#E5E7EB',
};

export function SourceSegmentControl({
  activeSource,
  onSourceChange,
  sourceDistribution,
}: SourceSegmentControlProps) {
  // Check which sources have data
  const availableSources = new Set(Object.keys(sourceDistribution));

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 8,
        background: '#F9FAFB',
        border: `1px solid ${COLORS.border}`,
        gap: 4,
      }}
    >
      {SEGMENT_OPTIONS.map((option) => {
        const isAvailable =
          option.value === 'all' ||
          availableSources.has(option.value);

        return (
          <motion.button
            key={option.value}
            onClick={() => onSourceChange(option.value)}
            disabled={!isAvailable}
            whileHover={isAvailable ? { scale: 1.02 } : undefined}
            whileTap={isAvailable ? { scale: 0.98 } : undefined}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background:
                activeSource === option.value
                  ? `${COLORS.active}15`
                  : 'transparent',
              color:
                activeSource === option.value
                  ? COLORS.active
                  : COLORS.text,
              fontSize: 13,
              fontWeight: activeSource === option.value ? 600 : 500,
              cursor: isAvailable ? 'pointer' : 'not-allowed',
              opacity: isAvailable ? 1 : 0.5,
              transition: 'all 0.2s ease',
            }}
          >
            {/* Active indicator background */}
            <AnimatePresence>
              {activeSource === option.value && (
                <motion.div
                  layoutId="activeSegment"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `${COLORS.active}10`,
                    borderRadius: 6,
                    zIndex: -1,
                  }}
                />
              )}
            </AnimatePresence>

            <span>{option.icon}</span>
            <span>{option.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
