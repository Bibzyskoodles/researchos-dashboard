/**
 * ResearchOS Design Tokens
 * Comprehensive, consistent styling for the refinement pass
 */

// ─── SPACING ─────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,      // micro
  sm: 8,      // small
  md: 12,     // medium-small
  lg: 16,     // medium
  xl: 20,     // medium-large
  xxl: 24,    // large
  xxxl: 32,   // extra-large
  huge: 40,   // xxl
  massive: 48, // xxxl
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────
export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",

  // Size only — use weight for hierarchy
  caption: {
    fontSize: 11,
    fontWeight: 500,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
  },
  body: {
    fontSize: 13.5,
    fontWeight: 400,
  },
  bodyMedium: {
    fontSize: 13.5,
    fontWeight: 500,
  },
  bodySemibold: {
    fontSize: 13.5,
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 500,
  },
  heading: {
    fontSize: 16,
    fontWeight: 700,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
  },
  display: {
    fontSize: 22,
    fontWeight: 800,
  },
  largeDisplay: {
    fontSize: 28,
    fontWeight: 800,
  },
} as const;

// ─── COLORS ──────────────────────────────────────────────────────────────
export const colors = {
  // Primary
  primary: "#2463EB",

  // Dark mode
  dark900: "#0F172A",
  dark800: "#1A1F3E",

  // Text
  textPrimary: "#080D1A",
  textSecondary: "#374151",
  textTertiary: "#6B7280",
  textQuaternary: "#9CA3AF",

  // Backgrounds
  bg: "#FAFBFC",      // page background
  white: "#FFFFFF",   // cards
  bgLight: "#F8FAFC", // hover, light sections
  bgLighter: "#F1F5F9", // dividers

  // Borders
  border: "#E2E8F0",
  borderLight: "#F1F5F9",

  // Status
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  info: "#2463EB",

  // Status backgrounds
  successBg: "#ECFDF5",
  warningBg: "#FFFBEB",
  errorBg: "#FEF2F2",
  infoBg: "#EFF6FF",

  // Disabled
  disabled: "#9CA3AF",
  disabledBg: "#F8FAFC",
} as const;

// ─── SHADOWS / ELEVATION ─────────────────────────────────────────────────
export const shadows = {
  none: "none",
  xs: "0 1px 2px rgba(8, 13, 26, 0.04)",
  sm: "0 2px 8px rgba(8, 13, 26, 0.06)",
  md: "0 4px 16px rgba(8, 13, 26, 0.10)",
  lg: "0 8px 24px rgba(8, 13, 26, 0.12)",
  xl: "0 12px 32px rgba(8, 13, 26, 0.15)",
} as const;

// ─── BORDER RADIUS ───────────────────────────────────────────────────────
export const radius = {
  xs: 4,   // badges, small pills
  sm: 6,   // form inputs, small buttons
  md: 8,   // buttons, inputs, small cards
  lg: 12,  // secondary cards, sections
  xl: 16,  // primary cards, hero
} as const;

// ─── TRANSITIONS ─────────────────────────────────────────────────────────
export const transitions = {
  fast: "150ms ease",
  normal: "200ms ease",
  slow: "300ms ease",
  slowest: "500ms ease",
} as const;

// ─── COMPONENT STYLES ────────────────────────────────────────────────────

export const components = {
  // CARD
  card: {
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: spacing.lg,
    transition: `box-shadow ${transitions.fast}`,
  },
  cardHover: {
    boxShadow: shadows.md,
  },
  cardSmall: {
    padding: spacing.lg,
  },
  cardLarge: {
    padding: spacing.xxl,
  },

  // BUTTON PRIMARY
  buttonPrimary: {
    background: colors.primary,
    color: colors.white,
    padding: `10px ${spacing.lg}px`,
    borderRadius: radius.md,
    border: "none",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    transition: `all ${transitions.fast}`,
    minHeight: 40,
    fontFamily: typography.fontFamily,
    boxShadow: shadows.xs,
  },
  buttonPrimaryHover: {
    boxShadow: shadows.md,
    backgroundColor: "#1D51D8",
  },
  buttonPrimaryActive: {
    transform: "scale(0.98)",
  },

  // BUTTON SECONDARY
  buttonSecondary: {
    background: colors.white,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    padding: `10px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    transition: `all ${transitions.fast}`,
    minHeight: 40,
    fontFamily: typography.fontFamily,
  },
  buttonSecondaryHover: {
    background: colors.bgLight,
  },

  // BUTTON TERTIARY
  buttonTertiary: {
    background: "transparent",
    color: colors.textTertiary,
    border: `1px solid ${colors.borderLight}`,
    padding: `10px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    transition: `all ${transitions.fast}`,
    minHeight: 40,
    fontFamily: typography.fontFamily,
  },
  buttonTertiaryHover: {
    background: colors.bgLight,
    color: colors.textSecondary,
  },

  // BUTTON DANGER
  buttonDanger: {
    background: colors.error,
    color: colors.white,
    border: "none",
    padding: `10px ${spacing.lg}px`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    transition: `all ${transitions.fast}`,
    minHeight: 40,
    fontFamily: typography.fontFamily,
  },
  buttonDangerHover: {
    backgroundColor: "#B91C1C",
  },

  // INPUT
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: `10px ${spacing.md}px`,
    fontSize: 13.5,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    height: 40,
    boxSizing: "border-box",
    transition: `all ${transitions.fast}`,
  },
  inputFocus: {
    outline: "none",
    borderColor: colors.primary,
    boxShadow: shadows.xs,
  },
  inputDisabled: {
    background: colors.bgLight,
    border: `1px solid ${colors.borderLight}`,
    color: colors.disabled,
    cursor: "not-allowed",
  },

  // FORM LABEL
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textSecondary,
    display: "block",
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamily,
  },

  // TABLE HEADER
  tableHeader: {
    padding: `${spacing.md}px ${spacing.lg}px`,
    background: colors.bg,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 10.5,
    fontWeight: 700,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // TABLE ROW
  tableRow: {
    padding: `${spacing.lg}px ${spacing.lg}px`,
    borderBottom: `1px solid ${colors.borderLight}`,
    fontSize: 13.5,
    color: colors.textSecondary,
    transition: `background-color ${transitions.fast}`,
  },
  tableRowHover: {
    background: colors.bgLight,
  },

  // DIALOG BACKDROP
  dialogBackdrop: {
    background: "rgba(8, 13, 26, 0.40)",
    transition: `background ${transitions.fast}`,
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
  // Container
  container: {
    maxWidth: 1200,
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
} as const;
