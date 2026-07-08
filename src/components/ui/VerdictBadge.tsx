import React from "react";
import { verdictColor } from "../../styles/tokens";
import { components, transitions } from "../../designTokens";

export function VerdictBadge({ verdict, size = "md" }: { verdict: string; size?: "sm" | "md" }) {
  const c = verdictColor(verdict);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size === "sm" ? 12 : 13,
      fontWeight: 700,
      padding: size === "sm" ? "4px 10px" : "6px 14px",
      borderRadius: 6,
      background: `${c}15`,
      color: c,
      transition: transitions.fast,
    }}>
      {verdict}
    </span>
  );
}

export default VerdictBadge;
