import React from 'react';
import { AlertCircle, Inbox, Loader } from 'lucide-react';
import { colors, spacing, typography, radius, shadows } from '../../designTokens';

interface StateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function LoadingState({ title = "Loading..." }: StateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
      minHeight: 200,
    }}>
      <div style={{
        animation: "spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite",
        marginBottom: spacing.lg,
      }}>
        <Loader size={32} color={colors.primary} />
      </div>
      <p style={{
        fontSize: 15,
        fontWeight: 500,
        color: colors.textSecondary,
      }}>
        {title}
      </p>
    </div>
  );
}

export function EmptyState({
  title = "No data yet",
  description = "Get started by creating your first item",
  action,
}: StateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
      minHeight: 200,
      textAlign: "center",
    }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: radius.lg,
        background: colors.primaryLighter,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Inbox size={28} color={colors.primary} />
      </div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 14,
        color: colors.textTertiary,
        marginBottom: spacing.lg,
        maxWidth: 300,
      }}>
        {description}
      </p>
      {action && action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again or contact support",
  action,
}: StateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
      minHeight: 200,
      textAlign: "center",
    }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: radius.lg,
        background: colors.errorBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <AlertCircle size={28} color={colors.error} />
      </div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: colors.error,
        marginBottom: spacing.sm,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 14,
        color: colors.textTertiary,
        marginBottom: spacing.lg,
        maxWidth: 300,
      }}>
        {description}
      </p>
      {action && action}
    </div>
  );
}

export function SkeletonLoader({
  count = 1,
  height = 80
}: {
  count?: number;
  height?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: height,
            background: colors.borderLight,
            borderRadius: radius.lg,
            marginBottom: spacing.lg,
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      ))}
    </>
  );
}

export function NoResultsState({
  title = "No results found",
  description = "Try adjusting your search or filters",
}: StateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
      minHeight: 200,
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 48,
        marginBottom: spacing.lg,
        opacity: 0.3,
      }}>
        🔍
      </div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 14,
        color: colors.textTertiary,
        maxWidth: 300,
      }}>
        {description}
      </p>
    </div>
  );
}
