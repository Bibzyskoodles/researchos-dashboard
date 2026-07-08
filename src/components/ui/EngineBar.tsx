import React from "react";
import { motion } from "framer-motion";
import { scoreColor } from "../../styles/tokens";
import { colors, spacing, typography, transitions, radius } from "../../designTokens";

export function EngineBar({ label, score, status, finding, weight, color, icon }: any) {
  const notMeasured = !status || status === "NOT_AVAILABLE" || status === "SKIPPED" || status === "not_available";
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: `${spacing.md}px 0`,
        borderBottom: `1px solid ${colors.borderLight}`,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.md,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            background: `${color}12`,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.textSecondary,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 12,
              color: colors.textQuaternary,
              marginTop: 2,
            }}>
              {weight}% of total score
            </div>
          </div>
        </div>
        {notMeasured ? (
          <span style={{
            fontSize: 12,
            color: colors.textQuaternary,
            background: colors.surfaceHover,
            padding: `${spacing.xs}px ${spacing.md}px`,
            borderRadius: radius.full,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
            Not measured
          </span>
        ) : (
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: scoreColor(score),
            fontFamily: "Monaco, monospace",
          }}>
            {score}/100
          </span>
        )}
      </div>
      {!notMeasured && (
        <div style={{
          height: 6,
          background: colors.borderLight,
          borderRadius: radius.xs,
          overflow: "hidden",
          marginBottom: spacing.sm,
        }}>
          <motion.div
            style={{
              height: "100%",
              background: color,
              borderRadius: radius.xs,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
      {finding && (
        <div style={{
          fontSize: 13,
          color: colors.textTertiary,
          lineHeight: 1.6,
        }}>
          {finding}
        </div>
      )}
    </motion.div>
  );
}

export default EngineBar;
