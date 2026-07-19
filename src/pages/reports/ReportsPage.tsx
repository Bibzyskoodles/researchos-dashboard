import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Download, Sparkles, Clock, CheckCircle, ChevronDown, Share2, Copy, Check, CalendarClock, Power, Trash2, X } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi, projectsApi, dashboardApi, orgSettingsApi, reportShareApi, reportScheduleApi, ReportSchedule } from "../../services/api";
import { usePlatform } from "../../platform/PlatformProvider";
import { useGamify } from "../../gamify/GamifyContext";
import { generateLocalReport, ReportContext, EnumeratorRow, EngineRow } from "../../gamify/reportGenerator";
import { useAuth } from "../../store/AuthContext";
import { loadEngineConfig } from "../../services/engineConfig";
import { computeTrustIndex } from "../../services/trustEngine";

const BLUE = "#2463EB", GREEN = "#059669", PURPLE = "#7C3AED";

function getReportTypes(t: (key: string, fallback: string) => string) {
  return [
    {
      id: "executive",  title: "Executive Summary", icon: "📊", time: "~30 seconds", format: "pptx" as const,
      desc: "High-level overview for senior stakeholders and boards.",
      contents: ["Pass rate & Trust Index KPIs", "Ada AI analysis summary", "IFI signal quality score", "Data-driven recommendations", "Verification statement"],
      audience: "Board / Senior Management",
    },
    {
      id: "technical",  title: "Technical Quality Report", icon: "🔬", time: "~45 seconds", format: "xlsx" as const,
      desc: `Per-engine verification breakdown for QA and data teams.`,
      contents: ["GPS, audio, image, duration scores", `${t('enumerator','Enumerator')} performance table`, "Engine weight configuration", "Flag-by-flag breakdown", "Rescore audit trail"],
      audience: "QA / Data Team",
    },
    {
      id: "enumerator", title: `${t('enumerator','Enumerator')} Performance`, icon: "👤", time: "~20 seconds", format: "docx" as const,
      desc: `Individual scorecards and tier rankings for field supervision.`,
      contents: ["Ranked performance table", "Tier badges (Excellent → At Risk)", "Top/bottom performer spotlight", "Pass-rate stacked bar charts", "Retraining recommendations"],
      audience: "Field Supervisor",
    },
    {
      id: "client",     title: "Client Delivery Report", icon: "📋", time: "~60 seconds", format: "docx" as const,
      desc: "Branded, client-ready deliverable with full methodology.",
      contents: ["Branded cover page", "Respondent voice quotes", "Methodology & verification statement", "Data confidence certificate", "Recommendations for action"],
      audience: "Client / Donor",
    },
  ];
}

interface Project { id: string; name: string; status?: string; submission_count?: number; insightscore_project_id?: string; }

// Build a rich ReportContext by fetching real data for the selected project
async function buildReportContext(
  project: Project,
  orgName: string,
  generatedBy: string
): Promise<ReportContext> {
  const base: ReportContext = {
    projectName: project.name,
    orgName,
    generatedBy,
    submissionCount: project.submission_count ?? 0,
    passCount: 0,
    flagCount: 0,
    rejectCount: 0,
  };

  // 1. Real submission stats — per-verdict counts and per-engine breakdown.
  // /api/submissions already returns detail=True rows (per-engine `checks`
  // for every row — see fieldscore-backend's submissions() route), so the
  // pass/flag/reject counts here are recomputed live from the *current*
  // engine config, the same way every individual row on SubmissionsPage.tsx
  // already is — not the raw backend Verdict, which is frozen at scoring
  // time and can legitimately drift from it (see OverviewPage.tsx's
  // liveStats for the same fix on the dashboard).
  let subs: any[] = [];
  try {
    const r = await dashboardApi.getSubmissions({ project_id: project.id, limit: 2000 });
    subs = r.data?.submissions || r.data || [];
    if (subs.length) {
      const engineCfg = loadEngineConfig();
      const effectiveVerdict = (s: any) =>
        (s.verdict_override || computeTrustIndex(s, engineCfg).verdict || s.verdict || s.Verdict || 'FLAG') as 'PASS' | 'FLAG' | 'REJECT';
      base.submissionCount = subs.length;
      base.passCount   = subs.filter(s => effectiveVerdict(s) === 'PASS').length;
      base.flagCount   = subs.filter(s => effectiveVerdict(s) === 'FLAG').length;
      base.rejectCount = subs.filter(s => effectiveVerdict(s) === 'REJECT').length;

      // Per-engine breakdown — aggregate from individual engine scores when present
      const engineNames: Record<string, string> = {
        gps_score: 'GPS Accuracy', duration_score: 'Interview Duration',
        image_score: 'Image Quality', audio_score: 'Audio Quality',
        duplicate_score: 'Duplicate Detection', text_ai_score: 'AI Content Detection',
      };
      const engineRows: EngineRow[] = [];
      Object.entries(engineNames).forEach(([key, name]) => {
        const scored = subs.filter(s => s[key] !== undefined && s[key] !== null);
        if (!scored.length) return;
        const pass   = scored.filter(s => s[key] >= 70).length;
        const reject = scored.filter(s => s[key] < 40).length;
        const flag   = scored.length - pass - reject;
        engineRows.push({ name, pass, flag, reject, total: scored.length });
      });
      if (engineRows.length) base.engineRows = engineRows;
    }
  } catch { /* non-fatal */ }

  // 2. Real enumerator data — grouped live from the same detail-carrying
  // submission rows fetched in step 1, instead of a second /api/enumerators
  // call whose pass_count/flag_count are the same raw, frozen Verdict tally
  // this fix is replacing everywhere else. Reusing `subs` also avoids a
  // second (potentially large) payload for the same project.
  try {
    if (subs.length) {
      const engineCfg = loadEngineConfig();
      const effectiveVerdict = (s: any) =>
        (s.verdict_override || computeTrustIndex(s, engineCfg).verdict || s.verdict || s.Verdict || 'FLAG') as 'PASS' | 'FLAG' | 'REJECT';
      const byEnum: Record<string, { pass: number; flag: number; reject: number; total: number }> = {};
      subs.forEach(s => {
        const eid = s.enumerator_id || s.Enumerator_ID || 'Unknown';
        const bucket = byEnum[eid] || (byEnum[eid] = { pass: 0, flag: 0, reject: 0, total: 0 });
        const v = effectiveVerdict(s);
        bucket.total++;
        if (v === 'PASS') bucket.pass++;
        else if (v === 'REJECT') bucket.reject++;
        else bucket.flag++;
      });
      base.enumeratorRows = Object.entries(byEnum).map(([eid, c]) => ({
        name: eid,
        submissions: c.total,
        pass:   c.pass,
        flag:   c.flag,
        reject: c.reject,
      } as EnumeratorRow));
    }
  } catch { /* non-fatal */ }

  // 3. Org branding
  try {
    const r = await orgSettingsApi.getSettings();
    const d = r.data || {};
    if (d.brand_primary_color) base.primaryColor = d.brand_primary_color;
    if (d.brand_accent_color)  base.accentColor  = d.brand_accent_color;
    if (d.brand_font)          base.brandFont    = d.brand_font;
    if (d.brand_footer)        base.brandFooter  = d.brand_footer;
    // Logo lives in localStorage (uploaded client-side as a data URL)
    const logo = localStorage.getItem('org_logo');
    if (logo) base.logoDataUrl = logo;
  } catch { /* non-fatal */ }

  // 4. AI insights from InsightScore
  const iscId = project.insightscore_project_id || project.id;
  try {
    const r = await insightScoreApi.getReport(iscId);
    const rep = r.data;
    if (rep) {
      if (rep.executive_summary)   base.aiSummary = rep.executive_summary;
      if (rep.themes?.length)      base.aiThemes  = rep.themes.slice(0, 8);
      if (rep.quotes?.length)      base.aiQuotes  = rep.quotes.slice(0, 3);
      if (rep.ifi_score !== undefined) base.ifScore = rep.ifi_score;
    }
  } catch { /* non-fatal */ }

  return base;
}

export default function ReportsPage() {
  const { t } = usePlatform();
  const REPORT_TYPES = getReportTypes(t);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, { format: string }>>({});
  const [lastGenerated, setLastGenerated] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [copiedShare, setCopiedShare] = useState<string | null>(null);
  // Scheduled report delivery — the inline "Schedule" form + the list of
  // schedules already created for the currently selected project.
  const [schedulingFormFor, setSchedulingFormFor] = useState<string | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [scheduleEmails, setScheduleEmails] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const { recordEvent } = useGamify();
  const { user, org } = useAuth();
  // Creating a share link is admin/manager only server-side (see
  // project_routes.py's create_report_share, gated by can(role, "export"))
  // — this UI check is only so viewer/client accounts never see a button
  // that would 403; the backend is the real enforcement (see CLAUDE.md).
  const canShare = user?.role === "admin" || user?.role === "manager";
  const ctxCache = useRef<ReportContext | null>(null);
  const selectedProjectRef = useRef<Project | null>(null);
  useAdaGreeting({ page: "reports" });

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const r = await insightScoreApi.getProjects();
        const list: Project[] = r.data?.projects || r.data || [];
        if (list.length > 0) { setProjects(list); setSelectedProject(list[0]); return; }
      } catch { /* fall through */ }
      try {
        const r = await projectsApi.list();
        const list: Project[] = (r.data?.projects || r.data || []).map((p: any) => ({
          id: p.id, name: p.name, status: "pending",
          submission_count: p.submission_count ?? 0,
          insightscore_project_id: p.insightscore_project_id,
        }));
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      } catch { /* give up */ }
    };
    loadProjects();
  }, []);

  // Load last-generated timestamps from localStorage when project changes
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    ctxCache.current = null;
    if (!selectedProject) return;
    const stored: Record<string, number> = {};
    REPORT_TYPES.forEach(r => {
      const key = `report_last_gen_${r.id}_${selectedProject.id}`;
      const val = localStorage.getItem(key);
      if (val) stored[r.id] = Number(val);
    });
    setLastGenerated(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Load existing schedules for the selected project. Server-side this is
  // still gated at can(role, "export") regardless of what the UI does (see
  // CLAUDE.md) — canShare here is purely so a viewer/client account never
  // sees a list that would 403 on fetch.
  const loadSchedules = async () => {
    if (!selectedProject || !canShare) { setSchedules([]); return; }
    setLoadingSchedules(true);
    try {
      const r = await reportScheduleApi.list(selectedProject.id);
      setSchedules(r.data.schedules || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    setSchedulingFormFor(null);
    loadSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Ada can trigger report generation via ada:generate_report from any page
  useEffect(() => {
    const handler = async (e: Event) => {
      const { project_id, format } = (e as CustomEvent).detail || {};
      const fmt = format as 'docx' | 'pptx' | 'xlsx';
      // Match by project_id if provided, else use current selection
      const target = projects.find(p => p.id === project_id || p.insightscore_project_id === project_id)
        || selectedProjectRef.current;
      if (!target) return;

      // Map format to report type
      const typeMap: Record<string, string> = { pptx: 'executive', docx: 'client', xlsx: 'technical' };
      const reportId = typeMap[fmt] || 'executive';
      const rType = REPORT_TYPES.find(r => r.id === reportId);
      if (!rType) return;

      setSelectedProject(target);
      await doGenerate(rType, target);
    };
    window.addEventListener('ada:generate_report', handler);
    return () => window.removeEventListener('ada:generate_report', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  };

  const doGenerate = async (r: typeof REPORT_TYPES[0], project?: Project) => {
    const proj = project || selectedProject;
    if (!proj) { showToast("Select a project first"); return; }
    setGenerating(r.id);
    try {
      // Kick off InsightScore analysis in the background
      insightScoreApi.analyseProject(proj.insightscore_project_id || proj.id).catch(() => {});
      // Build rich context while we wait (real data fetch)
      ctxCache.current = await buildReportContext(proj, org?.name || "Research Organisation", user?.name || "FieldScore");
    } catch { /* non-fatal */ } finally {
      const now = Date.now();
      setGenerated(prev => ({ ...prev, [r.id]: { format: r.format } }));
      setLastGenerated(prev => ({ ...prev, [r.id]: now }));
      if (selectedProject) localStorage.setItem(`report_last_gen_${r.id}_${selectedProject.id}`, String(now));
      recordEvent('report_generated');
      showToast(`${r.title} ready — click Download`);
      setGenerating(null);
    }
  };

  const download = async (r: typeof REPORT_TYPES[0]) => {
    if (!selectedProject) return;
    // Try backend first
    try {
      const res = await insightScoreApi.downloadReport(selectedProject.insightscore_project_id || selectedProject.id, r.format);
      if (res.data && res.data.size > 0) {
        const filename = `${selectedProject.name.replace(/\s+/g, "-").toLowerCase()}-${r.id}.${r.format}`;
        triggerBlobDownload(new Blob([res.data]), filename);
        return;
      }
    } catch { /* fall through */ }

    // Local generation with real data
    const ctx = ctxCache.current || {
      projectName: selectedProject.name,
      orgName: org?.name || "Research Organisation",
      submissionCount: selectedProject.submission_count ?? 0,
      passCount: 0, flagCount: 0, rejectCount: 0,
      generatedBy: user?.name || "FieldScore",
    };
    const result = generateLocalReport(r.id, r.format, ctx);
    if (!result) { showToast("Could not generate report. Please try again."); return; }
    triggerBlobDownload(result.blob, result.filename);
  };

  // Create-then-copy a public link, same UX pattern as DataIntegrityCard.tsx's
  // copyLink()/certificateApi.verifyUrl(). The share URL points at THIS app's
  // own /shared-report/:token route (not the backend host directly) so the
  // link a stakeholder receives looks like a normal ResearchOS link and
  // renders through SharedReportPage.tsx rather than a bare API response.
  const doShare = async (r: typeof REPORT_TYPES[0]) => {
    if (!selectedProject) return;
    const cacheKey = `${r.id}_${selectedProject.id}`;
    const existing = shareLinks[cacheKey];
    // Already have a live link for this report — just re-copy it instead of
    // minting a fresh token (and a fresh 14-day clock) on every click.
    if (existing) {
      await navigator.clipboard?.writeText(existing).catch(() => {});
      setCopiedShare(r.id);
      setTimeout(() => setCopiedShare(null), 2000);
      showToast("Share link copied");
      return;
    }
    setSharing(r.id);
    try {
      const res = await reportShareApi.create(selectedProject.id, r.id);
      const token = res.data.token;
      const shareUrl = `${window.location.origin}/shared-report/${token}`;
      setShareLinks(prev => ({ ...prev, [cacheKey]: shareUrl }));
      await navigator.clipboard?.writeText(shareUrl).catch(() => {});
      setCopiedShare(r.id);
      setTimeout(() => setCopiedShare(null), 2000);
      showToast("Share link created and copied — expires in 14 days");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Could not create a share link. Please try again.");
    } finally {
      setSharing(null);
    }
  };

  const openScheduleForm = (r: typeof REPORT_TYPES[0]) => {
    setScheduleFrequency('weekly');
    setScheduleEmails("");
    setSchedulingFormFor(prev => (prev === r.id ? null : r.id));
  };

  const submitSchedule = async (r: typeof REPORT_TYPES[0]) => {
    if (!selectedProject) return;
    const emails = scheduleEmails.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) { showToast("Enter at least one recipient email"); return; }
    const invalid = emails.filter(e => !e.includes('@') || e.includes(' '));
    if (invalid.length > 0) { showToast(`Invalid email: ${invalid[0]}`); return; }
    setSavingSchedule(true);
    try {
      await reportScheduleApi.create(selectedProject.id, r.id, scheduleFrequency, emails);
      showToast(`${r.title} scheduled — sends ${scheduleFrequency} to ${emails.length} recipient${emails.length === 1 ? '' : 's'}`);
      setSchedulingFormFor(null);
      setScheduleEmails("");
      await loadSchedules();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Could not create schedule. Please try again.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleScheduleEnabled = async (s: ReportSchedule) => {
    if (!selectedProject) return;
    try {
      await reportScheduleApi.setEnabled(selectedProject.id, s.id, !s.enabled);
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !s.enabled } : x));
    } catch {
      showToast("Could not update schedule. Please try again.");
    }
  };

  const deleteScheduleRow = async (s: ReportSchedule) => {
    if (!selectedProject) return;
    try {
      await reportScheduleApi.remove(selectedProject.id, s.id);
      setSchedules(prev => prev.filter(x => x.id !== s.id));
      showToast("Schedule deleted");
    } catch {
      showToast("Could not delete schedule. Please try again.");
    }
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
          <button onClick={() => setShowProjectPicker(p => !p)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFF", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>{projectLabel}</div>
              {selectedProject && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{submissionCount} submissions</div>}
            </div>
            <ChevronDown size={14} color="#9CA3AF" style={{ transform: showProjectPicker ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          {showProjectPicker && projects.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "white", borderRadius: 10, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(10,15,28,.12)", zIndex: 50, overflow: "hidden" }}>
              {projects.map(p => (
                <div key={p.id} onClick={() => { setSelectedProject(p); setShowProjectPicker(false); setGenerated({}); }}
                  style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: selectedProject?.id === p.id ? "#EFF6FF" : "white" }}>
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
          const lastTs = lastGenerated[r.id];
          const lastLabel = lastTs ? (() => {
            const mins = Math.round((Date.now() - lastTs) / 60000);
            if (mins < 1) return "Generated just now";
            if (mins < 60) return `Generated ${mins}m ago`;
            const hrs = Math.round(mins / 60);
            if (hrs < 24) return `Generated ${hrs}h ago`;
            return `Generated ${Math.round(hrs / 24)}d ago`;
          })() : null;
          return (
            <motion.div key={r.id} whileHover={{ y: -2 }}
              style={{ background: "white", borderRadius: 16, padding: "22px 24px", border: `1px solid ${isDone ? "#BBDEFB" : "#E8EDF5"}`, boxShadow: "0 2px 12px rgba(10,15,28,.06)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {isDone && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right,${BLUE},${PURPLE})` }} />}

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 26 }}>{r.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#080D1A", letterSpacing: -.2 }}>{r.title}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF", marginTop: 1 }}>For: {r.audience}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {isDone && <CheckCircle size={16} color={GREEN} />}
                  <span style={{ padding: "2px 7px", borderRadius: 5, background: "#F1F5F9", fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" as const }}>.{r.format}</span>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 14, lineHeight: 1.55 }}>{r.desc}</div>

              {/* What's inside */}
              <div style={{ background: "#F8FAFF", borderRadius: 10, padding: "10px 12px", marginBottom: 14, flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: .8, marginBottom: 7 }}>What's inside</div>
                {r.contents.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: i < r.contents.length - 1 ? 5 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: "#374151" }}>{c}</span>
                  </div>
                ))}
              </div>

              {/* Meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, color: "#9CA3AF" }}>
                <Clock size={10} /> {r.time}
                {lastLabel && (
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: isDone ? GREEN : "#9CA3AF", fontWeight: 600 }}>
                    {isDone ? "✓ " : ""}{lastLabel}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {isDone ? (
                  <>
                    <button onClick={() => download(r)}
                      style={{ flex: 1, padding: "9px", borderRadius: 8, background: GREEN, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "Inter,sans-serif" }}>
                      <Download size={13} /> Download .{r.format}
                    </button>
                    <button onClick={() => doGenerate(r)}
                      style={{ padding: "9px 14px", borderRadius: 8, background: "white", border: "1px solid #E2E8F0", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151", fontFamily: "Inter,sans-serif" }}>
                      Refresh
                    </button>
                  </>
                ) : (
                  <button onClick={() => doGenerate(r)} disabled={!!generating || !selectedProject}
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
                {canShare && (
                  <button onClick={() => openScheduleForm(r)} disabled={!selectedProject}
                    title="Auto-generate and email this report on a recurring schedule"
                    style={{ padding: "9px 10px", borderRadius: 8, background: schedulingFormFor === r.id ? "#EFF6FF" : "white", border: `1px solid ${schedulingFormFor === r.id ? BLUE : "#E2E8F0"}`, cursor: selectedProject ? "pointer" : "not-allowed", color: schedulingFormFor === r.id ? BLUE : "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarClock size={14} />
                  </button>
                )}
              </div>

              {/* Inline "Schedule" form — frequency + comma-separated recipient emails */}
              {schedulingFormFor === r.id && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#F8FAFF", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Schedule this report</div>
                    <button onClick={() => setSchedulingFormFor(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9CA3AF", display: "flex" }}>
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: "#6B7280" }}>Frequency</label>
                    <select value={scheduleFrequency} onChange={e => setScheduleFrequency(e.target.value as 'weekly' | 'monthly')}
                      style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, color: "#374151", background: "white", fontFamily: "Inter, sans-serif", outline: "none" }}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: "#6B7280" }}>Recipient emails (comma-separated)</label>
                    <input value={scheduleEmails} onChange={e => setScheduleEmails(e.target.value)}
                      placeholder="ops@client.com, pm@client.com"
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12.5, fontFamily: "Inter,sans-serif", outline: "none" }} />
                  </div>
                  <button onClick={() => submitSchedule(r)} disabled={savingSchedule}
                    style={{ width: "100%", padding: "8px", borderRadius: 7, background: savingSchedule ? "#EFF6FF" : BLUE, border: "none", cursor: savingSchedule ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: savingSchedule ? BLUE : "white", fontFamily: "Inter,sans-serif" }}>
                    {savingSchedule ? "Saving..." : "Save schedule"}
                  </button>
                </div>
              )}

              {/* Existing schedules for this report type on this project */}
              {loadingSchedules && (
                <div style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF" }}>Loading schedules…</div>
              )}
              {!loadingSchedules && schedules.filter(s => s.report_type === r.id).length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {schedules.filter(s => s.report_type === r.id).map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: s.enabled ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${s.enabled ? "#BBF7D0" : "#E2E8F0"}` }}>
                      <CalendarClock size={12} color={s.enabled ? GREEN : "#9CA3AF"} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "capitalize" as const }}>
                          {s.frequency} · {s.recipient_emails.length} recipient{s.recipient_emails.length === 1 ? "" : "s"}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>
                          {s.enabled ? `Next: ${new Date(s.next_run_at).toLocaleDateString()}` : "Paused"}
                          {s.last_run_status && ` · Last run: ${s.last_run_status}`}
                        </div>
                      </div>
                      <button onClick={() => toggleScheduleEnabled(s)} title={s.enabled ? "Pause" : "Resume"}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: s.enabled ? GREEN : "#9CA3AF", display: "flex" }}>
                        <Power size={12} />
                      </button>
                      <button onClick={() => deleteScheduleRow(s)} title="Delete schedule"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: "#DC2626", display: "flex" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
            const cacheKey = `${r.id}_${selectedProject?.id}`;
            const hasShareLink = !!shareLinks[cacheKey];
            const isSharing = sharing === r.id;
            const justCopied = copiedShare === r.id;
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #F8FAFF" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#EFF6FF", display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#080D1A" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Generated just now · {selectedProject?.name} · .{meta.format}</div>
                </div>
                {canShare && (
                  <button onClick={() => doShare(r)} disabled={isSharing}
                    title={hasShareLink ? "Copy the public link again" : "Create a public, read-only link — no login required, expires in 14 days"}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, background: justCopied ? "#ECFDF5" : "#F8FAFF", border: `1px solid ${justCopied ? "#A7F3D0" : "#E2E8F0"}`, cursor: isSharing ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: justCopied ? "#059669" : "#374151", fontFamily: "Inter,sans-serif" }}>
                    {isSharing ? "Creating…" : justCopied ? (<><Check size={12} /> Copied</>) : hasShareLink ? (<><Copy size={12} /> Copy link</>) : (<><Share2 size={12} /> Share</>)}
                  </button>
                )}
                <button onClick={() => download(r)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, background: "#EFF6FF", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: "Inter,sans-serif" }}>
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
