import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { insightScoreApi } from "../../../services/api";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";

interface SFIQuestion {
  question_id: string;
  question_text: string;
  mti: number;
  response_count: number;
  issues: string[];
}
interface SFIEnumerator {
  enumerator_id: string;
  mti: number;
  interview_count: number;
  trend?: string;
}
interface SFIFlag {
  severity: "low" | "medium" | "high";
  type: string;
  description: string;
  recommendation: string;
  evidence_count?: number;
}
interface SFIData {
  overall: number;
  benchmark?: number;
  interpretation?: string;
  per_question?: SFIQuestion[];
  per_enumerator?: SFIEnumerator[];
  flags?: SFIFlag[];
}

function ScoreDial({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 20) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const dashOffset = circumference * (1 - pct * 0.75);
  const color = score >= 75 ? GREEN : score >= 55 ? AMBER : RED;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={10}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round" transform={`rotate(135 ${size / 2} ${size / 2})`} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(135 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: "easeOut" }} />
        <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize={size * 0.22}
          fontWeight={800} fill={score > 0 ? color : "#CBD5E1"} fontFamily="Inter,sans-serif">
          {score > 0 ? score : "—"}
        </text>
      </svg>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textAlign: "center" }}>{label}</div>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const cfg = { low: { bg: "#ECFDF5", color: GREEN, label: "Low" }, medium: { bg: "#FFFBEB", color: AMBER, label: "Medium" }, high: { bg: "#FEF2F2", color: RED, label: "High" } };
  const { bg, color, label } = cfg[severity] || cfg.low;
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "2px 7px" }}>{label}</span>;
}

function SFIPendingState() {
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E8EDF5", overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg, #1A1F3E, #0F172A)", padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 12 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#A78BFA" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#C4B5FD", letterSpacing: 1, textTransform: "uppercase" }}>Proprietary Framework</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "white", marginBottom: 8 }}>Signal Fidelity Index™</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6, maxWidth: 520 }}>
              SFI measures whether research signals were captured with full fidelity — from question design through enumerator delivery to respondent understanding and response quality. It surfaces where signal breaks down across the research chain.
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
            {["Design", "Question", "Delivery", "Capture", "Response"].map((stage, i) => (
              <div key={stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {i > 0 && <div style={{ position: "absolute", width: 1, height: 1 }} />}
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `rgba(124,58,237,${0.15 + i * 0.08})`, border: "1px solid rgba(124,58,237,.4)", display: "grid", placeItems: "center", fontSize: 14 }}>
                  {["🎯", "❓", "🗣️", "💡", "📝"][i]}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)", fontWeight: 600, textAlign: "center", maxWidth: 42 }}>{stage}</div>
                {i < 4 && <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)" }}>↓</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER }} />
          <div style={{ fontSize: 13, color: "#1E40AF" }}>Signal Fidelity scores will appear here once Ada completes analysis of the interview responses.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {["Per Question", "Per Enumerator", "Per Region", "Per Language"].map(dim => (
            <div key={dim} style={{ background: "#F8FAFF", borderRadius: 10, padding: "16px 14px", border: "1px solid #E8EDF5", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E8EDF5", margin: "0 auto 8px", display: "grid", placeItems: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#CBD5E1" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>{dim}</div>
              <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 4 }}>Pending</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SignalFidelityPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SFIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (insightScoreApi as any).getSignalFidelity?.(projectId)
      .then((r: any) => { if (r.data?.overall !== undefined) setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading signal fidelity...</div>;
  if (!data) return <SFIPendingState />;

  const color = (s: number) => s >= 75 ? GREEN : s >= 55 ? AMBER : RED;
  const questions = data.per_question || [];
  const enumerators = data.per_enumerator || [];
  const flags = data.flags || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "linear-gradient(135deg, #1A1F3E, #0F172A)", borderRadius: 16, padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <ScoreDial score={data.overall} size={140} label="Overall SFI" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 10 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#C4B5FD", letterSpacing: 1, textTransform: "uppercase" }}>Signal Fidelity Index™</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 8 }}>
              {data.overall >= 75 ? "Strong signal fidelity across all dimensions" : data.overall >= 55 ? "Moderate fidelity — some questions need review" : "Low fidelity detected — intervention recommended"}
            </div>
            {data.interpretation && <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>{data.interpretation}</div>}
            {data.benchmark !== undefined && (
              <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                Industry benchmark: <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 700 }}>{data.benchmark}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8 }}>Flags Requiring Attention</div>
          {flags.map((flag, i) => (
            <div key={i} style={{ background: "white", borderRadius: 12, border: `1px solid ${flag.severity === "high" ? "#FECACA" : flag.severity === "medium" ? "#FED7AA" : "#E8EDF5"}`, padding: "14px 16px", display: "flex", gap: 12 }}>
              <div style={{ paddingTop: 2, flexShrink: 0 }}><SeverityBadge severity={flag.severity} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A", marginBottom: 4 }}>{flag.type}</div>
                <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, marginBottom: 8 }}>{flag.description}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", borderRadius: 6, padding: "6px 10px" }}>
                  <span style={{ fontSize: 11, color: BLUE }}>→</span>
                  <span style={{ fontSize: 11.5, color: "#1E40AF", fontWeight: 500 }}>{flag.recommendation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Question SFI Breakdown</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{questions.length} questions</div>
          </div>
          {[...questions].sort((a, b) => a.mti - b.mti).map((q, i) => (
            <div key={q.question_id || i}>
              <div onClick={() => setExpanded(expanded === q.question_id ? null : q.question_id)}
                style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: expanded === q.question_id ? "#F8FAFF" : "white" }}>
                <div style={{ width: 48, height: 14, background: "#F1F5F9", borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
                  <motion.div animate={{ width: `${q.mti}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                    style={{ height: "100%", background: color(q.mti), borderRadius: 7 }} />
                </div>
                <div style={{ width: 36, fontSize: 13, fontWeight: 800, color: color(q.mti), fontFamily: "monospace", flexShrink: 0 }}>{q.mti}</div>
                <div style={{ flex: 1, fontSize: 12.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.question_text}</div>
                {q.issues?.length > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: AMBER, background: "#FFFBEB", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{q.issues.length} issue{q.issues.length !== 1 ? "s" : ""}</div>}
              </div>
              <AnimatePresence>
                {expanded === q.question_id && q.issues?.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                    <div style={{ padding: "10px 20px 14px 84px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {q.issues.map((issue, j) => (
                        <div key={j} style={{ display: "flex", gap: 6, fontSize: 12, color: "#6B7280" }}>
                          <span style={{ color: AMBER, flexShrink: 0 }}>•</span>{issue}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {enumerators.length > 0 && (
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Enumerator SFI Comparison</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[...enumerators].sort((a, b) => b.mti - a.mti).map((e, i) => (
              <div key={e.enumerator_id || i} style={{ background: "#F8FAFF", borderRadius: 10, padding: "12px 14px", border: "1px solid #E8EDF5", minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{e.enumerator_id}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: color(e.mti), fontFamily: "monospace" }}>{e.mti}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{e.interview_count} interview{e.interview_count !== 1 ? "s" : ""}</div>
                {e.trend && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: e.trend === "improving" ? GREEN : e.trend === "declining" ? RED : "#9CA3AF", marginTop: 4 }}>
                    {e.trend === "improving" ? "↑ Improving" : e.trend === "declining" ? "↓ Declining" : "→ Stable"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, #EFF6FF, #F8FAFF)", borderRadius: 12, border: "1px solid #DBEAFE", padding: "16px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>What is SFI?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { score: "80–100", label: "Excellent", desc: "Signal captured with high fidelity across all research dimensions" },
            { score: "55–79", label: "Moderate", desc: "Some signal loss detected — targeted redesign recommended" },
            { score: "0–54", label: "Low", desc: "Significant signal degradation — questionnaire or coaching intervention needed" },
          ].map(({ score, label, desc }) => (
            <div key={score} style={{ background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid #E8EDF5" }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: PURPLE, marginBottom: 3 }}>{score} — {label}</div>
              <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
