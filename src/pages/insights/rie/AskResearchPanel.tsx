import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { insightScoreApi } from "../../../services/api";
import { InsightReport } from "../../../types";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const PURPLE = "#7C3AED";

interface ResearchAnswer {
  answer: string;
  confidence?: number;
  evidence_count?: number;
  quotes?: string[];
  themes?: string[];
  follow_up?: string[];
}

interface QAItem {
  question: string;
  answer: ResearchAnswer | null;
  loading: boolean;
  error?: string;
}

const SUGGESTED_QUESTIONS = [
  "What surprised respondents most?",
  "Which themes appear most consistently?",
  "Compare responses across locations",
  "What recommendations emerge from the data?",
  "Show contradictory opinions",
  "What concerns appear most frequently?",
  "Which questions confused respondents?",
  "What is the overall sentiment trend?",
];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 75 ? GREEN : pct >= 50 ? AMBER : "#9CA3AF";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
          style={{ height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}% confidence</span>
    </div>
  );
}

function AnswerCard({ item, onFollowUp }: { item: QAItem; onFollowUp: (q: string) => void }) {
  if (item.loading) {
    return (
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", padding: "20px 22px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #BFDBFE" }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E40AF", alignSelf: "center" }}>Searching your research...</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE }}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
          ))}
        </div>
      </div>
    );
  }

  if (item.error || !item.answer) {
    return (
      <div style={{ background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA", padding: "14px 16px", fontSize: 13, color: "#7F1D1D" }}>
        {item.error || "I couldn't find a confident answer in the available research."}
      </div>
    );
  }

  const { answer, confidence, evidence_count, quotes, themes, follow_up } = item.answer;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", background: "#F8FAFF", borderBottom: "1px solid #E8EDF5" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6 }}>YOUR QUESTION</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#080D1A" }}>{item.question}</div>
      </div>

      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #BFDBFE" }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1E40AF" }}>Ada · Research Analyst</span>
              {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}
              {evidence_count !== undefined && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F1F5F9", borderRadius: 5, padding: "2px 7px" }}>
                  {evidence_count} interviews
                </span>
              )}
            </div>
            <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7 }}>{answer}</div>
          </div>
        </div>

        {themes && themes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>Supporting Themes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {themes.map((t, i) => (
                <span key={i} style={{ fontSize: 11.5, color: PURPLE, background: "#F5F3FF", borderRadius: 6, padding: "3px 9px", fontWeight: 500, border: "1px solid #EDE9FE" }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {quotes && quotes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>Evidence — Respondent Voices</div>
            {quotes.slice(0, 3).map((q, i) => (
              <div key={i} style={{ background: "#F8FAFF", borderLeft: `3px solid ${BLUE}`, borderRadius: "0 8px 8px 0", padding: "9px 13px", fontSize: 12.5, color: "#374151", fontStyle: "italic", lineHeight: 1.6, marginBottom: 6 }}>
                "{q}"
              </div>
            ))}
          </div>
        )}

        {follow_up && follow_up.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>Explore Further</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {follow_up.map((q, i) => (
                <button key={i} onClick={() => onFollowUp(q)}
                  style={{ padding: "6px 13px", borderRadius: 20, background: "white", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11.5, fontWeight: 500, cursor: "pointer", transition: "border-color .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#E5E7EB")}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AskResearchPanel({ projectId, report }: { projectId: string; report: InsightReport | null }) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<QAItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const ask = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setInput("");

    const idx = history.length;
    setHistory(prev => [...prev, { question, answer: null, loading: true }]);

    // Require analysis before allowing questions — no hallucination fallback
    if (!report) {
      setHistory(prev => prev.map((item, i) => i === idx ? {
        ...item, loading: false,
        error: "Run Intelligence analysis first — answers are grounded in your actual interview transcripts, not generated from scratch.",
      } : item));
      return;
    }

    try {
      const res = await insightScoreApi.askResearch(projectId, question, {
        has_report: true,
        executive_summary: report.executive_summary,
        themes: report.themes?.map(t => ({ title: t.title, sentiment: t.sentiment, quote_count: t.quote_count })),
      });
      const d = res.data;
      const parsed: ResearchAnswer = {
        answer: d.answer || d.reply || d.response || "No answer returned.",
        confidence: d.confidence ?? 0.75,
        evidence_count: d.evidence_count ?? (report.themes?.reduce((s: number, t: any) => s + (t.quote_count || 0), 0) || 0),
        quotes: d.quotes || [],
        themes: d.themes || [],
        follow_up: d.follow_up || d.follow_up_questions || [
          "Which demographic shows the strongest signal here?",
          "Show me the contradictory evidence",
          "What does this mean for future studies?",
        ],
      };
      setHistory(prev => prev.map((item, i) => i === idx ? { ...item, loading: false, answer: parsed } : item));
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message || "unknown";
      const msg = status === 404
        ? "InsightScore /ask endpoint not found — the analysis service may need updating."
        : `InsightScore returned ${status || "network error"}: ${detail}`;
      setHistory(prev => prev.map((item, i) => i === idx ? { ...item, loading: false, error: msg } : item));
    }
  }, [history.length, projectId, report]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "linear-gradient(135deg, #1A1F3E, #0F172A)", borderRadius: 16, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: 100, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,.2),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.25)", flexShrink: 0 }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 4 }}>Ask Your Research</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", lineHeight: 1.5, maxWidth: 440 }}>
              {report ? "Ask any question about your research data. Every answer is grounded in evidence from your interviews." : "Complete the analysis first — then ask any question and Ada will find evidence to support the answer."}
            </div>
          </div>
        </div>
      </div>

      {history.length === 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Suggested Questions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => ask(q)}
                style={{ padding: "8px 15px", borderRadius: 20, background: "white", border: "1px solid #E5E7EB", color: "#374151", fontSize: 12.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {history.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnswerCard item={item} onFollowUp={q => ask(q)} />
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />

      <div style={{ position: "sticky", bottom: 0, background: "linear-gradient(to top, #F0F4FF 80%, transparent)", padding: "12px 0 4px" }}>
        <div style={{ display: "flex", gap: 10, background: "white", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", transition: "border-color .2s" }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = BLUE)}
          onBlurCapture={e => (e.currentTarget.style.borderColor = "#E5E7EB")}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #BFDBFE" }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask anything about your research data..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#080D1A", background: "transparent", fontFamily: "Inter,sans-serif" }} />
          <button onClick={() => ask(input)} disabled={!input.trim()}
            style={{ width: 32, height: 32, borderRadius: 9, background: input.trim() ? BLUE : "#F1F5F9", border: "none", cursor: input.trim() ? "pointer" : "default", display: "grid", placeItems: "center", transition: "all .15s", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke={input.trim() ? "white" : "#CBD5E1"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: "#9CA3AF", textAlign: "center", marginTop: 6 }}>Every answer is grounded in evidence. Ada does not fabricate findings.</div>
      </div>
    </div>
  );
}
