import React from "react";
import { motion } from "framer-motion";
import { scoreColor } from "../../styles/tokens";

// One engine's score with a "Not measured" state for unavailable checks.
export function EngineBar({ label, score, status, finding, weight, color, icon }: any) {
  const notMeasured = !status || status === "NOT_AVAILABLE" || status === "SKIPPED" || status === "not_available";
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      style={{ padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: color + "15", display: "grid", placeItems: "center" }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>{label}</div>
            <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{weight}% of total score</div>
          </div>
        </div>
        {notMeasured ? (
          <span style={{ fontSize: 11, color: "#9CA3AF", background: "#F1F5F9", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>
            Not measured
          </span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(score), fontFamily: "monospace" }}>{score}/100</span>
        )}
      </div>
      {!notMeasured && (
        <div style={{ height: 4, background: "#EEF2F8", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
          <motion.div style={{ height: "100%", background: color, borderRadius: 2 }}
            initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      )}
      {finding && <div style={{ fontSize: 11.5, color: "#6B7280", lineHeight: 1.5 }}>{finding}</div>}
    </motion.div>
  );
}

export default EngineBar;
