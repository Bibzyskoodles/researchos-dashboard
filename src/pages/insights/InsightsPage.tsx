import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi } from "../../services/api";
import { adaApi } from "../../services/api";
import { InsightProject } from "../../types";
import { ChevronRight, Clock } from "lucide-react";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const PURPLE = "#7C3AED";

const STATUS_LABEL: Record<string, string> = {
  pending: "Ready for review",
  analysing: "Ada is reading the interviews",
  complete: "Intelligence ready",
  error: "Needs attention",
};

const STATUS_COLOR: Record<string, string> = {
  pending: AMBER,
  analysing: BLUE,
  complete: GREEN,
  error: "#DC2626",
};

function statusLabel(s: string) { return STATUS_LABEL[s] ?? "Ready for review"; }
function statusColor(s: string) { return STATUS_COLOR[s] ?? BLUE; }

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "Recently";
}

interface ProjectCardProps { project: InsightProject; onClick: () => void; }

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div whileHover={{ y: -2 }} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "white", borderRadius: 14, padding: "16px 20px", border: `1px solid ${hovered ? "#BFDBFE" : "#E8EDF5"}`, boxShadow: hovered ? "0 4px 20px rgba(37,99,235,.1)" : "0 2px 8px rgba(10,15,28,.05)", cursor: "pointer", transition: "border-color .15s, box-shadow .15s", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${BLUE}18, ${PURPLE}18)`, display: "grid", placeItems: "center", fontSize: 20 }}>📋</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#080D1A", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</div>
        <div style={{ fontSize: 11.5, color: "#6B7280", display: "flex", alignItems: "center", gap: 10 }}>
          <span>{project.submission_count} interview{project.submission_count !== 1 ? "s" : ""}</span>
          <span style={{ color: "#D1D5DB" }}>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} />{timeSince(project.last_activity || project.created_at)}</span>
          {project.status === "complete" && (
            <>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: "#F5F3FF", borderRadius: 4, padding: "1px 6px" }}>MTI™ · Questions · Demographics</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(project.status) }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor(project.status) }}>{statusLabel(project.status)}</span>
        </div>
        <ChevronRight size={14} color={hovered ? BLUE : "#9CA3AF"} style={{ transition: "color .15s" }} />
      </div>
    </motion.div>
  );
}

function GlobalAskBar() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await adaApi.chat(question, "insights", { mode: "ask_your_research_global" });
      setAnswer(res.data?.reply || res.data?.message || "I need a specific project selected to search your research. Click any project below to begin.");
    } catch {
      setAnswer("Please select a project to ask questions about your research.");
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") ask(); };

  return (
    <div style={{ background: "linear-gradient(135deg, #1A1F3E 0%, #0F172A 40%, #1E1B4B 100%)", borderRadius: 16, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: 160, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,.2),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <motion.div onClick={() => inputRef.current?.focus()}
            style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: "3px solid rgba(255,255,255,.25)", flexShrink: 0 }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </motion.div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#93C5FD", letterSpacing: 1, textTransform: "uppercase" }}>Research Intelligence Engine</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Ask Your Research</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 3 }}>Evidence-grounded answers from every interview your organisation has conducted</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", marginBottom: answer ? 14 : 0 }}>
          <input ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={handleKey}
            placeholder="Why are young women less satisfied? · Compare Lagos and Abuja · Which questions confused respondents?"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "white", fontFamily: "Inter,sans-serif" }} />
          <button onClick={ask} disabled={!question.trim() || loading}
            style={{ padding: "6px 16px", borderRadius: 8, background: question.trim() && !loading ? BLUE : "rgba(255,255,255,.1)", border: "none", color: "white", fontSize: 12.5, fontWeight: 700, cursor: question.trim() ? "pointer" : "default", transition: "all .15s" }}>
            {loading ? "Searching..." : "Ask"}
          </button>
        </div>

        <AnimatePresence>
          {answer && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,.8)", lineHeight: 1.6 }}>
              {answer}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RIECapabilities() {
  const DIMS = [
    { icon: "❓", label: "Question Intelligence", desc: "Effectiveness, skip rates, sentiment, themes" },
    { icon: "👥", label: "Demographic Intelligence", desc: "Cross-dimension breakdowns, segment comparisons" },
    { icon: "🎯", label: "Meaning Transfer™", desc: "Proprietary alignment from intent to response" },
    { icon: "🔍", label: "Evidence Engine", desc: "Every insight backed by traceable quotes" },
    { icon: "💬", label: "Ask Your Research", desc: "Natural language search across all interviews" },
    { icon: "📊", label: "Intelligence Workbooks", desc: "Downloadable DOCX, PPTX, XLSX exports" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {DIMS.map(d => (
        <div key={d.label} style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: "1px solid #E8EDF5", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{d.icon}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#080D1A", marginBottom: 2 }}>{d.label}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.4 }}>{d.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const ACTIVE_PROJECT = "658464e5-09dc-4b99-a664-05690de9921a";

export default function InsightsPage() {
  const [projects, setProjects] = useState<InsightProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adaAnswered, setAdaAnswered] = useState<null | "begin" | "review">(null);
  const navigate = useNavigate();
  const { setOpen } = useAda();
  useAdaGreeting({ page: "insights" });

  useEffect(() => {
    insightScoreApi.getProjects()
      .then(r => setProjects(r.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const handleBegin = () => { setAdaAnswered("begin"); setTimeout(() => navigate(`/insights/${ACTIVE_PROJECT}`), 400); };
  const handleReview = () => { setAdaAnswered("review"); setTimeout(() => navigate(`/insights/${ACTIVE_PROJECT}?tab=interviews`), 400); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlobalAskBar />

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Platform Capabilities</div>
        <RIECapabilities />
      </div>

      <div style={{ background: "linear-gradient(135deg, #1A1F3E 0%, #0F172A 40%, #1E1B4B 100%)", borderRadius: 16, overflow: "hidden", position: "relative", boxShadow: "0 8px 40px rgba(8,13,26,.2)" }}>
        <div style={{ position: "absolute", bottom: -40, left: 80, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,.15),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "stretch", position: "relative", zIndex: 1 }}>
          <div style={{ width: 140, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "20px 10px 0" }}>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ width: 100, height: 100 }}>
              <motion.div onClick={() => setOpen(true)}
                animate={{ boxShadow: ["0 0 0 0 rgba(96,165,250,0)", "0 0 0 10px rgba(96,165,250,0.3)", "0 0 0 20px rgba(96,165,250,0)", "0 0 0 0 rgba(96,165,250,0)"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: "3px solid rgba(255,255,255,.25)" }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </motion.div>
            </motion.div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: 1.2, textTransform: "uppercase" }}>Ada · Analyst</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: "24px 24px 24px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#93C5FD", letterSpacing: 1, textTransform: "uppercase" }}>Ada Briefing</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "white", lineHeight: 1.4, marginBottom: 8 }}>I found 16 verified interviews ready for analysis.</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", lineHeight: 1.6, maxWidth: 440 }}>Based on what I can see, I expect themes around community perceptions, service access barriers, and unmet household needs. I can analyse Question Intelligence, MTI, and Demographic dimensions. Would you like to begin?</div>
            </div>
            <AnimatePresence mode="wait">
              {adaAnswered === null ? (
                <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleBegin} style={{ padding: "9px 20px", borderRadius: 10, background: BLUE, border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                    Begin Analysis
                  </button>
                  <button onClick={handleReview} style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.16)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}>
                    Review Interviews First
                  </button>
                </motion.div>
              ) : (
                <motion.div key="ack" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 13, color: "#60A5FA", fontWeight: 600 }}>
                  {adaAnswered === "begin" ? "Opening Research Intelligence Engine..." : "Opening interviews..."}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Your Projects</div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2].map(i => <div key={i} style={{ height: 76, borderRadius: 14, background: "white", border: "1px solid #E8EDF5" }} />)}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: "32px 24px", border: "1px solid #E8EDF5", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>No projects yet</div>
            <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>Ada will brief you here once interviews are ready for analysis.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => navigate(`/insights/${p.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
