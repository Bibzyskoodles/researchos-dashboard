import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi, adaApi } from "../../services/api";
import { InsightProject } from "../../types";
import { ChevronRight, Clock, ArrowRight } from "lucide-react";

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
  "Question Intelligence", "MTI™", "Demographic Intelligence",
  "Evidence Engine", "Ask Your Research", "Intelligence Workbooks",
];

const ACTIVE_PROJECT = "658464e5-09dc-4b99-a664-05690de9921a";

function AdaHero({ onBegin, onReview }: { onBegin: () => void; onReview: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState<null | "begin" | "review">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await adaApi.chat(question, "insights", { mode: "ask_your_research_global" });
      setAnswer(res.data?.reply || res.data?.message || "Please select a project to search your research.");
    } catch {
      setAnswer("Please select a project to ask questions about your research.");
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  return (
    <div style={{
      background: "linear-gradient(135deg, #0C1128 0%, #0F172A 50%, #140E2B 100%)",
      borderRadius: 20, overflow: "hidden", position: "relative",
      boxShadow: "0 24px 80px rgba(8,13,26,.35)",
      border: "1px solid rgba(255,255,255,.06)",
    }}>
      {/* Glow orbs */}
      <div style={{ position: "absolute", top: -80, left: 80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: 120, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Main briefing row */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative", zIndex: 1 }}>

        {/* Ada portrait column */}
        <div style={{ width: 148, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "32px 0 0", alignSelf: "flex-end" }}>
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "relative" }}
          >
            {/* Pulse ring */}
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

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,.06)", flexShrink: 0 }} />

        {/* Briefing + ask */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.18)", border: "1px solid rgba(37,99,235,.28)", borderRadius: 6, padding: "3px 10px", marginBottom: 14 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#93C5FD", letterSpacing: 1.2, textTransform: "uppercase" }}>Ada Briefing</span>
          </div>

          <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.35, marginBottom: 10, letterSpacing: -.3 }}>
            I found 16 verified interviews ready for analysis.
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.52)", lineHeight: 1.65, marginBottom: 20, maxWidth: 480 }}>
            I expect themes around community perceptions, service access barriers, and unmet household needs. I can run Question Intelligence, MTI™, and Demographic analysis right now.
          </div>

          <AnimatePresence mode="wait">
            {answered === null ? (
              <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <button onClick={() => { setAnswered("begin"); setTimeout(onBegin, 350); }}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, background: BLUE, border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = ".85")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  Begin Analysis <ArrowRight size={13} />
                </button>
                <button onClick={() => { setAnswered("review"); setTimeout(onReview, 350); }}
                  style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.8)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.14)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}>
                  Review Interviews First
                </button>
              </motion.div>
            ) : (
              <motion.div key="ack" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: 13, color: "#60A5FA", fontWeight: 600, marginBottom: 24 }}>
                {answered === "begin" ? "Opening Research Intelligence Engine…" : "Opening interviews…"}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ask bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.25)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Ask Your Research</div>
            <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px" }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,.5)")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.12)")}>
              <input ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") ask(); }}
                placeholder="Why are young women less satisfied? · Compare Lagos and Abuja…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "white", fontFamily: "Inter,sans-serif", caretColor: "#60A5FA" }} />
              <button onClick={ask} disabled={!question.trim() || loading}
                style={{ padding: "5px 14px", borderRadius: 7, background: question.trim() && !loading ? BLUE : "rgba(255,255,255,.08)", border: "none", color: question.trim() && !loading ? "white" : "rgba(255,255,255,.3)", fontSize: 12, fontWeight: 700, cursor: question.trim() ? "pointer" : "default", transition: "all .15s", whiteSpace: "nowrap" }}>
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

      {/* Capability strip */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", padding: "12px 32px 12px 148px", display: "flex", gap: 8, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        {CAPABILITIES.map(cap => (
          <div key={cap} style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "3px 10px", letterSpacing: 0.2 }}>
            {cap}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: InsightProject; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLOR[project.status] ?? BLUE;
  return (
    <motion.div whileHover={{ y: -1 }} onClick={onClick}
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
              <span style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, background: "#F5F3FF", borderRadius: 4, padding: "1px 6px" }}>MTI™ · Questions · Demographics</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 11, fontWeight: 600, color }}>{STATUS_LABEL[project.status] ?? "Ready"}</span>
        </div>
        <ChevronRight size={14} color={hovered ? BLUE : "#D1D5DB"} style={{ transition: "color .15s" }} />
      </div>
    </motion.div>
  );
}

export default function InsightsPage() {
  const [projects, setProjects] = useState<InsightProject[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useAda();
  useAdaGreeting({ page: "insights" });

  useEffect(() => {
    insightScoreApi.getProjects()
      .then(r => setProjects(r.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AdaHero
        onBegin={() => navigate(`/insights/${ACTIVE_PROJECT}`)}
        onReview={() => navigate(`/insights/${ACTIVE_PROJECT}?tab=interviews`)}
      />

      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 12 }}>Your Projects</div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => navigate(`/insights/${p.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
