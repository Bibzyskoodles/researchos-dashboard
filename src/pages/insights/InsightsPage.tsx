import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi, adaApi } from "../../services/api";
import { InsightProject } from "../../types";
import { ChevronRight, Clock, ArrowRight, BarChart2, Users, Zap, BookOpen, MessageSquare, Download, Sparkles, Target, ChevronDown } from "lucide-react";
import OutcomeIntelligencePage from "./OutcomeIntelligencePage";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const PURPLE = "#7C3AED";

const STATUS_COLOR: Record<string, string> = {
  pending: AMBER, analysing: BLUE, complete: GREEN, error: "#DC2626",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Ready for review", analysing: "Analysing", complete: "Intelligence ready", error: "Needs attention",
};

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "Recently";
}

const CAPABILITIES = [
  {
    Icon: BarChart2,
    label: "Question Intelligence",
    desc: "Scores every question on effectiveness, skip rate, and sentiment — so you know which questions work and which to redesign.",
    color: BLUE,
    tab: "questions",
  },
  {
    Icon: Users,
    label: "Demographic Intelligence",
    desc: "Breaks down findings by gender, age, location, and any field in your data — revealing which segments hold the strongest signals.",
    color: PURPLE,
    tab: "demographics",
  },
  {
    Icon: Zap,
    label: "Signal Fidelity",
    desc: "Measures how well your research intent flows from questionnaire design through enumerator delivery to the final responses.",
    color: AMBER,
    tab: "signal",
  },
  {
    Icon: BookOpen,
    label: "Evidence Engine",
    desc: "Every insight is traceable. Themes and conclusions are grounded in direct quotes pulled from your interviews — nothing fabricated.",
    color: GREEN,
    tab: "intelligence",
  },
  {
    Icon: MessageSquare,
    label: "Ask Your Research",
    desc: "Ask any natural-language question and get evidence-backed answers drawn from your actual interviews — not an LLM guessing.",
    color: BLUE,
    tab: "ask",
  },
  {
    Icon: Download,
    label: "Intelligence Workbooks",
    desc: "Export your full analysis as DOCX, PPTX, or XLSX — presentation-ready and structured for stakeholder reporting.",
    color: "#374151",
    tab: "intelligence",
  },
];

function ProjectSelector({
  projects,
  selectedId,
  onSelect,
}: {
  projects: InsightProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find(p => p.id === selectedId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (projects.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "12px 16px", borderRadius: 12,
          background: selectedId ? "white" : "#EFF6FF",
          border: selectedId ? "1px solid #E8EDF5" : `2px solid ${BLUE}`,
          cursor: "pointer", fontFamily: "Inter,sans-serif",
          boxShadow: selectedId ? "0 1px 6px rgba(10,15,28,.06)" : `0 0 0 4px ${BLUE}14`,
          transition: "all .15s",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: selectedId ? `${BLUE}14` : BLUE,
          display: "grid", placeItems: "center", fontSize: 14,
        }}>
          {selectedId ? "📋" : <Sparkles size={14} color="white" />}
        </div>
        <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          {selected ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{selected.submission_count} interview{selected.submission_count !== 1 ? "s" : ""} · {STATUS_LABEL[selected.status] ?? "Ready"}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>Select a project to begin</div>
              <div style={{ fontSize: 11, color: "#3B82F6" }}>Choose which project you want Ada to analyse</div>
            </>
          )}
        </div>
        <ChevronDown size={16} color={selectedId ? "#9CA3AF" : BLUE} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
              background: "white", borderRadius: 12, border: "1px solid #E8EDF5",
              boxShadow: "0 12px 40px rgba(10,15,28,.12)", overflow: "hidden",
            }}
          >
            {projects.map(p => {
              const color = STATUS_COLOR[p.status] ?? BLUE;
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%",
                    padding: "11px 14px", background: isSelected ? "#EFF6FF" : "transparent",
                    border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif",
                    borderBottom: "1px solid #F3F4F6", textAlign: "left",
                    transition: "background .1s",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${BLUE}14`, display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>📋</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{p.submission_count} interview{p.submission_count !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color }}>{STATUS_LABEL[p.status] ?? "Ready"}</span>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdaHero({ projectId, disabled }: { projectId: string | null; disabled: boolean }) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState<null | "begin" | "review">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(async () => {
    if (!question.trim() || loading) return;
    if (!projectId) { setAnswer("Please select a project above to ask questions about your research."); return; }
    setLoading(true);
    setAnswer(null);
    try {
      const res = await adaApi.chat(question, "insights", { mode: "ask_your_research_global", project_id: projectId });
      setAnswer(res.data?.reply || res.data?.message || "No answer yet — try asking about themes, patterns, or specific respondent groups.");
    } catch {
      setAnswer("Unable to reach Ada right now. Make sure a project is selected and try again.");
    } finally {
      setLoading(false);
    }
  }, [question, loading, projectId]);

  const goTo = (stage: string = "analyse") => {
    if (!projectId) return;
    if (stage === "analyse") navigate(`/insights/${projectId}`);
    else navigate(`/projects/${projectId}/${stage}`);
  };

  const btnStyle = (active: boolean, primary: boolean) => ({
    display: "flex" as const, alignItems: "center" as const, gap: 7,
    padding: "9px 20px", borderRadius: 10, border: primary ? "none" : "1px solid rgba(255,255,255,.14)",
    color: active ? (primary ? "white" : "rgba(255,255,255,.8)") : "rgba(255,255,255,.25)",
    background: active ? (primary ? BLUE : "rgba(255,255,255,.08)") : "rgba(255,255,255,.04)",
    fontSize: 13, fontWeight: primary ? 700 : 600,
    cursor: active ? "pointer" : "not-allowed",
    fontFamily: "Inter,sans-serif",
    transition: "opacity .15s",
    opacity: active ? 1 : 0.5,
  });

  return (
    <div style={{
      background: "linear-gradient(135deg, #0C1128 0%, #0F172A 55%, #140E2B 100%)",
      borderRadius: 20, overflow: "hidden", position: "relative",
      boxShadow: "0 24px 80px rgba(8,13,26,.35)",
      border: "1px solid rgba(255,255,255,.06)",
    }}>
      <div style={{ position: "absolute", top: -80, left: 80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: 120, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "stretch", position: "relative", zIndex: 1 }}>
        {/* Ada portrait */}
        <div style={{ width: 148, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "32px 0 0", alignSelf: "flex-end" }}>
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ position: "relative" }}>
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
              style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid #60A5FA", pointerEvents: "none" }}
            />
            <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", border: "2.5px solid rgba(255,255,255,.22)", boxShadow: "0 0 40px rgba(37,99,235,.35)" }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
            </div>
          </motion.div>
          <div style={{ marginTop: 10, marginBottom: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "white", letterSpacing: 0.3 }}>Ada</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.35)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 1 }}>Research Analyst</div>
          </div>
        </div>

        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,.06)", flexShrink: 0 }} />

        {/* Briefing + ask */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.18)", border: "1px solid rgba(37,99,235,.28)", borderRadius: 6, padding: "3px 10px", marginBottom: 14 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#93C5FD", letterSpacing: 1.2, textTransform: "uppercase" }}>Ada Briefing</span>
          </div>

          {disabled ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.35, marginBottom: 10, letterSpacing: -.3 }}>
                Select a project above to begin.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.42)", lineHeight: 1.65, marginBottom: 20, maxWidth: 480 }}>
                Once you choose a project, I'll brief you on your verified interviews and what analysis I can run — including Question Intelligence, Signal Fidelity, and Demographic breakdowns.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.35, marginBottom: 10, letterSpacing: -.3 }}>
                I found verified interviews ready for analysis.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.52)", lineHeight: 1.65, marginBottom: 20, maxWidth: 480 }}>
                I can run Question Intelligence, Signal Fidelity, and Demographic analysis right now. Or review the raw interviews first to get familiar with the data.
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
            {answered === null ? (
              <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <button
                  onClick={() => { if (disabled) return; setAnswered("begin"); setTimeout(() => goTo("analyse"), 350); }}
                  style={btnStyle(!disabled, true)}
                  title={disabled ? "Select a project first" : undefined}
                >
                  Begin Analysis <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => { if (disabled) return; setAnswered("review"); setTimeout(() => goTo("verify"), 350); }}
                  style={btnStyle(!disabled, false)}
                  title={disabled ? "Select a project first" : undefined}
                >
                  Review Interviews First
                </button>
              </motion.div>
            ) : (
              <motion.div key="ack" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 13, color: "#60A5FA", fontWeight: 600, marginBottom: 24 }}>
                {answered === "begin" ? "Opening Research Intelligence Engine…" : "Opening interviews…"}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ask bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.25)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Ask Your Research</div>
            <div style={{
              display: "flex", gap: 8, background: disabled ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px",
              opacity: disabled ? 0.5 : 1,
            }}
              onFocusCapture={e => { if (!disabled) e.currentTarget.style.borderColor = "rgba(37,99,235,.5)"; }}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.12)")}>
              <input
                ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") ask(); }}
                disabled={disabled}
                placeholder={disabled ? "Select a project above to ask questions…" : "Why are young women less satisfied? · Compare Lagos and Abuja…"}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "white", fontFamily: "Inter,sans-serif", caretColor: "#60A5FA", cursor: disabled ? "not-allowed" : "text" }}
              />
              <button
                onClick={ask} disabled={!question.trim() || loading || disabled}
                style={{ padding: "5px 14px", borderRadius: 7, background: question.trim() && !loading && !disabled ? BLUE : "rgba(255,255,255,.08)", border: "none", color: question.trim() && !loading && !disabled ? "white" : "rgba(255,255,255,.3)", fontSize: 12, fontWeight: 700, cursor: question.trim() && !disabled ? "pointer" : "default", transition: "all .15s", whiteSpace: "nowrap" }}
              >
                {loading ? "Searching…" : "Ask"}
              </button>
            </div>
            <AnimatePresence>
              {answer && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ marginTop: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.65 }}>
                  {answer}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityGrid({ projectId, disabled }: { projectId: string | null; disabled: boolean }) {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 4 }}>What Ada can do for your research</div>
      {disabled && (
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
          Select a project above to activate these capabilities.
        </div>
      )}
      {!disabled && <div style={{ marginBottom: 12 }} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {CAPABILITIES.map(({ Icon, label, desc, color, tab }) => (
          <motion.div
            key={label}
            whileHover={disabled ? {} : { y: -2, boxShadow: "0 6px 24px rgba(37,99,235,.1)" }}
            onClick={() => { if (disabled || !projectId) return; navigate(`/insights/${projectId}?tab=${tab}`); }}
            style={{
              background: "white", borderRadius: 12, padding: "16px 16px",
              border: "1px solid #E8EDF5", display: "flex", gap: 12, alignItems: "flex-start",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "border-color .15s",
              opacity: disabled ? 0.45 : 1,
            }}
            onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = `${color}44`; }}
            onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = "#E8EDF5"; }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}12`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A", marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280", lineHeight: 1.55 }}>{desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, onSelect }: { project: InsightProject; onSelect: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLOR[project.status] ?? BLUE;
  return (
    <motion.div whileHover={{ y: -1 }} onClick={() => onSelect(project.id)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: "white", borderRadius: 12, padding: "14px 18px", border: `1px solid ${hovered ? "#BFDBFE" : "#E8EDF5"}`, boxShadow: hovered ? "0 4px 20px rgba(37,99,235,.09)" : "0 1px 6px rgba(10,15,28,.04)", cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${BLUE}14, ${PURPLE}14)`, display: "grid", placeItems: "center", fontSize: 18 }}>📋</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</div>
        <div style={{ fontSize: 11.5, color: "#6B7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{project.submission_count} interview{project.submission_count !== 1 ? "s" : ""}</span>
          <span style={{ color: "#D1D5DB" }}>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} />{timeSince(project.last_activity || project.created_at)}</span>
          {project.status === "complete" && (
            <>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, background: "#F5F3FF", borderRadius: 4, padding: "1px 6px" }}>Signal Fidelity · Questions · Demographics</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 11, fontWeight: 600, color }}>{STATUS_LABEL[project.status] ?? "Ready"}</span>
        </div>
        <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
          Select <ChevronRight size={12} color={hovered ? BLUE : "#D1D5DB"} style={{ transition: "color .15s" }} />
        </div>
      </div>
    </motion.div>
  );
}

type InsightsTab = "analysis" | "outcome";

export default function InsightsPage() {
  const [projects, setProjects] = useState<InsightProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InsightsTab>("analysis");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  useAda();
  useAdaGreeting({ page: "insights" });

  useEffect(() => {
    insightScoreApi.getProjects()
      .then(r => {
        const list: InsightProject[] = r.data || [];
        setProjects(list);
      })
      .catch(() => {
        // InsightScore service unreachable — show empty state rather than
        // silently substituting FieldScore IDs (which would 404 on every tab)
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-select only project if there's exactly one
  useEffect(() => {
    if (projects.length === 1 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const disabled = !selectedProjectId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Mode switcher */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {([
          {
            id: "analysis" as InsightsTab,
            icon: Sparkles,
            label: "AI Analysis",
            desc: "Run Question Intelligence, Signal Fidelity, Demographic breakdowns, and Evidence Engine on your verified interviews. Ada surfaces findings your team might miss.",
            color: BLUE,
            badge: "InsightScore",
          },
          {
            id: "outcome" as InsightsTab,
            icon: Target,
            label: "Outcome Intelligence",
            desc: "Track KPIs, outcome indicators, and research targets across your portfolio. See how each project is progressing toward your theory of change.",
            color: PURPLE,
            badge: "New",
          },
        ]).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 10, padding: "18px 20px", borderRadius: 14, border: "none",
                cursor: "pointer", fontFamily: "Inter,sans-serif", textAlign: "left",
                background: active ? tab.color : "white",
                boxShadow: active ? `0 6px 24px ${tab.color}30` : "0 2px 12px rgba(10,15,28,.06)",
                outline: active ? "none" : `1px solid #E8EDF5`,
                transition: "all .18s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: active ? "rgba(255,255,255,.2)" : `${tab.color}14`,
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <Icon size={18} color={active ? "white" : tab.color} />
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: active ? "rgba(255,255,255,.2)" : `${tab.color}14`,
                  color: active ? "white" : tab.color, letterSpacing: 0.5,
                }}>{tab.badge}</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: active ? "white" : "#080D1A", marginBottom: 4, letterSpacing: -0.3 }}>{tab.label}</div>
                <div style={{ fontSize: 12, color: active ? "rgba(255,255,255,.75)" : "#6B7280", lineHeight: 1.55 }}>{tab.desc}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {activeTab === "outcome" && <OutcomeIntelligencePage />}

      {activeTab === "analysis" && (
        <>
          {/* Project selector — always visible, prominent when nothing selected */}
          {!loading && projects.length > 0 && (
            <ProjectSelector
              projects={projects}
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
          )}

          <AdaHero projectId={selectedProjectId} disabled={disabled} />
          <CapabilityGrid projectId={selectedProjectId} disabled={disabled} />

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 4 }}>Your Projects</div>
            {!selectedProjectId && projects.length > 0 && (
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
                Click a project below to select it, or use the picker above.
              </div>
            )}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2].map(i => <div key={i} style={{ height: 72, borderRadius: 12, background: "white", border: "1px solid #E8EDF5" }} />)}
              </div>
            ) : projects.length === 0 ? (
              <div style={{ background: "white", borderRadius: 14, padding: "32px 24px", border: "1px solid #E8EDF5", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>No projects yet</div>
                <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>Ada will brief you here once interviews are ready for analysis.</div>
              </div>
            ) : (
              <div data-ada-target="insights-projects" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projects.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onSelect={id => {
                      setSelectedProjectId(id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
