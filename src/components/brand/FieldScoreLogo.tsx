import React from "react";

// FieldScore brand mark & wordmark.
// Mark geometry mirrors public/fieldscore-mark*.svg — keep them in sync.

const GLOBE_R = 28;
const DOTS: { x: number; y: number; r: number }[] = (() => {
  const dots: { x: number; y: number; r: number }[] = [];
  const step = 6.2 * 0.92;
  for (let gy = -5; gy <= 5; gy++) {
    for (let gx = -5; gx <= 5; gx++) {
      const x = 50 + gx * step;
      const y = 50 + gy * step;
      const d = Math.hypot(x - 50, y - 50);
      if (d > GLOBE_R - 1.2) continue;
      dots.push({ x, y, r: 2.55 * Math.sqrt(1 - 0.55 * (d / GLOBE_R) ** 2) });
    }
  }
  return dots;
})();

interface MarkProps {
  size?: number;
  mode?: "light" | "dark";
  /** Colour behind the mark — used to carve the gap around the checkmark. */
  casing?: string;
  style?: React.CSSProperties;
}

export function FieldScoreMark({ size = 32, mode = "light", casing, style }: MarkProps) {
  const c = mode === "dark"
    ? { dot: "#DCE7FB", arcLight: "#7FA8F5", arcBright: "#3E7BFA", check: "#3E7BFA", casing: casing || "#0A1230" }
    : { dot: "#0B1B3F", arcLight: "#93B8F8", arcBright: "#2160EA", check: "#2160EA", casing: casing || "#FFFFFF" };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={style} aria-hidden="true">
      <g>
        {DOTS.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={c.dot} />)}
      </g>
      <path d="M 10.1 64.5 A 42.5 42.5 0 0 1 78.4 18.4" fill="none" stroke={c.arcLight} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M 92.1 44.1 A 42.5 42.5 0 0 1 61.0 91.1" fill="none" stroke={c.arcBright} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M 30 57 L 46 72 L 88 30" fill="none" stroke={c.casing} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 30 57 L 46 72 L 88 30" fill="none" stroke={c.check} strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface LogoProps {
  /** Wordmark cap height in px. */
  height?: number;
  mode?: "light" | "dark";
  casing?: string;
  /** Show "VERIFY. ANALYZE. DECIDE." under the wordmark. */
  tagline?: boolean;
  /** Small uppercase line under the wordmark (e.g. "ResearchOS"). */
  sub?: string;
  style?: React.CSSProperties;
}

export default function FieldScoreLogo({ height = 28, mode = "light", casing, tagline, sub, style }: LogoProps) {
  const navy = mode === "dark" ? "#FFFFFF" : "#0B1226";
  const blue = mode === "dark" ? "#5B8CFF" : "#2160EA";
  const subColor = mode === "dark" ? "rgba(255,255,255,.32)" : "#9CA3AF";
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: tagline ? "center" : "flex-start", ...style }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        fontFamily: "Inter,sans-serif", fontWeight: 800,
        fontSize: height, letterSpacing: -height * 0.03, lineHeight: 1,
        userSelect: "none", whiteSpace: "nowrap",
      }}>
        <span style={{ color: navy }}>FIELD</span>
        <span style={{ color: blue }}>SC</span>
        <FieldScoreMark size={height * 1.04} mode={mode} casing={casing}
          style={{ margin: `0 ${height * 0.03}px`, flexShrink: 0 }} />
        <span style={{ color: blue }}>RE</span>
      </div>
      {tagline && (
        <div style={{
          marginTop: height * 0.32, fontFamily: "Inter,sans-serif", fontWeight: 700,
          fontSize: height * 0.30, letterSpacing: height * 0.085, whiteSpace: "nowrap",
          color: navy, userSelect: "none",
        }}>
          VERIFY. ANALYZE. <span style={{ color: blue }}>DECIDE.</span>
        </div>
      )}
      {sub && (
        <div style={{
          marginTop: height * 0.18, fontFamily: "Inter,sans-serif", fontWeight: 600,
          fontSize: height * 0.32, letterSpacing: height * 0.04,
          textTransform: "uppercase", color: subColor, userSelect: "none",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
