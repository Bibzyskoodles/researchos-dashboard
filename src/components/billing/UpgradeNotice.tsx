import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { UpgradeRequired } from "../../services/planFeatures";
import { STILL_AVAILABLE } from "../../services/planFeatures";

// What a free workspace sees when the server declines a paid deliverable.
//
// The tone is the point. A gate met at the end of a project feels like a trick;
// the same gate, explained, is a deal someone understood. So this never says
// "denied" or shows a red error — it names what upgrading gets you, then says
// what you can still do without it, so nobody thinks their own findings have
// been taken away from them.
//
// Amber rather than red on purpose: red is for something that went wrong, and
// nothing went wrong here.

interface Props {
  upgrade: UpgradeRequired;
  /** Where the upgrade link goes. Settings is where the plan actually changes. */
  to?: string;
  style?: React.CSSProperties;
}

export default function UpgradeNotice({ upgrade, to = "/settings", style }: Props) {
  const stillAvailable = STILL_AVAILABLE[upgrade.feature];
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 10,
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        ...style,
      }}
    >
      <Lock size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.6, fontWeight: 600 }}>
          {upgrade.message}
        </div>
        {stillAvailable && (
          <div style={{ fontSize: 11.5, color: "#B45309", lineHeight: 1.55, marginTop: 4 }}>
            {stillAvailable}
          </div>
        )}
        <Link
          to={to}
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12,
            fontWeight: 700,
            color: "#B45309",
            textDecoration: "underline",
          }}
        >
          See plans
        </Link>
      </div>
    </div>
  );
}
