import React from 'react';
import { motion } from 'framer-motion';

interface SourceDistributionBadgeProps {
  sourceDistribution: {
    [key: string]: number;
  };
  sourcePercentages: {
    [key: string]: number;
  };
  totalResponses: number;
}

const SOURCE_COLORS: { [key: string]: { bg: string; text: string; icon: string } } = {
  fieldscore_direct: {
    bg: '#DBEAFE',
    text: '#1E40AF',
    icon: '📱',
  },
  kobotools: {
    bg: '#DCFCE7',
    text: '#166534',
    icon: '🌐',
  },
};

export function SourceDistributionBadge({
  sourceDistribution,
  sourcePercentages,
  totalResponses,
}: SourceDistributionBadgeProps) {
  const sortedSources = Object.entries(sourcePercentages)
    .sort(([, a], [, b]) => b - a);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {sortedSources.map(([source, percentage]) => {
        const colors = SOURCE_COLORS[source] || {
          bg: '#F3F4F6',
          text: '#374151',
          icon: '📊',
        };
        const count = sourceDistribution[source] || 0;

        return (
          <motion.div
            key={source}
            whileHover={{ scale: 1.05 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              background: colors.bg,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'default',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{colors.icon}</span>
            <span>
              {source === 'fieldscore_direct' ? 'Direct' : 'KoboTools'}
            </span>
            <span style={{ opacity: 0.7 }}>
              {Math.round(percentage)}% ({count})
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
