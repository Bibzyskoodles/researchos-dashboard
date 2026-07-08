import React from "react";
import { motion } from "framer-motion";
import { scoreColor } from "../../styles/tokens";

// Animated circular score display (0-100).
export function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={6} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (pct * c) }} transition={{ duration: 1, ease: "easeOut" }}
        strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0,0)`, transformOrigin: `${size / 2}px ${size / 2}px`,
          fontSize: size > 100 ? 28 : 18, fontWeight: 800, fill: color, fontFamily: "Inter,sans-serif" }}>
        {score}
      </text>
    </svg>
  );
}

export default ScoreRing;
