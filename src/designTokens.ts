/**
 * ResearchOS Design Tokens
 * Apple + Notion inspired design system
 * Color palette: White, Deep Blue, Light Blue
 */

// ─── SPACING ─────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,      // micro
  sm: 8,      // small
  md: 12,     // medium-small
  lg: 16,     // medium (base unit)
  xl: 24,     // medium-large (+50%)
  xxl: 32,    // large
  xxxl: 40,   // extra-large
  huge: 48,   // xxl
  massive: 64, // xxxl
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────
export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  monoFamily: "'Monaco', 'Menlo', 'Consolas', monospace",

  // Enhanced hierarchy with better line-heights
  caption: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.6,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.6,
  },
  bodySemibold: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  subheading: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  display: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  largeDisplay: {
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 1.1,
  },
} as const;

// ─── COLORS ──────────────────────────────────────────────────────────────
export const colors = {
  // Brand colors - User palette
  white: "#FFFFFF",
  deepBlue: "#003DA5",      // Primary deep blue
  lightBlue: "#5B8DEF",     // Secondary light blue

  // Semantic blues (derived from brand)
  primary: "#003DA5",        // Deep blue for actions
  primaryLight: "#5B8DEF",   // Light blue for accents
  primaryLighter: "#E6F0FF", // Very light blue for backgrounds

  // Neutral palette (grays)
  neutral50: "#F9FAFB",
  neutral100: "#F3F4F6",
  neutral200: "#E5E7EB",
  neutral300: "#D1D5DB",
  neutral400: "#9CA3AF",
  neutral500: "#6B7280",
  neutral600: "#4B5563",
  neutral700: "#374151",
  neutral800: "#1F2937",
  neutral900: "#111827",

  // Text
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textTertiary: "#6B7280",
  textQuaternary: "#9CA3AF",
  textInverse: "#FFFFFF",

  // Backgrounds
  bg: "#F9FAFB",           // page background
  surface: "#FFFFFF",       // cards, surfaces
  surfaceHover: "#F3F4F6",  // hover state
  surfaceLow: "#F9FAFB",    // low emphasis sections

  // Borders
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  borderStrong: "#D1D5DB",

  // Status colors
  success: "#059669",
  successBg: "#ECFDF5",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  info: "#5B8DEF",
  infoBg: "#E6F0FF",

  // Disabled
  disabled: "#9CA3AF",
  disabledBg: "#F3F4F6",

  // Dialog/Overlay
  dialogBackdrop: "rgba(17, 24, 39, 0.5)",
} as const;

// ─── SHADOWS / ELEVATION ─────────────────────────────────────────────────
// Subtle, refined shadows inspired by Apple's design
export const shadows = {
  none: "none",
  xs: "0 1px 2px rgba(17, 24, 39, 0.05)",
  sm: "0 2px 4px rgba(17, 24, 39, 0.08), 0 1px 2px rgba(17, 24, 39, 0.04)",
  md: "0 4px 12px rgba(17, 24, 39, 0.1), 0 2px 6px rgba(17, 24, 39, 0.05)",
  lg: "0 12px 24px rgba(17, 24, 39, 0.12), 0 6px 12px rgba(17, 24, 39, 0.06)",
  xl: "0 20px 40px rgba(17, 24, 39, 0.15), 0 10px 20px rgba(17, 24, 39, 0.08)",
  inset: "inset 0 1px 3px rgba(17, 24, 39, 0.05)",
} as const;

// ─── BORDER RADIUS ───────────────────────────────────────────────────────
export const radius = {
  xs: 4,    // badges, small pills
  sm: 6,    // form inputs, small buttons
  md: 8,    // buttons, inputs, medium cards
  lg: 12,   // secondary cards, sections
  xl: 16,   // primary cards, hero sections
  full: 9999, // pills, avatars
} as const;

// ─── TRANSITIONS ─────────────────────────────────────────────────────────
export const transitions = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  normal: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  slowest: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
  smooth: "250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

// ─── COMPONENT STYLES ────────────────────────────────────────────────────

export const components = {
  // CARD
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: spacing.lg,
    transition: `all ${transitions.fast}`,
  },
  cardHover: {
    boxShadow: shadows.md,
    borderColor: colors.borderLight,
  },
  cardSmall: {
    padding: spacing.md,
  },
  cardLarge: {
    padding: spacing.xl,
  },
  cardAlternate: {
    background: colors.surfaceLow,
    border: `1px solid ${colors.borderLight}`,
  },

  // BUTTON PRIMARY
  buttonPrimary: {
    background: colors.primary,
    color: colors.white,
    padding: `12px ${spacing.lg}px`,
    borderRadius: radius.md,
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: `all ${transitions.normal}`,
    minHeight: 44,
    fontFamily: typography.fontFamily,
    boxShadow: shadows.xs,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonPrimaryHover: {
    boxShadow: shadows.md,
    backgroundColor: "#002D7F",
    transform: "translateY(-1px)",
  },
  buttonPrimaryActive: {
    transform: "scale(0.98)",
  },
  buttonPrimaryDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
  },

  // BUTTON SECONDARY
  buttonSecondary: {
    background: colors.surface,
    color: colors.primary,
    border: `1.5px solid ${colors.primary}`,
    padding: `11px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: `all ${transitions.normal}`,
    minHeight: 44,
    fontFamily: typography.fontFamily,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonSecondaryHover: {
    background: colors.primaryLighter,
    borderColor: colors.primary,
  },

  // BUTTON TERTIARY
  buttonTertiary: {
    background: "transparent",
    color: colors.primary,
    border: `1px solid ${colors.borderLight}`,
    padding: `11px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: `all ${transitions.normal}`,
    minHeight: 44,
    fontFamily: typography.fontFamily,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonTertiaryHover: {
    background: colors.surfaceHover,
    color: colors.primary,
  },

  // BUTTON GHOST (text only)
  buttonGhost: {
    background: "transparent",
    color: colors.primary,
    border: "none",
    padding: `8px ${spacing.sm}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: `all ${transitions.normal}`,
    fontFamily: typography.fontFamily,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonGhostHover: {
    color: colors.deepBlue,
    background: colors.primaryLighter,
  },

  // BUTTON DANGER
  buttonDanger: {
    background: colors.error,
    color: colors.white,
    border: "none",
    padding: `12px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: `all ${transitions.normal}`,
    minHeight: 44,
    fontFamily: typography.fontFamily,
    boxShadow: shadows.xs,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonDangerHover: {
    backgroundColor: "#B91C1C",
    boxShadow: shadows.md,
    transform: "translateY(-1px)",
  },

  // INPUT
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: `11px ${spacing.md}px`,
    fontSize: 15,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    height: 44,
    boxSizing: "border-box",
    transition: `all ${transitions.normal}`,
    backgroundColor: colors.surface,
  },
  inputFocus: {
    outline: "none",
    borderColor: colors.primary,
    boxShadow: `0 0 0 3px ${colors.primaryLighter}, 0 1px 2px rgba(17, 24, 39, 0.05)`,
  },
  inputDisabled: {
    background: colors.disabledBg,
    border: `1px solid ${colors.borderLight}`,
    color: colors.disabled,
    cursor: "not-allowed",
  },
  inputError: {
    borderColor: colors.error,
  },

  // FORM LABEL
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textSecondary,
    display: "block",
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily,
  },

  // TABLE HEADER
  tableHeader: {
    padding: `${spacing.lg}px ${spacing.lg}px`,
    background: colors.surfaceHover,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 12,
    fontWeight: 700,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: typography.fontFamily,
  },

  // TABLE ROW
  tableRow: {
    padding: `${spacing.lg}px ${spacing.lg}px`,
    borderBottom: `1px solid ${colors.borderLight}`,
    fontSize: 15,
    color: colors.textSecondary,
    transition: `background-color ${transitions.fast}`,
  },
  tableRowHover: {
    background: colors.surfaceHover,
  },

  // DIALOG BACKDROP
  dialogBackdrop: {
    background: "rgba(17, 24, 39, 0.30)",
    transition: `background ${transitions.normal}`,
    backdropFilter: "blur(4px)",
  },

  // BADGE
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `4px ${spacing.md}px`,
    borderRadius: radius.full,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: typography.fontFamily,
  },
  badgePrimary: {
    background: colors.primaryLighter,
    color: colors.primary,
  },
  badgeSuccess: {
    background: colors.successBg,
    color: colors.success,
  },
  badgeWarning: {
    background: colors.warningBg,
    color: colors.warning,
  },
  badgeError: {
    background: colors.errorBg,
    color: colors.error,
  },
} as const;

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────

export const utils = {
  // Flex center
  flexCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // Flex between
  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Column
  flexColumn: {
    display: "flex",
    flexDirection: "column" as const,
  },
  // Column center
  flexColumnCenter: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  // Container
  container: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: `0 ${spacing.lg}px`,
  },
  // Scrollable
  scrollable: {
    overflowY: "auto" as const,
    maxHeight: "100%",
  },
  // Truncate
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  // Disabled state
  disabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  // Focus ring for keyboard navigation
  focusRing: {
    outline: "2px solid transparent",
    outlineOffset: "2px",
  },
  focusRingBlue: {
    outlineColor: colors.primary,
  },
  // Interactive surface (for hover states)
  interactiveSurface: {
    transition: `all ${transitions.normal}`,
    cursor: "pointer",
  },
} as const;
