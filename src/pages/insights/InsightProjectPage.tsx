import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi } from "../../services/api";
import { InsightProject, InsightReport, InsightSubmission } from "../../types";
import { ChevronLeft, Download, AlertCircle } from "lucide-react";
import { usePlatform } from "../../platform/PlatformProvider";
import SignalFidelityPanel from "./rie/SignalFidelityPanel";
import QuestionIntelligencePanel from "./rie/QuestionIntelligencePanel";
import DemographicIntelligencePanel from "./rie/DemographicIntelligencePanel";
import IFIPanel from "./rie/MTIPanel";
import AskResearchPanel from "./rie/AskResearchPanel";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";

type Tab = "interviews" | "intelligence" | "questions" | "demographics" | "signal" | "intent" | "ask";

function AdaBriefing({ message, action, actionLabel }: {
  message: string; action?: () => void; actionLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #BFDBFE" }}>
        <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: "#1E40AF", lineHeight: 1.6 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{DOMPurify.sanitize(message)}</span>
        </div>
        {action && actionLabel && (
          <button onClick={action} style={{ marginTop: 10, padding: "7px 16px", borderRadius: 8, background: BLUE, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: { title: string; summary: string; quote_count: number; quotes: (string | { text: string; respondent?: string })[]; sentiment: string } }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColor = theme.sentiment === "positive" ? GREEN : theme.sentiment === "negative" ? RED : AMBER;
  const getQuoteText = (q: any) => typeof q === "string" ? q : q?.text || "";
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
                <div key={i} style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#374151", fontStyle: "italic", lineHeight: 1.5 }}>"{getQuoteText(q)}"</div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EvidenceTag({ label, color = BLUE }: { label: string; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}14`, borderRadius: 5, padding: "2px 7px", border: `1px solid ${color}28` }}>{label}</span>;
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
  const { t } = usePlatform();
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
            {[t('enumerator', 'Enumerator'), "Score", "Date", "Location"].map(h => (
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
  const [downloading, setDownloading] = useState<string | null>(null);
  const { setState: setAdaState } = useAda();

  const downloadReport = useCallback(async (format: "docx" | "pptx" | "xlsx") => {
    setDownloading(format);
    try {
      const res = await insightScoreApi.downloadReport(projectId, format);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ResearchOS_Report_${projectId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // swallow
    } finally {
      setDownloading(null);
    }
  }, [projectId]);

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
      await insightScoreApi.waitForAnalysis(projectId);
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

  const evidenceCount = report.themes?.reduce((s, t) => s + (t.quote_count || 0), 0) || 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {report.themes?.length > 0 && <EvidenceTag label={`${report.themes.length} themes`} color={PURPLE} />}
        {evidenceCount > 0 && <EvidenceTag label={`${evidenceCount} quotes`} color={BLUE} />}
        {report.recommendations?.length > 0 && <EvidenceTag label={`${report.recommendations.length} recommendations`} color={GREEN} />}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {([["docx", "Word"], ["pptx", "PowerPoint"], ["xlsx", "Excel"]] as const).map(([fmt, label]) => (
          <button key={fmt} onClick={() => downloadReport(fmt)} disabled={downloading !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "white", border: "1px solid #E2E8F0", color: "#374151", fontSize: 12, fontWeight: 600, cursor: downloading ? "wait" : "pointer", opacity: downloading && downloading !== fmt ? 0.5 : 1 }}>
            <Download size={12} /> {downloading === fmt ? "Preparing…" : `Download ${label}`}
          </button>
        ))}
      </div>

      <Section title="Executive Summary">
        <div style={{ background: "linear-gradient(135deg,#EFF6FF,#F8FAFF)", border: "1px solid #DBEAFE", borderRadius: 12, padding: "18px 20px", fontSize: 13.5, color: "#1E3A8A", lineHeight: 1.7 }}>
          {report.executive_summary}
        </div>
      </Section>

      {report.business_implications?.length > 0 && (
        <Section title="Business Implications" color={PURPLE}>
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
        <Section title="Themes — Evidence Grounded">
          {report.themes.map((t, i) => <ThemeCard key={i} theme={t} />)}
        </Section>
      )}

      {report.contradictions?.length > 0 && (
        <Section title="Contradictions">
          {report.contradictions.map((c, i) => (
            <div key={i} style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderLeft: `3px solid ${AMBER}`, borderRadius: "0 8px 8px 0", padding: "10px 14px", fontSize: 12.5, color: "#374151", fontStyle: "italic", lineHeight: 1.6, marginBottom: 8 }}>"{c}"</div>
          ))}
        </Section>
      )}

      {report.outliers?.length > 0 && (
        <Section title="Outliers" color={PURPLE}>
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
    </div>
  );
}

const TABS: { key: Tab; label: string; badge?: string }[] = [
  { key: "interviews", label: "Interviews" },
  { key: "intelligence", label: "Intelligence" },
  { key: "questions", label: "Questions" },
  { key: "demographics", label: "Demographics" },
  { key: "signal", label: "Signal Fidelity" },
  { key: "intent", label: "Intent Fidelity" },
  { key: "ask", label: "Ask Your Research" },
];

export default function InsightProjectPage() {
  useAdaGreeting({ page: "insights" });
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setOpen } = useAda();

  const activeTab = (searchParams.get("tab") as Tab) || "intelligence";
  const [project, setProject] = useState<InsightProject | null>(null);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    insightScoreApi.getProject(id)
      .then(r => setProject(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    insightScoreApi.getReport(id)
      .then(r => { if (r.data?.executive_summary || r.data?.themes) setReport(r.data); })
      .catch(() => {});
  }, [id]);

  const setTab = (tab: Tab) => setSearchParams({ tab });
  if (!id) return null;

  const statusColor = project?.status === "complete" ? GREEN : project?.status === "error" ? RED : project?.status === "analysing" ? BLUE : AMBER;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate("/insights")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 12.5, padding: "4px 0" }}>
          <ChevronLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 14, background: "#E2E8F0" }} />
        {loading ? (
          <div style={{ height: 16, width: 160, borderRadius: 4, background: "#E8EDF5" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#080D1A", letterSpacing: -0.4 }}>{project?.name || "Project"}</div>
            {project?.status && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, textTransform: "capitalize" }}>{project.status}</span>
              </div>
            )}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {report && (
            <div style={{ display: "flex", gap: 6 }}>
              {(["docx", "pptx", "xlsx"] as const).map(fmt => (
                <button key={fmt} onClick={async () => {
                  try {
                    const res = await insightScoreApi.downloadReport(id, fmt);
                    const contentType = String(res.headers?.['content-type'] || res.headers?.['Content-Type'] || '');
                    const blob = new Blob([res.data]);
                    if (contentType.includes('application/json')) {
                      alert(`Report download failed. Please try again.`);
                      return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url;
                    a.download = `ResearchOS_${id}.${fmt}`; document.body.appendChild(a);
                    a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  } catch { alert(`Could not download ${fmt.toUpperCase()} report. Please try again.`); }
                }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 11px", border: "1px solid #E2E8F0", borderRadius: 8, background: "white", fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  <Download size={11} /> {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid #DBEAFE", borderRadius: 8, background: "#EFF6FF", fontSize: 12, fontWeight: 600, color: BLUE, cursor: "pointer" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden" }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
            </div>
            Ask Ada
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E8EDF5", marginBottom: 20, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? BLUE : "#6B7280", borderBottom: `2px solid ${activeTab === t.key ? BLUE : "transparent"}`, marginBottom: -1, transition: "all .15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
            {t.label}
            {t.key === "ask" && <span style={{ fontSize: 9, fontWeight: 800, color: GREEN, background: "#ECFDF5", borderRadius: 4, padding: "1px 5px" }}>NEW</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {activeTab === "interviews" && <InterviewsTab projectId={id} />}
          {activeTab === "intelligence" && <IntelligenceTab projectId={id} project={project} />}
          {activeTab === "questions" && <QuestionIntelligencePanel projectId={id} />}
          {activeTab === "demographics" && <DemographicIntelligencePanel projectId={id} />}
          {activeTab === "signal" && <SignalFidelityPanel projectId={id} />}
          {activeTab === "intent" && <IFIPanel projectId={id} />}
          {activeTab === "ask" && <AskResearchPanel projectId={id} report={report} />}
        </motion.div>
      </AnimatePresence>

      {!report && activeTab !== "intelligence" && activeTab !== "interviews" && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            style={{ background: "linear-gradient(135deg, #1A1F3E, #0F172A)", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,.1)" }}>
            <AlertCircle size={14} color={AMBER} />
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)" }}>Run Intelligence analysis to unlock all dimensions</span>
            <button onClick={() => setTab("intelligence")}
              style={{ padding: "5px 14px", borderRadius: 7, background: BLUE, border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Begin Analysis
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
