import React from "react";
import { verdictColor } from "../../styles/tokens";

// PASS / FLAG / REJECT coloured pill.
export function VerdictBadge({ verdict, size = "md" }: { verdict: string; size?: "sm" | "md" }) {
  const c = verdictColor(verdict);
  return (
    <span style={{
      fontSize: size === "sm" ? 11 : 12, fontWeight: 700,
      padding: size === "sm" ? "3px 10px" : "4px 12px",
      borderRadius: 20, background: `${c}15`, color: c,
    }}>
      {verdict}
    </span>
  );
}

export default VerdictBadge;
