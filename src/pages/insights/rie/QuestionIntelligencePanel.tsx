import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { insightScoreApi } from "../../../services/api";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";

interface QuestionIntel {
  question_id: string;
  question_text: string;
  category?: string;
  response_rate?: number;
  skip_rate?: number;
  sentiment?: { positive: number; neutral: number; negative: number };
  themes?: string[];
  quotes?: Array<{ text: string; respondent?: string } | string>;
  effectiveness?: number;
  mti?: number;
  confidence?: number;
  recommendations?: string[];
}

function SentimentBar({ pos, neu, neg }: { pos: number; neu: number; neg: number }) {
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${pos}%` }} transition={{ duration: 0.7 }} style={{ background: GREEN, borderRadius: "4px 0 0 4px" }} />
      <motion.div initial={{ width: 0 }} animate={{ width: `${neu}%` }} transition={{ duration: 0.7, delay: 0.1 }} style={{ background: "#E2E8F0" }} />
      <motion.div initial={{ width: 0 }} animate={{ width: `${neg}%` }} transition={{ duration: 0.7, delay: 0.2 }} style={{ background: RED, borderRadius: "0 4px 4px 0" }} />
    </div>
  );
}

function ScorePill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 8, padding: "8px 12px", textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function QuestionCard({ q, index }: { q: QuestionIntel; index: number }) {
  const [open, setOpen] = useState(false);
  const getQuoteText = (qt: any) => typeof qt === "string" ? qt : qt?.text || "";
  const effectiveness = q.effectiveness ?? 0;
  const effectColor = effectiveness >= 70 ? GREEN : effectiveness >= 45 ? AMBER : RED;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", overflow: "hidden", marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F1F5F9", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, color: "#9CA3AF" }}>Q{index + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#080D1A", marginBottom: 4, lineHeight: 1.4 }}>{q.question_text}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {q.category && <span style={{ fontSize: 10.5, fontWeight: 700, color: BLUE, background: "#EFF6FF", borderRadius: 4, padding: "1px 6px" }}>{q.category}</span>}
            {q.skip_rate !== undefined && q.skip_rate > 0.15 && <span style={{ fontSize: 10.5, fontWeight: 700, color: AMBER, background: "#FFFBEB", borderRadius: 4, padding: "1px 6px" }}>High skip rate</span>}
            {q.mti !== undefined && q.mti < 55 && <span style={{ fontSize: 10.5, fontWeight: 700, color: RED, background: "#FEF2F2", borderRadius: 4, padding: "1px 6px" }}>Low MTI</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: effectColor, fontFamily: "monospace" }}>{effectiveness > 0 ? effectiveness : "—"}</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600 }}>SCORE</div>
          </div>
          <div style={{ color: open ? BLUE : "#CBD5E1", fontSize: 16, transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ borderTop: "1px solid #F1F5F9", padding: "16px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {q.response_rate !== undefined && <ScorePill value={Math.round(q.response_rate * 100)} label="Response %" color={GREEN} />}
                {q.skip_rate !== undefined && <ScorePill value={Math.round(q.skip_rate * 100)} label="Skip %" color={q.skip_rate > 0.2 ? RED : AMBER} />}
                {q.mti !== undefined && <ScorePill value={q.mti} label="MTI" color={q.mti >= 75 ? GREEN : q.mti >= 55 ? AMBER : RED} />}
                {q.confidence !== undefined && <ScorePill value={Math.round(q.confidence * 100)} label="Confidence" color={BLUE} />}
              </div>

              {q.sentiment && (q.sentiment.positive + q.sentiment.neutral + q.sentiment.negative) > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Sentiment Distribution</div>
                  <SentimentBar pos={q.sentiment.positive} neu={q.sentiment.neutral} neg={q.sentiment.negative} />
                  <div style={{ display: "flex", gap: 14, marginTop: 5 }}>
                    <span style={{ fontSize: 10.5, color: GREEN, fontWeight: 600 }}>{q.sentiment.positive}% positive</span>
                    <span style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 600 }}>{q.sentiment.neutral}% neutral</span>
                    <span style={{ fontSize: 10.5, color: RED, fontWeight: 600 }}>{q.sentiment.negative}% negative</span>
                  </div>
                </div>
              )}

              {q.themes && q.themes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Dominant Themes</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {q.themes.map((t, i) => (
                      <span key={i} style={{ fontSize: 11.5, color: "#374151", background: "#F1F5F9", borderRadius: 6, padding: "3px 9px", fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {q.quotes && q.quotes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Representative Quotes</div>
                  {q.quotes.slice(0, 3).map((qt, i) => (
                    <div key={i} style={{ background: "#F8FAFF", borderLeft: `3px solid ${BLUE}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", fontSize: 12, color: "#374151", fontStyle: "italic", lineHeight: 1.5, marginBottom: 6 }}>
                      "{getQuoteText(qt)}"
                    </div>
                  ))}
                </div>
              )}

              {q.recommendations && q.recommendations.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Ada Recommends</div>
                  {q.recommendations.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <span style={{ color: BLUE, fontWeight: 700, flexShrink: 0 }}>→</span>
                      <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{r}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PendingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "#1E40AF" }}>Question Intelligence will be available after Ada completes analysis of the interview responses.</div>
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F1F5F9" }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: "#F1F5F9", borderRadius: 6, marginBottom: 6, width: `${60 + i * 10}%` }} />
            <div style={{ height: 10, background: "#F8FAFF", borderRadius: 6, width: "40%" }} />
          </div>
          <div style={{ width: 36, height: 36, background: "#F1F5F9", borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

export default function QuestionIntelligencePanel({ projectId }: { projectId: string }) {
  const [questions, setQuestions] = useState<QuestionIntel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "high_skip">("all");

  useEffect(() => {
    (insightScoreApi as any).getQuestionIntelligence?.(projectId)
      .then((r: any) => {
        const qs = r.data?.questions || r.data;
        if (Array.isArray(qs) && qs.length > 0) setQuestions(qs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading question intelligence...</div>;
  if (!questions) return <PendingState />;

  const filtered = questions.filter(q => {
    if (filter === "low") return (q.effectiveness ?? 100) < 55;
    if (filter === "high_skip") return (q.skip_rate ?? 0) > 0.2;
    return true;
  });

  const avgEffectiveness = Math.round(questions.reduce((s, q) => s + (q.effectiveness ?? 0), 0) / questions.length);
  const needsRedesign = questions.filter(q => (q.effectiveness ?? 100) < 55).length;
  const highSkip = questions.filter(q => (q.skip_rate ?? 0) > 0.2).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Avg Effectiveness", value: avgEffectiveness, color: avgEffectiveness >= 70 ? GREEN : avgEffectiveness >= 50 ? AMBER : RED, unit: "/100" },
          { label: "Questions Needing Redesign", value: needsRedesign, color: needsRedesign > 0 ? RED : GREEN, unit: "" },
          { label: "High Skip Rate", value: highSkip, color: highSkip > 0 ? AMBER : GREEN, unit: " questions" },
        ].map(({ label, value, color, unit }) => (
          <div key={label} style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", padding: "16px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace" }}>{value}{unit}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {([["all", "All Questions"], ["low", "Needs Redesign"], ["high_skip", "High Skip Rate"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: "6px 14px", borderRadius: 8, background: filter === key ? BLUE : "white", border: `1px solid ${filter === key ? BLUE : "#E5E7EB"}`, color: filter === key ? "white" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      <div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#9CA3AF", fontSize: 13 }}>No questions match this filter.</div>
        ) : (
          filtered.map((q, i) => <QuestionCard key={q.question_id || i} q={q} index={i} />)
        )}
      </div>
    </div>
  );
}
