import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAda } from "../../ada/AdaContext";
import { insightScoreApi } from "../../services/api";
import { InsightProject, InsightReport, InsightSubmission } from "../../types";
import { ChevronLeft, Download, AlertCircle } from "lucide-react";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";

type Tab = "interviews" | "intelligence" | "report";

function AdaBriefing({ message, action, actionLabel }: {
  message: string; action?: () => void; actionLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #BFDBFE" }}>
        <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: "#1E40AF", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: message.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        {action && actionLabel && (
          <button onClick={action} style={{ marginTop: 10, padding: "7px 16px", borderRadius: 8, background: BLUE, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: { title: string; summary: string; quote_count: number; quotes: string[]; sentiment: string } }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColor = theme.sentiment === "positive" ? GREEN : theme.sentiment === "negative" ? RED : AMBER;
  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", overflow: "hidden", marginBottom: 10 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: sentimentColor, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#080D1A", marginBottom: 4 }}>{theme.title}</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>{theme.summary}</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: "#EFF6FF", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>{theme.quote_count} quotes</div>
      </div>
      <AnimatePresence>
        {expanded && theme.quotes?.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 16px 14px 36px", display: "flex", flexDirection: "column", gap: 8 }}>
              {theme.quotes.slice(0, 3).map((q, i) => (
                <div key={i} style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#374151", fontStyle: "italic", lineHeight: 1.5 }}>"{q}"</div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuoteBlock({ text }: { text: string }) {
  return (
    <div style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderLeft: `3px solid ${BLUE}`, borderRadius: "0 8px 8px 0", padding: "10px 14px", fontSize: 12.5, color: "#374151", fontStyle: "italic", lineHeight: 1.6, marginBottom: 8 }}>
      "{text}"
    </div>
  );
}

function Section({ title, color = "#374151", children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function InterviewsTab({ projectId }: { projectId: string }) {
  const [subs, setSubs] = useState<InsightSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const clr = (s: number) => s >= 70 ? GREEN : s >= 45 ? AMBER : RED;

  useEffect(() => {
    insightScoreApi.getSubmissions(projectId)
      .then(r => setSubs(r.data?.submissions || r.data || []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div>
      <AdaBriefing message="These interviews have all passed quality verification and are ready for analysis. Each row represents one complete interview session." />
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 56, borderRadius: 10, background: "#F1F5F9" }} />)}
        </div>
      ) : subs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          No interviews loaded yet.
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px", padding: "10px 16px", background: "#F8FAFF", borderBottom: "1px solid #E8EDF5" }}>
            {["Enumerator", "Score", "Date", "Location"].map(h => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</div>
            ))}
          </div>
          {subs.map((s, i) => (
            <motion.div key={s.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 120px", padding: "12px 16px", borderBottom: i < subs.length - 1 ? "1px solid #F1F5F9" : "none", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#080D1A" }}>{s.enumerator_id || "—"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: clr(s.score || 0), fontFamily: "monospace" }}>{s.score ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{s.date ? new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</div>
              <div style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.location || "—"}</div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

type AnalyseState = "idle" | "thinking" | "done" | "error";

function IntelligenceTab({ projectId, project }: { projectId: string; project: InsightProject | null }) {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [analyseState, setAnalyseState] = useState<AnalyseState>("idle");
  const [loading, setLoading] = useState(true);
  const [guidedQ, setGuidedQ] = useState<string | null>(null);
  const { setState: setAdaState } = useAda();

  const GUIDED_QUESTIONS = [
    "What surprised respondents most?",
    "Show contradictory opinions",
    "Compare male vs female responses",
    "Which quotes best support the top theme?",
    "Summarise interviews by location",
  ];

  useEffect(() => {
    insightScoreApi.getReport(projectId)
      .then(r => { if (r.data && (r.data.executive_summary || r.data.themes)) setReport(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const beginAnalysis = useCallback(async () => {
    setAnalyseState("thinking");
    setAdaState("thinking");
    try {
      await insightScoreApi.analyseProject(projectId);
      const r = await insightScoreApi.getReport(projectId);
      if (r.data) setReport(r.data);
      setAnalyseState("done");
      setAdaState("speaking");
      setTimeout(() => setAdaState("idle"), 4000);
    } catch {
      setAnalyseState("error");
      setAdaState("idle");
    }
  }, [projectId, setAdaState]);

  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading intelligence...</div>;

  if (!report) {
    return (
      <div>
        <AdaBriefing
          message={analyseState === "thinking"
            ? "I am reviewing the interview responses now. This takes a moment — I am reading each one carefully."
            : analyseState === "error"
              ? "I encountered an issue while reviewing the interviews. Please try again."
              : `I have **${project?.submission_count ?? 16} verified interviews** ready. I will read each response, identify patterns, and surface the most important findings for you.`}
          action={analyseState === "idle" || analyseState === "error" ? beginAnalysis : undefined}
          actionLabel={analyseState === "error" ? "Try Again" : "Begin Analysis"}
        />
        {analyseState === "thinking" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0" }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE }}
                animate={{ y: [0, -8, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
            ))}
            <span style={{ fontSize: 13, color: "#6B7280" }}>Ada is reviewing interview responses...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <AdaBriefing message="I have finished reviewing all interviews. Here is what I found — structured for an executive audience." />

      <Section title="Executive Summary">
        <div style={{ background: "linear-gradient(135deg,#EFF6FF,#F8FAFF)", border: "1px solid #DBEAFE", borderRadius: 12, padding: "18px 20px", fontSize: 13.5, color: "#1E3A8A", lineHeight: 1.7 }}>
          {report.executive_summary}
        </div>
      </Section>

      {report.business_implications?.length > 0 && (
        <Section title="Top Business Implications" color={PURPLE}>
          {report.business_implications.map((imp, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: PURPLE + "18", color: PURPLE, fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{imp}</div>
            </div>
          ))}
        </Section>
      )}

      {report.unexpected_findings?.length > 0 && (
        <Section title="Unexpected Findings" color={AMBER}>
          {report.unexpected_findings.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ color: AMBER, marginTop: 2, flexShrink: 0 }}>→</span>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{f}</div>
            </div>
          ))}
        </Section>
      )}

      {(report.risks?.length > 0 || report.opportunities?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {report.risks?.length > 0 && (
            <div style={{ background: "#FEF2F2", borderRadius: 12, padding: "14px 16px", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>Risks</div>
              {report.risks.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: "#7F1D1D", marginBottom: 6, lineHeight: 1.5 }}>• {r}</div>)}
            </div>
          )}
          {report.opportunities?.length > 0 && (
            <div style={{ background: "#ECFDF5", borderRadius: 12, padding: "14px 16px", border: "1px solid #A7F3D0" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>Opportunities</div>
              {report.opportunities.map((o, i) => <div key={i} style={{ fontSize: 12.5, color: "#064E3B", marginBottom: 6, lineHeight: 1.5 }}>• {o}</div>)}
            </div>
          )}
        </div>
      )}

      {report.themes?.length > 0 && (
        <Section title="Top Themes">
          {report.themes.map((t, i) => <ThemeCard key={i} theme={t} />)}
        </Section>
      )}

      {report.contradictions?.length > 0 && (
        <Section title="Contradictions">
          {report.contradictions.map((c, i) => <QuoteBlock key={i} text={c} />)}
        </Section>
      )}

      {report.outliers?.length > 0 && (
        <Section title="Interesting Outliers" color={PURPLE}>
          {report.outliers.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ color: PURPLE, flexShrink: 0 }}>◆</span>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{o}</div>
            </div>
          ))}
        </Section>
      )}

      {report.recommendations?.length > 0 && (
        <Section title="Recommendations" color={GREEN}>
          {report.recommendations.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: GREEN + "18", color: GREEN, fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{r}</div>
            </div>
          ))}
        </Section>
      )}

      <div style={{ background: "linear-gradient(135deg,#1A1F3E,#0F172A)", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0 }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>Ask Ada a question about these findings</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GUIDED_QUESTIONS.map(q => (
            <button key={q} onClick={() => setGuidedQ(q)}
              style={{ padding: "7px 14px", borderRadius: 20, background: guidedQ === q ? BLUE : "rgba(255,255,255,.08)", border: `1px solid ${guidedQ === q ? BLUE : "rgba(255,255,255,.15)"}`, color: guidedQ === q ? "white" : "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>
              {q}
            </button>
          ))}
        </div>
        {guidedQ && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,.06)", borderRadius: 10, fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>
            Open the Ada chat panel for a full answer to: "{guidedQ}"
          </motion.div>
        )}
      </div>
    </div>
  );
}

type ReportState = "idle" | "preparing" | "ready" | "error";

function ReportTab({ projectId }: { projectId: string }) {
  const [reportState, setReportState] = useState<ReportState>("idle");
  const [report, setReport] = useState<InsightReport | null>(null);
  const { setState: setAdaState } = useAda();

  const prepareReport = async () => {
    setReportState("preparing");
    setAdaState("thinking");
    try {
      const r = await insightScoreApi.getReport(projectId);
      setReport(r.data);
      setReportState("ready");
      setAdaState("speaking");
      setTimeout(() => setAdaState("idle"), 4000);
    } catch {
      setReportState("error");
      setAdaState("idle");
    }
  };

  return (
    <div>
      {reportState === "idle" && (
        <AdaBriefing message="I have finished reviewing the interviews. I can now prepare a presentation-ready report with executive summary, themes, evidence and methodology." action={prepareReport} actionLabel="Prepare Report" />
      )}
      {reportState === "preparing" && (
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: BLUE }}
                animate={{ y: [0, -10, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>I'm preparing your report now...</div>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 6 }}>Compiling themes, evidence, and executive summary</div>
        </div>
      )}
      {reportState === "error" && (
        <div style={{ background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA", padding: "16px 20px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: RED }}>Couldn't prepare the report</div>
            <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 4 }}>Please run the analysis first, then try again.</div>
            <button onClick={prepareReport} style={{ marginTop: 10, padding: "6px 14px", borderRadius: 8, background: RED, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Try Again</button>
          </div>
        </div>
      )}
      {reportState === "ready" && report && (
        <div>
          <div style={{ background: "linear-gradient(135deg,#ECFDF5,#F0FFF4)", border: "1px solid #A7F3D0", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "2px solid #6EE7B7", flexShrink: 0 }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>Your report is ready.</div>
              <div style={{ fontSize: 12, color: "#047857" }}>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
            {report.download_url && (
              <a href={report.download_url} download style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: GREEN, color: "white", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                <Download size={13} /> Download
              </a>
            )}
          </div>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", padding: "24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Executive Summary</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{report.executive_summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setOpen } = useAda();

  const activeTab = (searchParams.get("tab") as Tab) || "intelligence";
  const [project, setProject] = useState<InsightProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    insightScoreApi.getProject(id)
      .then(r => setProject(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const setTab = (tab: Tab) => setSearchParams({ tab });
  const TABS: { key: Tab; label: string }[] = [
    { key: "interviews", label: "Interviews" },
    { key: "intelligence", label: "Intelligence" },
    { key: "report", label: "Report" },
  ];

  if (!id) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate("/insights")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 12.5, padding: "4px 0" }}>
          <ChevronLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 14, background: "#E2E8F0" }} />
        {loading ? (
          <div style={{ height: 16, width: 160, borderRadius: 4, background: "#E8EDF5" }} />
        ) : (
          <div style={{ fontSize: 16, fontWeight: 800, color: "#080D1A", letterSpacing: -0.4 }}>{project?.name || "Project"}</div>
        )}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid #DBEAFE", borderRadius: 8, background: "#EFF6FF", fontSize: 12, fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden" }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
            </div>
            Ask Ada
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E8EDF5", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "10px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? BLUE : "#6B7280", borderBottom: `2px solid ${activeTab === t.key ? BLUE : "transparent"}`, marginBottom: -1, transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {activeTab === "interviews" && <InterviewsTab projectId={id} />}
          {activeTab === "intelligence" && <IntelligenceTab projectId={id} project={project} />}
          {activeTab === "report" && <ReportTab projectId={id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
