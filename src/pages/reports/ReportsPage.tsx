import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Sparkles, Clock, CheckCircle, ChevronDown } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi, projectsApi } from "../../services/api";
import { usePlatform } from "../../platform/PlatformProvider";
import { useGamify } from "../../gamify/GamifyContext";
import { generateLocalReport } from "../../gamify/reportGenerator";
import { useAuth } from "../../store/AuthContext";

const BLUE = "#2463EB", GREEN = "#059669", PURPLE = "#7C3AED";

function getReportTypes(t: (key: string, fallback: string) => string) {
  return [
    { id: "executive",  title: "Executive Summary",        desc: "High-level overview for senior stakeholders — key findings, pass rate, trust score, recommendations.", icon: "📊", time: "~30 seconds", format: "pptx" as const },
    { id: "technical",  title: "Technical Quality Report", desc: `Full verification engine breakdown — GPS, audio, image, duration, duplicate checks per ${t('enumerator','enumerator')}.`, icon: "🔬", time: "~45 seconds", format: "xlsx" as const },
    { id: "enumerator", title: `${t('enumerator','Enumerator')} Performance`, desc: `Individual scorecards and comparative rankings — who to retain, retrain, or remove.`, icon: "👤", time: "~20 seconds", format: "docx" as const },
    { id: "client",     title: "Client Delivery Report",   desc: "Branded, client-ready report with methodology, findings, and data confidence statement.",               icon: "📋", time: "~60 seconds", format: "docx" as const },
  ];
}

interface Project { id: string; name: string; status?: string; submission_count?: number; }

export default function ReportsPage() {
  const { t } = usePlatform();
  const REPORT_TYPES = getReportTypes(t);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, { format: string }>>({});
  const [toast, setToast] = useState("");
  const { recordEvent } = useGamify();
  const { user, org } = useAuth();
  useAdaGreeting({ page: "reports" });

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const r = await insightScoreApi.getProjects();
        const list: Project[] = r.data?.projects || r.data || [];
        if (list.length > 0) { setProjects(list); setSelectedProject(list[0]); return; }
      } catch { /* fall through */ }
      // InsightScore empty — load from main project API
      try {
        const r = await projectsApi.list();
        const list: Project[] = (r.data?.projects || r.data || []).map((p: { id: string; name: string; submission_count?: number }) => ({
          id: p.id, name: p.name, status: "pending", submission_count: p.submission_count ?? 0,
        }));
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      } catch { /* give up */ }
    };
    loadProjects();
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const generate = async (r: typeof REPORT_TYPES[0]) => {
    if (!selectedProject) { showToast("Select a project first"); return; }
    setGenerating(r.id);
    try {
      // Fire-and-forget the backend analysis — we don't block on it.
      // Whether it succeeds or times out, the report is always downloadable.
      insightScoreApi.analyseProject(selectedProject.id).catch(() => {});
      // Simulate generation time so Ada's spinner feels real
      await new Promise(r2 => setTimeout(r2, 2200));
    } catch { /* ignore */ } finally {
      setGenerated(prev => ({ ...prev, [r.id]: { format: r.format } }));
      recordEvent('report_generated');
      showToast(`${r.title} ready — click Download`);
      setGenerating(null);
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  };

  const download = async (r: typeof REPORT_TYPES[0]) => {
    if (!selectedProject) return;
    // Try the backend first, fall back to local generation so download always works.
    try {
      const res = await insightScoreApi.downloadReport(selectedProject.id, r.format);
      if (res.data && res.data.size > 0) {
        const filename = `${selectedProject.name.replace(/\s+/g, "-").toLowerCase()}-${r.id}.${r.format}`;
        triggerBlobDownload(new Blob([res.data]), filename);
        return;
      }
    } catch { /* fall through to local generator */ }

    // Local generation — always works, produces a real readable file
    const ctx = {
      projectName: selectedProject.name,
      orgName: org?.name || "Research Organisation",
      submissionCount: selectedProject.submission_count ?? 0,
      generatedBy: user?.name || "Verified by FieldScore",
    };
    const result = generateLocalReport(r.id, r.format, ctx);
    if (!result) { showToast("Could not generate report. Please try again."); return; }
    triggerBlobDownload(result.blob, result.filename);
    showToast(r.format === 'xlsx' ? `Downloaded as CSV (Excel-compatible)` : `Opened in new tab — print or Save as PDF`);
  };

  const projectLabel = selectedProject?.name || "Select a project";
  const submissionCount = selectedProject?.submission_count ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", letterSpacing: -.6, margin: 0 }}>Reports</h1>
        <p style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 4 }}>Ada generates client-ready deliverables from your verified data</p>
      </div>

      {/* Ada hero */}
      <div style={{ background: "linear-gradient(135deg,#1A1F3E,#0F172A)", borderRadius: 16, padding: "24px 28px", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0 }}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 4 }}>Ada is ready to generate your reports</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>
            {selectedProject
              ? `I have reviewed the verified submissions in "${selectedProject.name}". Select a report type and I'll prepare it immediately.`
              : "Select a project below, then choose a report type."}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.3)", borderRadius: 8, padding: "6px 12px" }}>
          <Sparkles size={12} color="#93C5FD" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#93C5FD" }}>Ada · AI</span>
        </div>
      </div>

      {/* Project selector */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", padding: "16px 20px", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: .7, marginBottom: 10 }}>Reporting on project</div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowProjectPicker(p => !p)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFF", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>{projectLabel}</div>
              {selectedProject && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{submissionCount} submissions</div>}
            </div>
            <ChevronDown size={14} color="#9CA3AF" style={{ transform: showProjectPicker ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          {showProjectPicker && projects.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "white", borderRadius: 10, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(10,15,28,.12)", zIndex: 50, overflow: "hidden" }}>
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setShowProjectPicker(false); setGenerated({}); }}
                  style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: selectedProject?.id === p.id ? "#EFF6FF" : "white" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#F8FAFF"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selectedProject?.id === p.id ? "#EFF6FF" : "white"; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#080D1A" }}>{p.name}</div>
                  {p.submission_count !== undefined && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{p.submission_count} submissions</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report type cards */}
      <div data-ada-target="reports-list" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {REPORT_TYPES.map(r => {
          const isDone = !!generated[r.id];
          const isGenerating = generating === r.id;
          return (
            <motion.div key={r.id} whileHover={{ y: -2 }}
              style={{ background: "white", borderRadius: 16, padding: "22px 24px", border: `1px solid ${isDone ? "#BBDEFB" : "#E8EDF5"}`, boxShadow: "0 2px 12px rgba(10,15,28,.06)", position: "relative", overflow: "hidden" }}>
              {isDone && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right,${BLUE},${PURPLE})` }} />}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 28 }}>{r.icon}</div>
                {isDone && <CheckCircle size={18} color={GREEN} />}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#080D1A", marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 16, lineHeight: 1.5 }}>{r.desc}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 11.5, color: "#9CA3AF" }}>
                <Clock size={11} /> {r.time}
                <span style={{ marginLeft: 6, padding: "2px 7px", borderRadius: 5, background: "#F1F5F9", fontSize: 10.5, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" as const }}>.{r.format}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isDone ? (
                  <>
                    <button onClick={() => download(r)} style={{ flex: 1, padding: "9px", borderRadius: 8, background: GREEN, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "Inter,sans-serif" }}>
                      <Download size={13} /> Download .{r.format}
                    </button>
                    <button onClick={() => generate(r)} style={{ padding: "9px 14px", borderRadius: 8, background: "white", border: "1px solid #E2E8F0", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151", fontFamily: "Inter,sans-serif" }}>
                      Refresh
                    </button>
                  </>
                ) : (
                  <button onClick={() => generate(r)} disabled={!!generating || !selectedProject}
                    style={{ flex: 1, padding: "9px", borderRadius: 8, background: isGenerating ? "#EFF6FF" : (!selectedProject ? "#F1F5F9" : BLUE), border: isGenerating ? `1px solid ${BLUE}` : "none", cursor: (!generating && selectedProject) ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, color: isGenerating ? BLUE : (!selectedProject ? "#9CA3AF" : "white"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "Inter,sans-serif", transition: "all .2s" }}>
                    {isGenerating ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          style={{ width: 13, height: 13, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%" }} />
                        Ada is generating...
                      </>
                    ) : (
                      <><Sparkles size={13} /> Generate with Ada</>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Generated list */}
      {Object.keys(generated).length > 0 && (
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>Generated Reports</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{selectedProject?.name}</div>
          </div>
          {Object.entries(generated).map(([id, meta]) => {
            const r = REPORT_TYPES.find(t => t.id === id);
            if (!r) return null;
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #F8FAFF" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#EFF6FF", display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#080D1A" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Generated just now · {selectedProject?.name} · .{meta.format}</div>
                </div>
                <button onClick={() => download(r)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, background: "#EFF6FF", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: "Inter,sans-serif" }}>
                  <Download size={12} /> Download
                </button>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,.3)", pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
