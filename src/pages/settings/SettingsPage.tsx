import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Layers, Users, Shield, Palette, Puzzle, Brain,
  FlaskConical, Database, Lock, Bell, CreditCard, Code2,
  ClipboardList, ChevronRight, Check, RefreshCw,
  Upload, Plus, Trash2, Zap,
  ExternalLink, X, ShieldAlert, Cpu, Send,
} from "lucide-react";
import { useAda } from "../../ada/AdaContext";
import { useGamify } from "../../gamify/GamifyContext";
import CreditsPanel from "../../gamify/CreditsPanel";
import { orgAdminApi } from "../../services/api";
import { useNavigate as useNav, useLocation } from "react-router-dom";
import { loadEngineConfig, saveEngineConfig } from "../../services/engineConfig";
import type { EngineConfig, EngineRequirement, EngineRequirements, AssignedZone } from "../../services/engineConfig";
import { useProject } from "../../context/ProjectContext";
import { dashboardApi, orgSettingsApi, projectsApi } from "../../services/api";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";
const CARD: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  border: "1px solid #E8EDF5",
  boxShadow: "0 2px 12px rgba(10,15,28,.06)",
};
const LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  marginBottom: 6,
  display: "block",
};
const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  fontSize: 13,
  color: "#111827",
  fontFamily: "Inter,sans-serif",
  outline: "none",
  boxSizing: "border-box",
  background: "white",
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: BLUE,
  border: "none",
  color: "white",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Inter,sans-serif",
};
const BTN_GHOST: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "white",
  border: "1px solid #E2E8F0",
  color: "#374151",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Inter,sans-serif",
};

interface SettingsCardProps { children: React.ReactNode; style?: React.CSSProperties; }
function SettingsCard({ children, style }: SettingsCardProps) {
  return <div style={{ ...CARD, ...style }}>{children}</div>;
}

interface SettingsHeaderProps { title: string; description: string; action?: React.ReactNode; }
function SettingsHeader({ title, description, action }: SettingsHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#080D1A", margin: 0, letterSpacing: -0.5 }}>{title}</h2>
        <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "4px 0 0" }}>{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface SettingsGroupProps { label?: string; children: React.ReactNode; style?: React.CSSProperties; }
function SettingsGroup({ label, children, style }: SettingsGroupProps) {
  return (
    <div style={style}>
      {label && <div style={{ ...LABEL, marginBottom: 12 }}>{label}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

interface SettingsFieldProps { label: string; hint?: string; children: React.ReactNode; }
function SettingsField({ label, hint, children }: SettingsFieldProps) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

interface ToggleProps { value: boolean; onChange: (v: boolean) => void; label: string; description?: string; }
function Toggle({ value, onChange, label, description }: ToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</div>
        {description && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: value ? BLUE : "#D1D5DB", position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <motion.div animate={{ x: value ? 20 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
      </button>
    </div>
  );
}

interface BadgeProps { label: string; color?: string; bg?: string; }
function Badge({ label, color = GREEN, bg }: BadgeProps) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: bg || `${color}18`, color }}>{label}</span>;
}

interface SectionDividerProps { label: string }
function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
    </div>
  );
}

const SECTIONS = [
  { id: "organization",  icon: Building2,    label: "Organization",        group: "ACCOUNT" },
  { id: "workspace",     icon: Layers,       label: "Workspace",           group: "ACCOUNT" },
  { id: "users",         icon: Users,        label: "Users & Teams",       group: "ACCOUNT" },
  { id: "roles",         icon: Shield,       label: "Roles & Permissions", group: "ACCOUNT" },
  { id: "branding",      icon: Palette,      label: "Branding",            group: "CUSTOMISE" },
  { id: "integrations",  icon: Puzzle,       label: "Integrations",        group: "CUSTOMISE" },
  { id: "ada",           icon: Brain,        label: "AI & Ada",            group: "CUSTOMISE" },
  { id: "research",      icon: FlaskConical, label: "Research Defaults",   group: "RESEARCH" },
  { id: "engine",        icon: Cpu,          label: "Engine Config",        group: "RESEARCH" },
  { id: "storage",       icon: Database,     label: "Data & Storage",      group: "RESEARCH" },
  { id: "security",      icon: Lock,         label: "Security",            group: "SYSTEM" },
  { id: "notifications", icon: Bell,         label: "Notifications",       group: "SYSTEM" },
  { id: "billing",       icon: CreditCard,   label: "Billing",             group: "SYSTEM" },
  { id: "api",           icon: Code2,        label: "API & Webhooks",      group: "SYSTEM" },
  { id: "audit",         icon: ClipboardList,label: "Audit Log",           group: "SYSTEM" },
  { id: "danger",        icon: ShieldAlert,  label: "Danger Zone",         group: "SYSTEM" },
];

function OrgSection() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Research & Consulting");
  const [country, setCountry] = useState("Nigeria");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    orgSettingsApi.getSettings()
      .then(r => {
        const d = r.data || {};
        setName(d.name || "");
        setIndustry(d.industry || "Research & Consulting");
        setCountry(d.country || "Nigeria");
        setTimezone(d.timezone || "Africa/Lagos");
        setWebsite(d.website || "");
      })
      .catch(() => setLoadError("Could not load organisation settings."));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await orgSettingsApi.updateSettings({ name, industry, country, timezone, website });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setSaveError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Organisation Details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SettingsField label="Organisation Name"><input style={INPUT} value={name} onChange={e => setName(e.target.value)} /></SettingsField>
            <SettingsField label="Industry">
              <select style={{ ...INPUT }} value={industry} onChange={e => setIndustry(e.target.value)}>
                {["Research & Consulting","Healthcare","Finance","Government","NGO / Non-profit","Education","Technology"].map(i => <option key={i}>{i}</option>)}
              </select>
            </SettingsField>
            <SettingsField label="Country"><input style={INPUT} value={country} onChange={e => setCountry(e.target.value)} /></SettingsField>
            <SettingsField label="Timezone">
              <select style={{ ...INPUT }} value={timezone} onChange={e => setTimezone(e.target.value)}>
                {["Africa/Lagos","UTC","Europe/London","America/New_York","Asia/Kolkata"].map(t => <option key={t}>{t}</option>)}
              </select>
            </SettingsField>
            <SettingsField label="Website" hint="Used in branded reports"><input style={INPUT} value={website} onChange={e => setWebsite(e.target.value)} /></SettingsField>
          </div>
        </SettingsGroup>
        {loadError && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{loadError}</div>}
        {saveError && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{saveError}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Changes"}</button>
        </div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Danger Zone">
          <div style={{ padding: 16, borderRadius: 10, border: "1px solid #FEE2E2", background: "#FFF5F5" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 4 }}>Delete Organisation</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>This will permanently delete your organisation and all data. This action cannot be undone.</div>
            <button style={{ ...BTN_GHOST, color: RED, borderColor: "#FEE2E2", fontSize: 12 }}
              onClick={() => { if (window.confirm("Type DELETE to confirm: this is permanent and cannot be undone.")) window.alert("Contact support at hello@intelligencyai.com.ng to complete organisation deletion."); }}>
              Delete Organisation
            </button>
          </div>
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function WorkspaceSection() {
  const [wsName, setWsName] = useState("");
  const [desc, setDesc] = useState("");
  const [lang, setLang] = useState("English");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string; submission_count?: number; status?: string }>>([]);

  useEffect(() => {
    orgSettingsApi.getWorkspace()
      .then(r => {
        const d = r.data || {};
        setWsName(d.name || "");
        setDesc(d.description || "");
        setLang(d.language || "English");
      })
      .catch(() => {});
    projectsApi.list()
      .then(r => setProjects(r.data?.projects || r.data || []))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await orgSettingsApi.updateWorkspace({ name: wsName, description: desc, language: lang });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard style={{ padding: 24 }}>
      <SettingsGroup label="Workspace Configuration">
        <SettingsField label="Workspace Name"><input style={INPUT} value={wsName} onChange={e => setWsName(e.target.value)} /></SettingsField>
        <SettingsField label="Description"><textarea style={{ ...INPUT, minHeight: 80, resize: "vertical" as const }} value={desc} onChange={e => setDesc(e.target.value)} /></SettingsField>
        <SettingsField label="Primary Language">
          <select style={{ ...INPUT }} value={lang} onChange={e => setLang(e.target.value)}>
            {["English","French","Arabic","Swahili","Hausa","Yoruba","Igbo","Portuguese"].map(l => <option key={l}>{l}</option>)}
          </select>
        </SettingsField>
      </SettingsGroup>
      <SectionDivider label="Active Projects" />
      {projects.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#9CA3AF", padding: "8px 0" }}>No projects yet.</div>
      ) : projects.map(p => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #EEF2F8", marginBottom: 8 }}>
          <div style={{ fontSize: 18 }}>📂</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.submission_count ?? 0} submissions</div></div>
          <Badge label={p.status || "active"} color={p.status === "draft" ? AMBER : GREEN} />
        </div>
      ))}
      {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Workspace"}</button>
      </div>
    </SettingsCard>
  );
}

// ─── Collaboration & Team ─────────────────────────────────────────────────────
// Real roles are admin/manager/viewer (see auth.py's ROLE_PERMISSIONS) — the
// richer 7-role model this UI previously implied (Project Manager, Field
// Supervisor, Analyst, Auditor, Client, Observer) was never actually backed
// by distinct permissions, so it's collapsed to what's real rather than kept
// as a misleading facade.

const ROLE_META: Record<string, { color: string; bg: string; desc: string; icon: string }> = {
  admin:   { color: "#7C3AED", bg: "#F5F3FF", desc: "Full org control — billing, settings, users, all projects and data.", icon: "👑" },
  manager: { color: "#2463EB", bg: "#EFF6FF", desc: "Creates and manages projects, views and exports data. Can't manage users or billing.", icon: "🗂" },
  viewer:  { color: "#6B7280", bg: "#F9FAFB", desc: "Read-only access to projects and reports.", icon: "👁" },
};
const ROLE_LABELS: Record<string, string> = { admin: "Admin", manager: "Manager", viewer: "Viewer" };

interface OrgUser { id: string; name: string; email: string; role: string; created_at: string; last_login?: string | null; }
interface OrgInvite { id: string; email: string; role: string; status: string; created_at: string; expires_at: string; }

function RolePill({ role }: { role: string }) {
  const m = ROLE_META[role] || { color: "#6B7280", bg: "#F3F4F6", icon: "•" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px 3px 6px", borderRadius:20, background:m.bg, border:`1px solid ${m.color}22`, fontSize:11.5, fontWeight:600, color:m.color, whiteSpace:"nowrap" as const }}>
      <span style={{ fontSize:11 }}>{m.icon}</span>{ROLE_LABELS[role] || role}
    </span>
  );
}

function MemberAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const colors = ["#2463EB","#7C3AED","#059669","#D97706","#0891B2","#DC2626"];
  const c = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`linear-gradient(135deg,${c},${c}99)`, display:"grid", placeItems:"center", fontSize:size*0.36, fontWeight:700, color:"white", flexShrink:0 }}>
      {name.split(" ").map(w=>w[0]).join("").slice(0,2)}
    </div>
  );
}

function UsersSection() {
  const [tab, setTab] = useState<"team"|"clients"|"links">("team");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loadError, setLoadError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteAcceptUrl, setInviteAcceptUrl] = useState<string | null>(null);

  const load = () => {
    orgSettingsApi.listInvites().then(r => setInvites(r.data?.invites || [])).catch(() => {});
    (async () => {
      try {
        const r = await (await import("../../services/api")).default.get("/api/org/users");
        setUsers(r.data?.users || []);
      } catch {
        setLoadError("Could not load team members.");
      }
    })();
  };

  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim() || inviteSending) return;
    setInviteSending(true);
    setInviteError("");
    setInviteAcceptUrl(null);
    try {
      const r = await orgSettingsApi.createInvite(inviteEmail.trim(), inviteRole);
      setInviteSent(true);
      if (!r.data?.email_sent && r.data?.accept_url) setInviteAcceptUrl(r.data.accept_url);
      load();
      setTimeout(() => { setInviteSent(false); if (r.data?.email_sent) { setShowInvite(false); setInviteEmail(""); } }, 2500);
    } catch (e: any) {
      setInviteError(e?.response?.data?.error || "Could not send invite — please try again.");
    } finally {
      setInviteSending(false);
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await orgSettingsApi.revokeInvite(id);
      load();
    } catch {}
  };

  const tabStyle = (t: typeof tab): React.CSSProperties => ({
    padding:"7px 16px", borderRadius:8, border:"none", fontFamily:"Inter,sans-serif",
    fontSize:13, fontWeight:600, cursor:"pointer",
    background: tab===t ? "white" : "transparent",
    color: tab===t ? "#111827" : "#9CA3AF",
    boxShadow: tab===t ? "0 1px 4px rgba(0,0,0,.08)" : "none",
  });

  const pendingInvites = invites.filter(i => i.status === "pending");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
        {[
          { label:"Team Members", value: users.length, color:GREEN, icon:"✅" },
          { label:"Pending Invites", value: pendingInvites.length, color:AMBER, icon:"⏳" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:12, border:"1px solid #E8EDF5", padding:"14px 16px", boxShadow:"0 1px 6px rgba(10,15,28,.05)" }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar + Invite button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:10, padding:3 }}>
          <button style={tabStyle("team")} onClick={()=>setTab("team")}>Team Members</button>
          <button style={tabStyle("clients")} onClick={()=>setTab("clients")}>Clients & Observers</button>
          <button style={tabStyle("links")} onClick={()=>setTab("links")}>Shared Links</button>
        </div>
        <button onClick={()=>setShowInvite(p=>!p)} style={{ ...BTN_PRIMARY, display:"flex", alignItems:"center", gap:6 }}>
          <Plus size={13} />Invite People
        </button>
      </div>

      {/* Invite panel */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            style={{ background:"white", borderRadius:14, border:"1px solid #E8EDF5", padding:24, boxShadow:"0 4px 20px rgba(10,15,28,.08)" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#080D1A", marginBottom:4 }}>Invite someone to your team</div>
            <div style={{ fontSize:12.5, color:"#9CA3AF", marginBottom:20 }}>
              They'll get an email with a secure link to set up their account and join this organisation.
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <div>
                <label style={LABEL}>Email address</label>
                <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@org.com"
                  style={{ ...INPUT }} onKeyDown={e=>e.key==="Enter" && sendInvite()} />
              </div>
              <div>
                <label style={LABEL}>Role</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} style={{ ...INPUT }}>
                  {Object.keys(ROLE_META).map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>

            {/* Role description */}
            {inviteRole && ROLE_META[inviteRole] && (
              <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, background:ROLE_META[inviteRole].bg, border:`1px solid ${ROLE_META[inviteRole].color}22`, fontSize:12.5, color:ROLE_META[inviteRole].color, display:"flex", gap:8, alignItems:"flex-start" }}>
                <span style={{ fontSize:16 }}>{ROLE_META[inviteRole].icon}</span>
                <div>
                  <strong>{ROLE_LABELS[inviteRole]}</strong><br/>
                  {ROLE_META[inviteRole].desc}
                </div>
              </div>
            )}

            {inviteError && <div style={{ fontSize:12, color:RED, marginBottom:10 }}>{inviteError}</div>}
            {inviteAcceptUrl && (
              <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, background:"#FFFBEB", border:"1px solid #FDE68A", fontSize:12 }}>
                Email delivery isn't configured on this server — share this link with them manually:
                <div style={{ marginTop:6, fontFamily:"monospace", fontSize:11.5, color:"#374151", wordBreak:"break-all" as const }}>{inviteAcceptUrl}</div>
              </div>
            )}

            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <button onClick={sendInvite} disabled={inviteSending} style={{ ...BTN_PRIMARY, display:"flex", alignItems:"center", gap:6, minWidth:130, opacity: inviteSending ? 0.6 : 1 }}>
                {inviteSending ? "Sending…" : inviteSent ? <><Check size={13}/>Sent!</> : <><Send size={13}/>Send Invite</>}
              </button>
              <button onClick={()=>setShowInvite(false)} style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #E2E8F0", background:"white", color:"#6B7280", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Members tab */}
      {tab === "team" && (
        <SettingsCard style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#111827" }}>Organisation members</span>
            <span style={{ fontSize:11.5, color:"#9CA3AF" }}>{users.length} people</span>
          </div>
          {loadError && <div style={{ padding:"12px 20px", fontSize:12, color:RED }}>{loadError}</div>}
          <div>
            {users.map((u, idx) => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom: idx<users.length-1 ? "1px solid #F8FAFF" : "none" }}>
                <MemberAvatar name={u.name || u.email} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{u.name || u.email}</div>
                  <div style={{ fontSize:11.5, color:"#9CA3AF", marginTop:1 }}>{u.email}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                  <RolePill role={u.role} />
                  <div style={{ fontSize:11, color:"#CBD5E1", minWidth:60, textAlign:"right" }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never logged in"}</div>
                </div>
              </div>
            ))}
            {pendingInvites.map((inv, idx) => (
              <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom: idx<pendingInvites.length-1 ? "1px solid #F8FAFF" : "none", background:"#FFFBEB" }}>
                <MemberAvatar name={inv.email} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{inv.email}</span>
                    <Badge label="Pending" color={AMBER} />
                  </div>
                  <div style={{ fontSize:11.5, color:"#9CA3AF", marginTop:1 }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                  <RolePill role={inv.role} />
                  <button title="Revoke invite" onClick={()=>revokeInvite(inv.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#E2E8F0", padding:4 }}
                    onMouseEnter={e=>((e.currentTarget as HTMLButtonElement).style.color=RED)} onMouseLeave={e=>((e.currentTarget as HTMLButtonElement).style.color="#E2E8F0")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {tab === "clients" && (
        <div style={{ padding:"32px 24px", background:"white", borderRadius:14, border:"1px solid #E8EDF5", textAlign:"center" as const }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔐</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:6 }}>Client & Observer Access</div>
          <div style={{ fontSize:13, color:"#6B7280", maxWidth:380, margin:"0 auto", lineHeight:1.6 }}>External, read-only, project-scoped access is available on the Enterprise plan. Contact your account manager to enable it for this organisation.</div>
        </div>
      )}

      {tab === "links" && (
        <div style={{ padding:"32px 24px", background:"white", borderRadius:14, border:"1px solid #E8EDF5", textAlign:"center" as const }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔗</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:6 }}>Shareable Report Links</div>
          <div style={{ fontSize:13, color:"#6B7280", maxWidth:380, margin:"0 auto", lineHeight:1.6 }}>Generate password-protected links to share reports with clients and stakeholders — no account required. Available on the Enterprise plan.</div>
        </div>
      )}
    </div>
  );
}

function RolesSection() {
  // Real, enforced permission model — mirrors auth.py's ROLE_PERMISSIONS
  // exactly. The previous version of this page showed a 7-role, 28-permission
  // matrix (Field Supervisor, Auditor, Client, Observer, granular actions
  // like "Suspend Enumerators") that was pure decoration — none of it was
  // ever checked by the backend. Only 3 roles actually exist and are enforced.
  const roles = ["admin", "manager", "viewer"];
  const PERMISSION_LABELS: Record<string, string> = {
    view: "View projects, submissions & reports",
    export: "Export data (CSV/reports)",
    create_project: "Create new projects",
    manage_integrations: "Manage integrations (KoboToolbox, InsightScore)",
    manage_users: "Invite/manage team members",
    billing: "View & manage billing",
  };
  const ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: ["view", "export", "create_project", "manage_integrations", "manage_users", "billing"],
    manager: ["view", "export", "create_project"],
    viewer: ["view"],
  };
  const roleColor = (r: string) => ROLE_META[r]?.color || "#6B7280";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Role cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
        {roles.map(r => (
          <div key={r} style={{ background:ROLE_META[r]?.bg||"#F9FAFB", borderRadius:10, border:`1px solid ${roleColor(r)}22`, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
              <span style={{ fontSize:16 }}>{ROLE_META[r]?.icon}</span>
              <span style={{ fontSize:12.5, fontWeight:700, color:roleColor(r) }}>{ROLE_LABELS[r]}</span>
            </div>
            <div style={{ fontSize:11, color:"#6B7280", lineHeight:1.5 }}>{ROLE_META[r]?.desc}</div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <SettingsCard style={{ padding:24, overflowX:"auto" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#111827", marginBottom:16 }}>Permission matrix</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:520 }}>
            <thead>
              <tr>
                <th style={{ ...LABEL, textAlign:"left", padding:"0 0 12px", width:"46%" }}>Permission</th>
                {roles.map(r=>(
                  <th key={r} style={{ ...LABEL, textAlign:"center", padding:"0 0 12px", minWidth:70 }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <span style={{ fontSize:13 }}>{ROLE_META[r]?.icon}</span>
                      <span style={{ color:roleColor(r), fontSize:9.5 }}>{ROLE_LABELS[r]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(PERMISSION_LABELS).map(perm=>(
                <tr key={perm} style={{ borderBottom:"1px solid #F8FAFF" }}>
                  <td style={{ padding:"9px 0", fontSize:12.5, color:"#374151" }}>{PERMISSION_LABELS[perm]}</td>
                  {roles.map(r=>(
                    <td key={r} style={{ textAlign:"center", padding:"9px 0" }}>
                      {ROLE_PERMISSIONS[r].includes(perm)
                        ? <div style={{ width:18, height:18, borderRadius:"50%", background:roleColor(r)+"22", display:"inline-grid", placeItems:"center" }}><Check size={11} color={roleColor(r)} /></div>
                        : <div style={{ width:18, height:18, borderRadius:"50%", background:"#F1F5F9", display:"inline-grid", placeItems:"center" }}><X size={10} color="#E2E8F0" /></div>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:14, padding:"10px 14px", background:"#F0F7FF", borderRadius:8, fontSize:12, color:BLUE }}>
          These 3 roles are fixed — custom roles and per-project permission overrides aren't supported yet.
        </div>
      </SettingsCard>
    </div>
  );
}

function BrandingSection() {
  const [logoUrl, setLogoUrl] = React.useState<string>(() => localStorage.getItem("org_logo") || "");
  const [primaryColor, setPrimaryColor] = React.useState("#2463EB");
  const [accentColor, setAccentColor] = React.useState("#7C3AED");
  const [font, setFont] = React.useState("Inter");
  const [footer, setFooter] = React.useState("Confidential · ResearchOS");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  useEffect(() => {
    orgSettingsApi.getSettings()
      .then(r => {
        const d = r.data || {};
        if (d.brand_primary_color) setPrimaryColor(d.brand_primary_color);
        if (d.brand_accent_color) setAccentColor(d.brand_accent_color);
        if (d.brand_font) setFont(d.brand_font);
        if (d.brand_footer) setFooter(d.brand_footer);
      })
      .catch(() => {});
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setLogoUrl(url);
      localStorage.setItem("org_logo", url);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await orgSettingsApi.updateSettings({
        brand_primary_color: primaryColor,
        brand_accent_color: accentColor,
        brand_font: font,
        brand_footer: footer,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const templates = [
    { icon: "📊", label: "PowerPoint Template", hint: ".pptx — Used for presentation outputs", accepted: ".pptx" },
    { icon: "📝", label: "Word Template", hint: ".docx — Used for written report exports", accepted: ".docx" },
    { icon: "📈", label: "Excel Template", hint: ".xlsx — Used for data exports", accepted: ".xlsx" },
    { icon: "📋", label: "Research Report Template", hint: ".docx or .pdf — Master report layout", accepted: ".docx,.pdf" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Brand Identity">
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div>
              <div style={{ ...LABEL }}>Organisation Logo</div>
              <div style={{ position: "relative", width: 100, height: 100, borderRadius: 14, border: "2px dashed #E2E8F0", background: "#F8FAFF", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", pointerEvents: "none" }}>
                    <Upload size={20} color="#CBD5E1" />
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>Upload</div>
                  </div>
                )}
                <input type="file" accept="image/png,image/svg+xml,image/jpeg"
                  onChange={handleLogoChange}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.001, cursor: "pointer", fontSize: 0 }} />
              </div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 6 }}>PNG, SVG · Max 2MB</div>
              {logoUrl && (
                <button onClick={() => { setLogoUrl(""); localStorage.removeItem("org_logo"); }} style={{ fontSize: 10.5, color: RED, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>Remove</button>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SettingsField label="Primary Colour">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer", padding: 2 }} />
                    <input style={{ ...INPUT }} value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
                  </div>
                </SettingsField>
                <SettingsField label="Accent Colour">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer", padding: 2 }} />
                    <input style={{ ...INPUT }} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                  </div>
                </SettingsField>
                <SettingsField label="Report Font">
                  <select style={{ ...INPUT }} value={font} onChange={e => setFont(e.target.value)}>{["Inter","Helvetica Neue","Georgia","Calibri","Roboto","Open Sans"].map(f => <option key={f}>{f}</option>)}</select>
                </SettingsField>
                <SettingsField label="Report Footer"><input style={INPUT} value={footer} onChange={e => setFooter(e.target.value)} /></SettingsField>
              </div>
            </div>
          </div>
        </SettingsGroup>
        {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Brand Settings"}
          </button>
        </div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Report Templates">
          {templates.map(t => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: "1px solid #E8EDF5", background: "#F8FAFF" }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.label}</div><div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{t.hint}</div></div>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ ...BTN_PRIMARY, fontSize: 11.5, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <Upload size={12} /> Upload<input type="file" accept={t.accepted} style={{ display: "none" }} onChange={() => {}} />
                </label>
              </div>
            </div>
          ))}
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

interface Integration { id: string; name: string; icon: string; category: string; status: "connected"|"disconnected"|"error"; lastSync: string; health: number; }
const INTEGRATIONS: Integration[] = [
  { id:"kobo",name:"KoboToolbox",icon:"🗂",category:"Data Collection",status:"disconnected",lastSync:"Never",health:0 },
  { id:"surveycto",name:"SurveyCTO",icon:"📋",category:"Data Collection",status:"disconnected",lastSync:"Never",health:0 },
  { id:"odk",name:"ODK Central",icon:"📱",category:"Data Collection",status:"disconnected",lastSync:"Never",health:0 },
  { id:"gdrive",name:"Google Drive",icon:"💾",category:"Storage",status:"disconnected",lastSync:"Never",health:0 },
  { id:"onedrive",name:"OneDrive",icon:"☁️",category:"Storage",status:"disconnected",lastSync:"Never",health:0 },
  { id:"dropbox",name:"Dropbox",icon:"📦",category:"Storage",status:"disconnected",lastSync:"Never",health:0 },
  { id:"slack",name:"Slack",icon:"💬",category:"Notifications",status:"disconnected",lastSync:"Never",health:0 },
  { id:"teams",name:"Microsoft Teams",icon:"🟦",category:"Notifications",status:"disconnected",lastSync:"Never",health:0 },
  { id:"powerbi",name:"Power BI",icon:"📊",category:"Analytics",status:"disconnected",lastSync:"Never",health:0 },
  { id:"zapier",name:"Zapier",icon:"⚡",category:"Automation",status:"disconnected",lastSync:"Never",health:0 },
  { id:"make",name:"Make (Integromat)",icon:"🔄",category:"Automation",status:"disconnected",lastSync:"Never",health:0 },
];

function IntegrationsSection() {
  const [selected, setSelected] = useState<Integration | null>(null);
  const seen = new Set<string>();
  const groups: string[] = [];
  INTEGRATIONS.forEach(i => { if (!seen.has(i.category)) { seen.add(i.category); groups.push(i.category); } });
  const statusColor = (s: string) => s === "connected" ? GREEN : s === "error" ? RED : "#9CA3AF";
  const statusLabel = (s: string) => s === "connected" ? "Connected" : s === "error" ? "Error" : "Not connected";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {selected && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <SettingsCard style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 32 }}>{selected.icon}</div>
                <div><div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{selected.name}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.category}</div></div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
              {[{label:"Status",value:<Badge label={statusLabel(selected.status)} color={statusColor(selected.status)} />},{label:"Last Sync",value:selected.lastSync},{label:"Health",value:selected.health > 0 ? `${selected.health}%` : "—"}].map(m => (
                <div key={m.label} style={{ padding: "12px 14px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
                  <div style={{ ...LABEL, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...BTN_PRIMARY, display: "flex", alignItems: "center", gap: 6 }}><Zap size={12} />{selected.status === "connected" ? "Reconnect" : "Connect"}</button>
              <button style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={12} />Sync Now</button>
              <button style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={12} />View Logs</button>
            </div>
          </SettingsCard>
        </motion.div>
      )}
      {groups.map(group => (
        <div key={group}>
          <div style={{ ...LABEL, marginBottom: 10 }}>{group}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {INTEGRATIONS.filter(i => i.category === group).map(intg => (
              <motion.div key={intg.id} whileHover={{ y: -1 }} onClick={() => setSelected(intg)} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                <div style={{ fontSize: 22 }}>{intg.icon}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{intg.name}</div><div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Last sync: {intg.lastSync}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(intg.status) }} /><span style={{ fontSize: 12, color: statusColor(intg.status), fontWeight: 600 }}>{statusLabel(intg.status)}</span></div>
                <ChevronRight size={14} color="#CBD5E1" />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdaSection() {
  const [personality, setPersonality] = useState("professional");
  const [proactive, setProactive] = useState(true);
  const [brief, setBrief] = useState(true);
  const [guidance, setGuidance] = useState(true);
  const [celebrations, setCelebrations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const model = "FieldScore Intelligence Engine";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await orgSettingsApi.updateSettings({
        ada_personality: personality,
        ada_proactive: proactive,
        ada_daily_brief: brief,
        ada_element_guidance: guidance,
        ada_celebrations: celebrations,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Ada Personality">
          <SettingsField label="Personality Mode" hint="Controls Ada's tone and communication style">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[{id:"professional",label:"Professional",desc:"Formal, precise, enterprise-ready"},{id:"friendly",label:"Friendly",desc:"Warm, encouraging, supportive"},{id:"concise",label:"Concise",desc:"Direct, minimal, data-first"}].map(m => (
                <div key={m.id} onClick={() => setPersonality(m.id)} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${personality === m.id ? BLUE : "#E2E8F0"}`, background: personality === m.id ? "#EFF6FF" : "white", cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: personality === m.id ? BLUE : "#111827", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </SettingsField>
        </SettingsGroup>
        <SectionDivider label="Behaviour" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Toggle value={proactive} onChange={setProactive} label="Proactive Briefings" description="Ada introduces each page with contextual insights" />
          <Toggle value={brief} onChange={setBrief} label="Daily Summary Brief" description="Ada sends a morning briefing with overnight changes" />
          <Toggle value={guidance} onChange={setGuidance} label="Element Guidance" description="Ada highlights important data points on screen" />
          <Toggle value={celebrations} onChange={setCelebrations} label="Milestone Celebrations" description="Ada acknowledges team achievements" />
        </div>
        <SectionDivider label="Model" />
        <div style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>AI Model</div><div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Powers Ada's intelligence and analysis</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge label={model} color={PURPLE} /><Badge label="Enterprise" color={AMBER} /></div>
        </div>
        {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Ada Settings"}
          </button>
        </div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Memory & Context">
          <div style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Ada's Learned Context</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>Ada remembers your preferences, project context, and team patterns to provide better guidance over time.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...BTN_GHOST, fontSize: 11.5, padding: "6px 12px" }}
                onClick={() => window.open("/ada/memory", "_blank")}>
                View Memory
              </button>
              <button style={{ ...BTN_GHOST, fontSize: 11.5, padding: "6px 12px", color: RED, borderColor: "#FEE2E2" }}
                onClick={async () => {
                  if (!window.confirm("Clear Ada's memory for your account? This removes Ada's learned preferences and conversation history.")) return;
                  try {
                    await fetch("/ada/memory", { method: "DELETE", credentials: "include" });
                    window.location.reload();
                  } catch { window.alert("Could not clear memory — please try again."); }
                }}>
                Clear Memory
              </button>
            </div>
          </div>
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function ResearchSection() {
  const cfg = loadEngineConfig();
  const [gps, setGps] = useState(cfg.gpsToleranceMeters);
  const [dupThreshold, setDupThreshold] = useState(cfg.duplicateThresholdPct);
  const [minDuration, setMinDuration] = useState(cfg.minDurationMins);
  const [maxDuration, setMaxDuration] = useState(cfg.maxDurationMins);
  const [mediaRetention, setMediaRetention] = useState("90");
  const [saved, setSaved] = useState(false);

  const save = () => {
    const current = loadEngineConfig();
    saveEngineConfig({
      ...current,
      gpsToleranceMeters: gps,
      duplicateThresholdPct: dupThreshold,
      minDurationMins: minDuration,
      maxDurationMins: maxDuration,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="FieldScore Defaults">
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, padding: "10px 14px", background: "#F8FAFF", borderRadius: 8, border: "1px solid #EEF2F8", lineHeight: 1.6 }}>
            These thresholds control how FieldScore flags and scores submissions. Changes apply immediately to the score display on all submission detail pages — they do not retrigger the backend engine.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SettingsField label={`GPS Accuracy Tolerance: ${gps}m`} hint="Submissions outside this radius are flagged"><input type="range" min={10} max={500} value={gps} onChange={e => setGps(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Duplicate Detection Threshold: ${dupThreshold}%`} hint="Similarity score that triggers a duplicate flag"><input type="range" min={50} max={100} value={dupThreshold} onChange={e => setDupThreshold(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Min Interview Duration: ${minDuration} mins`} hint="Submissions below this are flagged as too fast"><input type="range" min={1} max={60} value={minDuration} onChange={e => setMinDuration(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Max Interview Duration: ${maxDuration} mins`} hint="Submissions above this are flagged as too slow"><input type="range" min={30} max={360} value={maxDuration} onChange={e => setMaxDuration(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
          </div>
        </SettingsGroup>
        <SectionDivider label="InsightScore Defaults" />
        <SettingsGroup>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SettingsField label="Analysis Language"><select style={{ ...INPUT }}>{["English","French","Arabic","Portuguese"].map(l => <option key={l}>{l}</option>)}</select></SettingsField>
            <SettingsField label="Theme Extraction Depth"><select style={{ ...INPUT }}><option>Standard (5-8 themes)</option><option>Deep (10-15 themes)</option><option>Exhaustive (20+ themes)</option></select></SettingsField>
            <SettingsField label={`Media Retention: ${mediaRetention} days`}><select style={{ ...INPUT }} value={mediaRetention} onChange={e => setMediaRetention(e.target.value)}>{[30,60,90,180,365].map(d => <option key={d} value={d}>{d} days</option>)}</select></SettingsField>
            <SettingsField label="Questionnaire Generation Model"><select style={{ ...INPUT }}><option>Ada Standard</option><option>Ada Pro (Enterprise)</option></select></SettingsField>
          </div>
        </SettingsGroup>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} style={BTN_PRIMARY}>
            {saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Research Defaults"}
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function StorageSection() {
  const [autoDeleteAudio, setAutoDeleteAudio] = useState(true);
  const [archiveOld, setArchiveOld] = useState(false);
  const [keepAiOutputs, setKeepAiOutputs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    orgSettingsApi.getStorage()
      .then(r => {
        const d = r.data || {};
        if (d.auto_delete_audio !== undefined) setAutoDeleteAudio(d.auto_delete_audio);
        if (d.archive_old !== undefined) setArchiveOld(d.archive_old);
        if (d.keep_ai_outputs !== undefined) setKeepAiOutputs(d.keep_ai_outputs);
      })
      .catch(() => {});
  }, []);

  const save = async (next: { auto_delete_audio: boolean; archive_old: boolean; keep_ai_outputs: boolean }) => {
    setSaving(true);
    setError("");
    try {
      await orgSettingsApi.updateStorage(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Storage Overview">
          <div style={{ padding: "16px 18px", background: "#F8FAFF", borderRadius: 12, border: "1px solid #EEF2F8", fontSize: 12.5, color: "#6B7280" }}>
            Storage usage reporting isn't available yet — media (audio/photo) is stored via your KoboToolbox/hosting provider, not billed per-GB here. This section controls retention policy only.
          </div>
        </SettingsGroup>
        <SectionDivider label="Retention Policy" />
        <SettingsGroup>
          <Toggle value={autoDeleteAudio} onChange={v => { setAutoDeleteAudio(v); save({ auto_delete_audio: v, archive_old: archiveOld, keep_ai_outputs: keepAiOutputs }); }} label="Auto-delete Raw Audio after 90 days" description="Audio files are deleted after analysis is complete" />
          <Toggle value={archiveOld} onChange={v => { setArchiveOld(v); save({ auto_delete_audio: autoDeleteAudio, archive_old: v, keep_ai_outputs: keepAiOutputs }); }} label="Archive submissions older than 12 months" description="Move to cold storage to reduce active storage usage" />
          <Toggle value={keepAiOutputs} onChange={v => { setKeepAiOutputs(v); save({ auto_delete_audio: autoDeleteAudio, archive_old: archiveOld, keep_ai_outputs: v }); }} label="Keep AI outputs indefinitely" description="Insight reports and analysis are never auto-deleted" />
        </SettingsGroup>
        {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
        {saving && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 8 }}>Saving…</div>}
        {saved && <div style={{ fontSize: 11.5, color: GREEN, marginTop: 8 }}>Saved</div>}
      </SettingsCard>
    </div>
  );
}

function SecuritySection() {
  const [twoFa, setTwoFa] = useState(false);
  const [sso, setSso] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("24h");
  const [ipRestrict, setIpRestrict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const _mapMinsToCode = (mins: number) => mins <= 60 ? "1h" : mins <= 240 ? "4h" : mins <= 480 ? "8h" : mins <= 1440 ? "24h" : "7d";
  const _mapCodeToMins = (code: string): number => ({ "1h": 60, "4h": 240, "8h": 480, "24h": 1440, "7d": 10080 }[code] || 1440);

  useEffect(() => {
    orgSettingsApi.getSecurity()
      .then(r => {
        const d = r.data || {};
        setTwoFa(!!d.two_factor_enabled);
        setSso(!!d.sso_enabled);
        if (d.session_timeout_mins) setSessionTimeout(_mapMinsToCode(d.session_timeout_mins));
        setIpRestrict(!!(d.ip_allowlist && d.ip_allowlist.length > 0));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await orgSettingsApi.updateSecurity({
        two_factor_enabled: twoFa, sso_enabled: sso,
        session_timeout_mins: _mapCodeToMins(sessionTimeout),
        ip_restrict_enabled: ipRestrict,
        ip_allowlist: [],
      });
      setSaved(true);
      setNote(r.data?.note || "");
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Authentication">
          <Toggle value={twoFa} onChange={setTwoFa} label="Two-Factor Authentication" description="Require a second verification step at login for all users in this organisation." />
          <Toggle value={sso} onChange={setSso} label="Single Sign-On (SSO)" description="Allow team members to sign in with your organisation's identity provider (SAML/OIDC)." />
        </SettingsGroup>
        <SectionDivider label="Session Management" />
        <SettingsGroup>
          <SettingsField label="Session Timeout" hint="How long a login stays valid before requiring re-authentication">
            <select style={{ ...INPUT }} value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}>
              {[["1h","1 hour"],["4h","4 hours"],["8h","8 hours"],["24h","24 hours"],["7d","7 days"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </SettingsField>
          <Toggle value={ipRestrict} onChange={setIpRestrict} label="IP Restriction" description="Restrict logins to approved IP address ranges. Configure your allowlist after enabling." />
        </SettingsGroup>
        {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
        {note && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 8 }}>{note}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Security Settings"}</button>
        </div>
      </SettingsCard>
    </div>
  );
}

function NotificationsSection() {
  const channels = [{id:"email",label:"Email"},{id:"slack",label:"Slack"},{id:"inapp",label:"In-App"}];
  const events = [
    {label:"New Submission Scored",desc:"When FieldScore processes a new submission"},
    {label:"Flagged Submission",desc:"When a submission is flagged for review"},
    {label:"Analysis Complete",desc:"When InsightScore finishes an analysis"},
    {label:"Report Ready",desc:"When Ada generates a report"},
    {label:"User Invited",desc:"When a new team member joins"},
    {label:"Storage Warning",desc:"When storage exceeds 80%"},
    {label:"Integration Error",desc:"When a connected integration fails"},
  ];
  const defaultPrefs = (): Record<string,Record<string,boolean>> => {
    const init: Record<string,Record<string,boolean>> = {};
    events.forEach(e => { init[e.label] = {email:true,slack:false,inapp:true}; });
    return init;
  };
  const [prefs, setPrefs] = useState<Record<string,Record<string,boolean>>>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    orgSettingsApi.getNotifications()
      .then(r => { if (r.data && Object.keys(r.data).length > 0) setPrefs(r.data); })
      .catch(() => {});
  }, []);

  const toggle = (event: string, channel: string) => {
    setPrefs(p => ({...p,[event]:{...p[event],[channel]:!p[event][channel]}}));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await orgSettingsApi.updateNotifications(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard style={{ padding: 24, overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>
        Only Email delivery is currently wired up. Slack and In-App toggles save your preference for when those channels are built, but won't send anything yet.
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
        <thead><tr><th style={{ ...LABEL, textAlign: "left", padding: "0 0 12px", width: "50%" }}>Event</th>{channels.map(c => <th key={c.id} style={{ ...LABEL, textAlign: "center", padding: "0 0 12px" }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {events.map(ev => (
            <tr key={ev.label} style={{ borderBottom: "1px solid #F8FAFF" }}>
              <td style={{ padding: "12px 0" }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ev.label}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{ev.desc}</div></td>
              {channels.map(c => (
                <td key={c.id} style={{ textAlign: "center", padding: "12px 0" }}>
                  <button onClick={() => toggle(ev.label, c.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${prefs[ev.label]?.[c.id] ? BLUE : "#E2E8F0"}`, background: prefs[ev.label]?.[c.id] ? BLUE : "white", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    {prefs[ev.label]?.[c.id] && <Check size={11} color="white" />}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Notifications"}</button>
      </div>
    </SettingsCard>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(ease * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return <>{display.toLocaleString()}</>;
}

// ─── Toast helper ─────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); };
  return { msg, show };
}

// ─── BillingSection ───────────────────────────────────────────────────────────
interface BillingData {
  plan: string; status: string; trial_ends_at?: string | null;
  usage_this_month: { submissions_scored: number; submissions_passed: number };
  total_submissions_all_time: number;
  payment_processing_configured: boolean;
  invoices: Array<{ ref: string; amount: number; status: string; date: string }>;
}

function BillingSection() {
  const { addMessage, setState, setOpen } = useAda();
  const { creditsBalance } = useGamify();
  const [adaQuestion, setAdaQuestion] = useState("");
  const [adaAnswer, setAdaAnswer] = useState<string | null>(null);
  const [adaAsking, setAdaAsking] = useState(false);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [billingError, setBillingError] = useState("");
  const toast = useToast();

  useEffect(() => {
    orgSettingsApi.getBilling()
      .then(r => setBilling(r.data))
      .catch(() => setBillingError("Could not load billing information."));
  }, []);

  const B = billing || {
    plan: "trial", status: "active", trial_ends_at: null,
    usage_this_month: { submissions_scored: 0, submissions_passed: 0 },
    total_submissions_all_time: 0, payment_processing_configured: false, invoices: [],
  };

  const statusColor = B.status === "active" ? GREEN : B.status === "trial" ? AMBER : RED;
  const statusLabel = B.status === "active" ? "Active" : B.status === "trial" ? "Trial" : B.status;
  const scored = B.usage_this_month.submissions_scored;

  const adaMsg = billing
    ? `You've scored ${scored.toLocaleString()} submission${scored === 1 ? "" : "s"} this month (${B.usage_this_month.submissions_passed.toLocaleString()} passed). ${B.total_submissions_all_time.toLocaleString()} total, all time.`
    : "Loading your usage…";

  const adaSuggestions = [
    "How do I earn rewards credits?",
    "What's included in the Professional plan?",
    "How does Paystack billing work?",
    "Can I get a discount for annual billing?",
    "What happens if I go over my limit?",
  ];

  const askAda = async (q: string) => {
    if (!q.trim() || adaAsking) return;
    setAdaAsking(true);
    setAdaAnswer(null);
    try {
      const res = await (await import("../../services/api")).adaApi.chat(q, "billing", { mode: "billing_help" });
      setAdaAnswer(res.data?.reply || res.data?.message || "I don't have a specific answer for that right now — email bibilade@intelligencyai.com.ng for billing support.");
    } catch {
      setAdaAnswer("I can't reach my knowledge base right now. For billing questions, email bibilade@intelligencyai.com.ng or use the chat button.");
    } finally {
      setAdaAsking(false);
      setState("speaking");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setState("thinking");
      setTimeout(() => {
        setState("speaking");
        addMessage({ id: Date.now().toString(), role: "assistant", content: adaMsg, timestamp: new Date().toISOString(), page: "settings-billing" });
        setTimeout(() => setState("idle"), 4000);
      }, 600);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toast */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "#111827", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ada help panel — always first, prominent ── */}
      <div style={{
        background: "linear-gradient(135deg,#0C1128 0%,#0F172A 60%,#140E2B 100%)",
        borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,.07)",
        boxShadow: "0 8px 32px rgba(8,13,26,.22)",
      }}>
        <div style={{ display: "flex", gap: 0 }}>
          {/* Ada avatar column */}
          <div style={{ width: 88, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 0", justifyContent: "flex-end", alignSelf: "flex-end" }}>
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} style={{ position: "relative" }}>
              <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0, 0.25] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ position: "absolute", inset: -7, borderRadius: "50%", border: "2px solid #60A5FA", pointerEvents: "none" }} />
              <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", boxShadow: "0 0 24px rgba(37,99,235,.3)" }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </div>
            </motion.div>
            <div style={{ marginTop: 8, marginBottom: 18, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "white" }}>Ada</div>
              <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.3)", letterSpacing: 0.7, textTransform: "uppercase" }}>Billing Help</div>
            </div>
          </div>

          <div style={{ width: 1, background: "rgba(255,255,255,.06)", alignSelf: "stretch", flexShrink: 0 }} />

          {/* Ada content */}
          <div style={{ flex: 1, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#93C5FD", letterSpacing: 1.1, textTransform: "uppercase" }}>Ada · Billing Assistant</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", lineHeight: 1.4, marginBottom: 6 }}>
              {adaMsg}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.42)", marginBottom: 14 }}>
              Ask me anything about your plan, payments, capacity, or upgrades.
            </div>

            {/* Quick question chips */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
              {adaSuggestions.map(q => (
                <button key={q} onClick={() => { setAdaQuestion(q); askAda(q); }}
                  style={{ padding: "5px 11px", borderRadius: 20, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.65)", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "Inter,sans-serif", transition: "all .15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.12)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.65)"; }}
                >{q}</button>
              ))}
            </div>

            {/* Ask input */}
            <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "8px 12px" }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,.5)")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.1)")}>
              <input value={adaQuestion} onChange={e => setAdaQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") askAda(adaQuestion); }}
                placeholder="Ask about pricing, upgrades, invoices…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12.5, color: "white", fontFamily: "Inter,sans-serif", caretColor: "#60A5FA" }} />
              <button onClick={() => askAda(adaQuestion)} disabled={!adaQuestion.trim() || adaAsking}
                style={{ padding: "4px 12px", borderRadius: 7, background: adaQuestion.trim() && !adaAsking ? BLUE : "rgba(255,255,255,.08)", border: "none", color: adaQuestion.trim() && !adaAsking ? "white" : "rgba(255,255,255,.25)", fontSize: 12, fontWeight: 700, cursor: adaQuestion.trim() ? "pointer" : "default", fontFamily: "Inter,sans-serif", transition: "all .15s", whiteSpace: "nowrap" as const }}>
                {adaAsking ? "…" : "Ask"}
              </button>
            </div>

            <AnimatePresence>
              {adaAnswer && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ marginTop: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "11px 14px", fontSize: 12.5, color: "rgba(255,255,255,.75)", lineHeight: 1.6 }}>
                  {adaAnswer}
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={() => setOpen(true)}
              style={{ marginTop: 12, fontSize: 11.5, color: "rgba(255,255,255,.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted" as const }}>
              Open full Ada chat →
            </button>
          </div>
        </div>
      </div>

      {/* ── FieldScore Rewards — credits applied to next payment ── */}
      <CreditsPanel />

      {/* ── Plan at a glance ── quick, no scrolling needed ── */}
      <SettingsCard style={{ padding: 0, overflow: "hidden" }}>
        {/* Plan header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #F1F5F9", flexWrap: "wrap" as const, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#080D1A", letterSpacing: -0.5, textTransform: "capitalize" as const }}>{B.plan}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: `${statusColor}14`, color: statusColor, border: `1px solid ${statusColor}30` }}>{statusLabel}</span>
            </div>
            {B.trial_ends_at && (
              <>
                <div style={{ width: 1, height: 24, background: "#E8EDF5" }} />
                <span style={{ fontSize: 12.5, color: "#6B7280" }}>Trial ends {new Date(B.trial_ends_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {creditsBalance > 0 && (
              <span style={{ fontSize: 11.5, color: GREEN, fontWeight: 700, background: "#ECFDF5", padding: "3px 10px", borderRadius: 12 }}>
                −₦{creditsBalance.toLocaleString()} rewards credit
              </span>
            )}
            <a href="mailto:bibilade@intelligencyai.com.ng?subject=Upgrade%20request" style={{ ...BTN_PRIMARY, fontSize: 12, padding: "8px 16px", textDecoration: "none", display: "inline-block" }}>Contact us to upgrade →</a>
          </div>
        </div>

        {/* Payment status row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", flexWrap: "wrap" as const, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CreditCard size={16} color="#9CA3AF" />
            <span style={{ fontSize: 12.5, color: "#6B7280" }}>
              {B.payment_processing_configured ? "Payment processing is configured for this account." : "No payment method on file — payment processing isn't configured for this account yet."}
            </span>
          </div>
        </div>
      </SettingsCard>

      {/* ── Usage this month ── */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Usage This Month</div>
        </div>
        {billingError && <div style={{ fontSize: 12, color: RED }}>{billingError}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #EEF2F8", background: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>🔍</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>FieldScore Verifications</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" as const }}>
                    <AnimatedNumber target={scored} />
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{B.usage_this_month.submissions_passed.toLocaleString()} passed this month · {B.total_submissions_all_time.toLocaleString()} all-time</div>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ── Invoice history ── */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 16 }}>Invoice History</div>
        {B.invoices.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>No invoices yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {B.invoices.map((inv, i) => (
              <div key={inv.ref} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderBottom: i < B.invoices.length - 1 ? "1px solid #F8FAFF" : "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F0FDF4", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <CreditCard size={13} color={GREEN} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>₦{inv.amount.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{inv.ref} · {inv.date}</div>
                </div>
                <Badge label={inv.status} color={inv.status === "paid" ? GREEN : AMBER} />
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 11.5, color: "#9CA3AF" }}>
          For billing queries, email{" "}
          <a href="mailto:bibilade@intelligencyai.com.ng" style={{ color: BLUE, textDecoration: "none" }}>bibilade@intelligencyai.com.ng</a>
        </div>
      </SettingsCard>

    </div>
  );
}

function ApiSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="API Keys">
          <div style={{ padding: "14px 16px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA", fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
            API key management is not yet available in-app. Contact <a href="mailto:bibilade@intelligencyai.com.ng" style={{ color: "#2463EB" }}>bibilade@intelligencyai.com.ng</a> to request an API key for your organisation.
          </div>
        </SettingsGroup>
        <SectionDivider label="Webhooks" />
        <SettingsGroup>
          <div style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8", fontSize: 12.5, color: "#6B7280" }}>
            No webhooks configured. Webhooks will let you receive real-time events (submission scored, report ready) at a URL you control.
          </div>
          <button style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}><Plus size={13} /> Add Webhook</button>
        </SettingsGroup>
        <SectionDivider label="Documentation" />
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><ExternalLink size={12} /> API Reference</button>
          <button style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><ExternalLink size={12} /> Webhook Guide</button>
        </div>
      </SettingsCard>
    </div>
  );
}

function AuditSection() {
  return (
    <SettingsCard style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Audit Log</div>
      </div>
      <div style={{ padding: "20px 24px", background: "#F8FAFF", borderRadius: 12, border: "1px solid #EEF2F8", textAlign: "center" as const }}>
        <ClipboardList size={28} color="#CBD5E1" style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Audit logging isn't enabled yet</div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
          When audit logging is turned on, every login, export, settings change, and data deletion will be recorded here with the user, timestamp, and IP address.
          Contact <a href="mailto:bibilade@intelligencyai.com.ng" style={{ color: BLUE, textDecoration: "none" }}>bibilade@intelligencyai.com.ng</a> to enable audit logging for your organisation.
        </div>
      </div>
    </SettingsCard>
  );
}

function DangerSection() {
  const navigate = useNav();
  const [showModal, setShowModal] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleReset = async () => {
    if (resetText !== "RESET") return;
    setResetting(true);
    try {
      await orgAdminApi.resetData();
      setShowModal(false);
      showToast("All data cleared");
      setTimeout(() => navigate("/projects"), 1800);
    } catch {
      showToast("Reset failed. Please try again.");
      setResetting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "#111827", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset all data modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(8,13,26,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              style={{ background: "white", borderRadius: 16, border: `2px solid ${RED}`, boxShadow: "0 8px 40px rgba(220,38,38,.2)", width: 440, maxWidth: "calc(100vw - 32px)", fontFamily: "Inter,sans-serif", overflow: "hidden" }}
            >
              {/* Red modal header */}
              <div style={{ background: RED, padding: "20px 28px", display: "flex", alignItems: "center", gap: 12 }}>
                <ShieldAlert size={22} color="white" />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Reset all data?</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>This cannot be undone</div>
                </div>
              </div>
              <div style={{ padding: "24px 28px 0" }}>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, marginBottom: 16 }}>
                This will permanently delete:
                <ul style={{ margin: "10px 0 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                  <li style={{ color: RED, fontWeight: 600 }}>All projects</li>
                  <li style={{ color: RED, fontWeight: 600 }}>All submissions</li>
                  <li style={{ color: RED, fontWeight: 600 }}>All enumerators</li>
                  <li style={{ color: RED, fontWeight: 600 }}>All analysis and reports</li>
                </ul>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, padding: "12px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                ✓ Your account and organisation login will remain intact.<br />
                You will need to set up projects again from scratch.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Type <strong>RESET</strong> to confirm:
                </label>
                <input
                  value={resetText}
                  onChange={e => setResetText(e.target.value)}
                  placeholder="RESET"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${resetText === "RESET" ? RED : "#E2E8F0"}`, fontSize: 13, color: "#111827", fontFamily: "Inter,sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingBottom: 24 }}>
                <button
                  onClick={() => { setShowModal(false); setResetText(""); }}
                  disabled={resetting}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}
                >Cancel</button>
                <button
                  onClick={handleReset}
                  disabled={resetText !== "RESET" || resetting}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: resetText === "RESET" && !resetting ? RED : "#FCA5A5", color: "white", fontSize: 13, fontWeight: 700, cursor: resetText !== "RESET" || resetting ? "not-allowed" : "pointer", fontFamily: "Inter,sans-serif", boxShadow: resetText === "RESET" ? "0 2px 8px rgba(220,38,38,.4)" : "none", transition: "all .15s" }}
                >{resetting ? "Resetting…" : "⚠ Reset everything"}</button>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettingsCard style={{ padding: 0, border: `2px solid ${RED}`, overflow: "hidden" }}>
        {/* Red header banner */}
        <div style={{ background: RED, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={18} color="white" />
          <div style={{ fontSize: 14, fontWeight: 800, color: "white", letterSpacing: ".3px" }}>Danger Zone</div>
          <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.7)", letterSpacing: ".5px", textTransform: "uppercase" }}>Irreversible actions</div>
        </div>

        <div style={{ padding: "20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, padding: "16px 18px", background: "#FFF5F5", borderRadius: 10, border: "1px solid #FECACA" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Reset all data</div>
              <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.6 }}>
                Permanently deletes all projects, submissions, enumerators, and analysis.<br />
                Your account and login remain intact.
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 8, border: "none", background: RED, color: "white", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(220,38,38,.35)" }}
            >⚠ Reset all data</button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── Engine Config ────────────────────────────────────────────────────────────
const ENGINE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  gps:       { label: "GPS Location",    icon: "📍", desc: "Checks if the interview location matches the assigned site" },
  duration:  { label: "Duration",        icon: "⏱",  desc: "Flags interviews that are too short or suspiciously long" },
  image:     { label: "Image Quality",   icon: "🖼",  desc: "Verifies photos are real, unedited, and from the field" },
  audio:     { label: "Audio Quality",   icon: "🎙",  desc: "Checks for background noise, muted responses, and authenticity" },
  duplicate: { label: "Duplicate Check", icon: "🔁",  desc: "Detects copy-paste or suspiciously similar submissions" },
  text_ai:   { label: "AI Detection",    icon: "🤖",  desc: "Identifies AI-written or auto-generated text responses" },
};
const ENGINE_ORDER = ["gps","duration","image","audio","duplicate","text_ai"];

type WeightMap = { gps:number; duration:number; image:number; audio:number; duplicate:number; text_ai:number; };
type GatingMap = { gps_reject_skips: string[]; duration_reject_skips: string[]; duplicate_reject_skips: string[]; };


function GatingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, border: `1px solid ${checked ? "#BFDBFE" : "#E2E8F0"}`, background: checked ? "#EFF6FF" : "#F8FAFF", cursor: "pointer", fontSize: 12, fontWeight: 600, color: checked ? BLUE : "#6B7280", fontFamily: "Inter,sans-serif", transition: "all .15s" }}>
      {checked ? <Check size={11} color={BLUE} /> : <X size={11} color="#CBD5E1" />}
      {label}
    </button>
  );
}

function EngineSection() {
  const { addMessage, setState } = useAda();
  const { activeProject } = useProject();
  const _cfg = loadEngineConfig();
  const [weights, setWeights] = useState<WeightMap>({ ..._cfg.weights } as WeightMap);
  const [gating, setGating] = useState<GatingMap>({
    gps_reject_skips: [..._cfg.gating.gps_reject_skips],
    duration_reject_skips: [..._cfg.gating.duration_reject_skips],
    duplicate_reject_skips: [..._cfg.gating.duplicate_reject_skips],
  });
  const [requirements, setRequirements] = useState<EngineRequirements>({ ..._cfg.requirements });
  const [zoneLat, setZoneLat] = useState<string>(_cfg.assignedZone.lat != null ? String(_cfg.assignedZone.lat) : "");
  const [zoneLon, setZoneLon] = useState<string>(_cfg.assignedZone.lon != null ? String(_cfg.assignedZone.lon) : "");
  const [zoneRadius, setZoneRadius] = useState<number>(_cfg.assignedZone.radiusM);
  const [zoneLabel, setZoneLabel] = useState<string>(_cfg.assignedZone.label || "");
  // Multi-zone list — overrides the single zone when non-empty
  const [zoneList, setZoneList] = useState<AssignedZone[]>([..._cfg.zoneList]);
  const [newZoneLat, setNewZoneLat] = useState("");
  const [newZoneLon, setNewZoneLon] = useState("");
  const [newZoneRadius, setNewZoneRadius] = useState(250);
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [passScoreThreshold, setPassScoreThreshold] = useState(_cfg.passScoreThreshold);
  const [researchPurpose, setResearchPurpose] = useState("");
  const [imageContentHint, setImageContentHint] = useState(_cfg.imageContentHint || "");
  const [audioContentHint, setAudioContentHint] = useState(_cfg.audioContentHint || "");
  const [aiHighPenalty, setAiHighPenalty] = useState(_cfg.aiHighPenalty);
  const [aiMediumPenalty, setAiMediumPenalty] = useState(_cfg.aiMediumPenalty);
  const [aiMediumFlag, setAiMediumFlag] = useState(_cfg.aiMediumFlag);
  const [saved, setSaved] = useState(false);
  const [backendSaveError, setBackendSaveError] = useState("");

  // The image/audio context hints below used to be saved ONLY to this
  // browser's localStorage — invisible to the actual scoring engine, which
  // reads image_context/audio_context from the project's row in Postgres.
  // A project could be set to "Health" here and the AI still had zero
  // context for what a Health-project photo should look like. Load the
  // real backend value (source of truth for scoring) when a project is
  // active, so what's on screen matches what the AI actually uses.
  useEffect(() => {
    if (!activeProject?.id) return;
    dashboardApi.getScoringConfig(activeProject.id)
      .then(r => {
        const c = r.data?.config || {};
        if (c.research_purpose) setResearchPurpose(c.research_purpose);
        if (c.image_context) setImageContentHint(c.image_context);
        if (c.audio_context) setAudioContentHint(c.audio_context);
        if (c.pass_threshold) setPassScoreThreshold(Number(c.pass_threshold));
        // Project-level zone (fallback gate — an enumerator's own assigned
        // zone below always wins over this when set). Same staleness bug as
        // image_context: this used to only ever reach localStorage.
        if (c.zone_lat != null && c.zone_lat !== "") setZoneLat(String(c.zone_lat));
        if (c.zone_lon != null && c.zone_lon !== "") setZoneLon(String(c.zone_lon));
        if (c.zone_radius_m) setZoneRadius(Number(c.zone_radius_m));
        if (c.zone_label) setZoneLabel(c.zone_label);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  const totalW = ENGINE_ORDER.reduce((s, k) => s + (requirements[k as keyof EngineRequirements] !== "DISABLED" ? weights[k as keyof WeightMap] : 0), 0);

  const toggleGate = (gate: keyof GatingMap, engine: string) => {
    setGating(prev => {
      const arr = prev[gate];
      return { ...prev, [gate]: arr.includes(engine) ? arr.filter(e => e !== engine) : [...arr, engine] };
    });
  };

  const save = () => {
    // Persist to localStorage so SubmissionDetailPage can read it
    const current = loadEngineConfig();
    saveEngineConfig({
      ...current,
      weights: { ...weights } as EngineConfig["weights"],
      requirements: { ...requirements },
      passScoreThreshold,
      imageContentHint: imageContentHint.trim(),
      audioContentHint: audioContentHint.trim(),
      assignedZone: {
        lat: zoneLat.trim() !== "" && !isNaN(Number(zoneLat)) ? Number(zoneLat) : null,
        lon: zoneLon.trim() !== "" && !isNaN(Number(zoneLon)) ? Number(zoneLon) : null,
        radiusM: zoneRadius,
        label: zoneLabel.trim(),
      },
      zoneList: [...zoneList],
      gating: {
        gps_reject_skips: [...gating.gps_reject_skips],
        duration_reject_skips: [...gating.duration_reject_skips],
        duplicate_reject_skips: [...gating.duplicate_reject_skips],
      },
      aiHighPenalty,
      aiMediumPenalty,
      aiMediumFlag,
    });

    // Also push the context hints + threshold to the backend, project-scoped —
    // this is what the actual scoring engine reads (config_loader.py). Without
    // this, the fields above only ever affected the frontend's own re-display
    // math, never what the AI checks were told about the project.
    setBackendSaveError("");
    if (activeProject?.id) {
      dashboardApi.updateScoringConfig(activeProject.id, {
        research_purpose: researchPurpose.trim(),
        image_context: imageContentHint.trim(),
        audio_context: audioContentHint.trim(),
        pass_threshold: passScoreThreshold,
        zone_lat: zoneLat.trim() !== "" && !isNaN(Number(zoneLat)) ? Number(zoneLat) : null,
        zone_lon: zoneLon.trim() !== "" && !isNaN(Number(zoneLon)) ? Number(zoneLon) : null,
        zone_radius_m: zoneRadius,
        zone_label: zoneLabel.trim(),
      }).then(() => {
        // Best-effort rescore — if it fails, the config is already saved and
        // will apply to future submissions. Don't surface this as a save error.
        dashboardApi.rescoreProject(activeProject.id, 'recompute').catch(() => {});
      }).catch(() => setBackendSaveError(
        "Saved locally, but couldn't save to the server — the AI checks won't see this context until it's retried."
      ));
    } else {
      setBackendSaveError("Select a project first — choose a project from the dropdown above before saving context to the scoring engine.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setState("thinking");
    setTimeout(() => {
      setState("speaking");
      const active = ENGINE_ORDER.filter(k => requirements[k as keyof EngineRequirements] !== "DISABLED");
      addMessage({ id: Date.now().toString(), role: "assistant", content: `Engine config saved. You have ${active.length} active engines with GPS carrying the most weight (${Math.round((weights.gps / totalW) * 100)}% after normalisation). Gating is set up so a GPS reject skips ${gating.gps_reject_skips.length > 0 ? gating.gps_reject_skips.join(" and ") : "nothing"} — that saves processing time and avoids penalising real submissions twice. AI detection is set to HIGH = ${aiHighPenalty} point penalty, MEDIUM = ${aiMediumPenalty} points${aiMediumFlag ? " + flag for review" : ", no flag"}. These settings apply immediately to the score display on all submission detail pages.`, timestamp: new Date().toISOString(), page: "settings-engine" });
      setTimeout(() => setState("idle"), 5000);
    }, 700);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setState("thinking");
      setTimeout(() => {
        setState("speaking");
        addMessage({ id: Date.now().toString(), role: "assistant", content: "This is the Engine Config — the brain behind every FieldScore verdict. You can adjust how much each check contributes to the final score, skip expensive checks when a submission is already clearly fraudulent (engine gating), and calibrate how hard AI-generated text is penalised. The defaults are well-tuned for most fieldwork, but every project is different. Ask me if you're unsure what to change.", timestamp: new Date().toISOString(), page: "settings-engine" });
        setTimeout(() => setState("idle"), 6000);
      }, 600);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Pass Verdict Threshold — what the client defines as a PASS */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.7 }}>What counts as a PASS?</div>
          <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18, padding: "10px 14px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0", lineHeight: 1.6 }}>
          A submission with a Trust Index <strong>at or above this score</strong> is a <span style={{ color: GREEN, fontWeight: 700 }}>PASS</span>. Below it — or with a high-severity flag (fake GPS, duplicate, impossible speed) — is a <span style={{ color: RED, fontWeight: 700 }}>REJECT</span>. Minor flags with a passing score are <span style={{ color: AMBER, fontWeight: 700 }}>FLAG</span> (send to review).
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <input type="range" min={30} max={90} value={passScoreThreshold}
              onChange={e => setPassScoreThreshold(Number(e.target.value))}
              style={{ width: "100%", accentColor: GREEN }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#9CA3AF", marginTop: 4 }}>
              <span>Lenient (30)</span><span>Strict (90)</span>
            </div>
          </div>
          <div style={{ width: 64, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: GREEN, lineHeight: 1 }}>{passScoreThreshold}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>/ 100</div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          {[{ label: "Lenient (50)", v: 50 }, { label: "Balanced (60)", v: 60 }, { label: "Standard (70)", v: 70 }, { label: "Strict (80)", v: 80 }].map(p => (
            <button key={p.v} onClick={() => setPassScoreThreshold(p.v)}
              style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${passScoreThreshold === p.v ? GREEN : "#E2E8F0"}`, background: passScoreThreshold === p.v ? "#F0FDF4" : "white", color: passScoreThreshold === p.v ? GREEN : "#6B7280", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
              {p.label}
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* Research Purpose */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>🎯 Research Purpose</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, lineHeight: 1.6 }}>
          Describe what this project is trying to find out. Ada uses this when analysing your submissions — without it, she infers purpose from field names and may get it wrong.
        </div>
        <textarea
          value={researchPurpose}
          onChange={e => setResearchPurpose(e.target.value)}
          placeholder="e.g. This survey asks community members about their experiences with and perceptions of public health facilities in Lagos. Photos and GPS are supporting evidence only — the primary data is respondents' opinions, satisfaction levels, and suggestions."
          rows={4}
          style={{ ...INPUT, fontSize: 12.5, resize: "vertical", lineHeight: 1.6 }}
        />
        {!activeProject?.id && (
          <div style={{ fontSize: 10.5, color: "#D97706", marginTop: 6 }}>Select a project from the sidebar so this is saved to the right project.</div>
        )}
      </SettingsCard>

      {/* Score Weights */}
      <SettingsCard style={{ padding: 24 }}>
        <SettingsHeader title="" description="" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7 }}>Score Weights</div>
          <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
          <div style={{ fontSize: 11, color: totalW > 0 && Math.abs(totalW - 1) < 0.001 ? GREEN : AMBER, fontWeight: 700 }}>
            {Math.round(totalW * 100)}% assigned
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18, padding: "10px 14px", background: "#F8FAFF", borderRadius: 8, border: "1px solid #EEF2F8", lineHeight: 1.6 }}>
          Each active engine contributes to the Trust Index out of 100. Weights are normalised automatically, so the relative balance is what matters — not the exact total. Each engine also has a <strong>requirement level</strong>: <strong>Optional</strong> evidence that's missing is simply excluded (no penalty); <strong>Required</strong> evidence that's missing scores 0 at full weight — the enumerator cannot make those points up elsewhere; <strong>Hard gate</strong> means a missing channel makes the whole submission ineligible. GPS, Duration and Image are Required by default because they're the channels an enumerator physically controls in the field. Full method: docs/15 Trust Intelligence Bible.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ENGINE_ORDER.map(key => {
            const k = key as keyof WeightMap;
            const meta = ENGINE_LABELS[key];
            const w = weights[k];
            const pct = totalW > 0 ? Math.round((w / totalW) * 100) : 0;
            const req = requirements[k as keyof EngineRequirements];
            const isEnabled = req !== "DISABLED";
            const isDerived = key === "duplicate" || key === "text_ai";
            const REQ_OPTIONS: { value: EngineRequirement; label: string; hint: string; color: string }[] = [
              { value: "DISABLED", label: "Off", hint: "Ignored entirely", color: "#9CA3AF" },
              { value: "OPTIONAL", label: "Optional", hint: "Missing evidence is not penalised", color: BLUE },
              { value: "REQUIRED", label: "Required", hint: "Missing evidence scores 0 at full weight", color: AMBER },
              { value: "HARD_REQUIRED", label: "Hard gate", hint: "Missing evidence makes the submission ineligible", color: RED },
            ];
            return (
              <div key={key} style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${isEnabled ? "#EEF2F8" : "#F1F5F9"}`, background: isEnabled ? "#F8FAFF" : "#FAFAFA", opacity: isEnabled ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{meta.desc}</div>
                  </div>
                  {isEnabled && <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, minWidth: 36, textAlign: "right" }}>{pct}%</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isEnabled ? 10 : 0 }}>
                  {REQ_OPTIONS.filter(o => !(isDerived && o.value === "HARD_REQUIRED")).map(o => (
                    <button
                      key={o.value}
                      title={o.hint}
                      onClick={() => setRequirements(prev => ({ ...prev, [k]: o.value }))}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${req === o.value ? o.color : "#E2E8F0"}`, background: req === o.value ? o.color + "15" : "white", color: req === o.value ? o.color : "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {isEnabled && (
                  <input
                    type="range" min={1} max={50} value={Math.round(w * 100)}
                    onChange={e => setWeights(prev => ({ ...prev, [k]: Number(e.target.value) / 100 }))}
                    style={{ width: "100%", accentColor: BLUE }}
                  />
                )}
                {isEnabled && key === "image" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>What should the photo show? <span style={{ fontWeight: 400 }}>(sent to the AI image check for this project)</span></div>
                    <input value={imageContentHint} onChange={e => setImageContentHint(e.target.value)}
                      placeholder="e.g. Health facility survey — clinics, health workers, patients, medical equipment"
                      style={{ ...INPUT, fontSize: 12 }} />
                    {!activeProject?.id && (
                      <div style={{ fontSize: 10.5, color: "#D97706", marginTop: 4 }}>No active project — select one from the sidebar so this reaches the scoring engine, not just this browser.</div>
                    )}
                  </div>
                )}
                {isEnabled && key === "audio" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>What should the audio capture? <span style={{ fontWeight: 400 }}>(sent to the AI audio check for this project)</span></div>
                    <input value={audioContentHint} onChange={e => setAudioContentHint(e.target.value)}
                      placeholder="e.g. Both interviewer and respondent voices, full questionnaire duration"
                      style={{ ...INPUT, fontSize: 12 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Assigned Zone Verification */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>📍 Assigned Zone Verification</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18, padding: "10px 14px", background: "#F8FAFF", borderRadius: 8, border: "1px solid #EEF2F8", lineHeight: 1.6 }}>
          Tell FieldScore where enumeration should happen and it verifies every submission's GPS against that location using great-circle (haversine) distance. Inside the radius corroborates presence; outside it is treated as a critical violation and the submission is rejected for review. <strong>Leave the coordinates empty to skip verification</strong> — the platform will simply show where each enumeration actually happened (coordinates and address). If an individual enumerator has their own assigned zone set, it always takes priority over this project-level one.
        </div>
        {!activeProject?.id && (
          <div style={{ fontSize: 11.5, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            No active project selected — this will only be saved to this browser, not to the scoring engine.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Latitude", value: zoneLat, set: setZoneLat, placeholder: "e.g. 6.5158" },
            { label: "Longitude", value: zoneLon, set: setZoneLon, placeholder: "e.g. 3.3898" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>{f.label}</div>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Radius (metres)</div>
            <input type="number" min={10} value={zoneRadius} onChange={e => setZoneRadius(Math.max(10, Number(e.target.value) || 10))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Location name (optional)</div>
            <input value={zoneLabel} onChange={e => setZoneLabel(e.target.value)} placeholder="e.g. Akoka Primary Health Centre"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>
        {zoneLat.trim() !== "" && zoneLon.trim() !== "" && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: GREEN, fontWeight: 600 }}>
            ✓ Zone verification active — submissions more than {zoneRadius} m from {zoneLabel || `${zoneLat}, ${zoneLon}`} will be rejected for review.
          </div>
        )}
      </SettingsCard>

      {/* Multi-site zone list */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>🗺 Field Site Zone List</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, padding: "10px 14px", background: "#F8FAFF", borderRadius: 8, border: "1px solid #EEF2F8", lineHeight: 1.6 }}>
          Real projects often have <strong>many field sites</strong> (e.g. 40 health centres). Add each one here. When zones are listed, FieldScore picks the <strong>closest zone</strong> to each submission's GPS coordinates and verifies against it — so one config serves the whole project. When this list has entries, the single zone above is ignored.
        </div>
        <div style={{ fontSize: 11.5, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
          Not yet enforced by the scoring engine — this list only affects this browser's own display right now, unlike the single zone above (which is real). Use the single zone field for an actual enforced project geofence until multi-site support is wired to the backend.
        </div>

        {/* Existing zones */}
        {zoneList.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {zoneList.map((z, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{z.label || `Zone ${i + 1}`}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace", marginTop: 2 }}>{z.lat}, {z.lon} · radius {z.radiusM}m</div>
                </div>
                <button onClick={() => setZoneList(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", padding: "4px 8px", color: RED, fontSize: 11, fontFamily: "Inter,sans-serif" }}>
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new zone */}
        <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#FAFAFA" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Add a field site</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[
              { label: "Latitude", value: newZoneLat, set: setNewZoneLat, ph: "e.g. 6.5158" },
              { label: "Longitude", value: newZoneLon, set: setNewZoneLon, ph: "e.g. 3.3898" },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12.5, fontFamily: "monospace", boxSizing: "border-box" as const }}/>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>Radius (metres)</div>
              <input type="number" min={10} value={newZoneRadius} onChange={e => setNewZoneRadius(Math.max(10, Number(e.target.value)||10))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12.5, fontFamily: "monospace", boxSizing: "border-box" as const }}/>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>Site name</div>
              <input value={newZoneLabel} onChange={e => setNewZoneLabel(e.target.value)} placeholder="e.g. Akoka PHC"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12.5, boxSizing: "border-box" as const }}/>
            </div>
          </div>
          <button
            onClick={() => {
              const lat = Number(newZoneLat.trim()), lon = Number(newZoneLon.trim());
              if (isNaN(lat) || isNaN(lon) || !newZoneLat.trim() || !newZoneLon.trim()) return;
              setZoneList(prev => [...prev, { lat, lon, radiusM: newZoneRadius, label: newZoneLabel.trim() }]);
              setNewZoneLat(""); setNewZoneLon(""); setNewZoneRadius(250); setNewZoneLabel("");
            }}
            style={{ ...BTN_PRIMARY, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <Plus size={13}/> Add Site
          </button>
        </div>
        {zoneList.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: GREEN, fontWeight: 600 }}>
            ✓ {zoneList.length} field site{zoneList.length > 1 ? "s" : ""} configured — FieldScore will match each submission to the nearest site.
          </div>
        )}
      </SettingsCard>

      {/* Engine Gating */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Engine Gating</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18, padding: "10px 14px", background: "#F8FAFF", borderRadius: 8, border: "1px solid #EEF2F8", lineHeight: 1.6 }}>
          When an upstream check already determines a submission is fraudulent, there's no point running the remaining expensive checks. Gating skips those engines, saves cost, and avoids double-penalising a submission for the same root problem. The skipped engines are marked GATED and excluded from scoring.
        </div>
        {([
          { gate: "gps_reject_skips" as keyof GatingMap, label: "📍 GPS REJECT → skip these engines", hint: "If GPS is rejected (clearly wrong location), skip image and audio checks — the submission is already disqualified.", skip: ["image","audio","duration","text_ai"] },
          { gate: "duration_reject_skips" as keyof GatingMap, label: "⏱ Duration REJECT → skip these engines", hint: "If the interview was impossibly fast or suspiciously long, skip image and audio analysis.", skip: ["image","audio"] },
          { gate: "duplicate_reject_skips" as keyof GatingMap, label: "🔁 Duplicate REJECT → skip these engines", hint: "If a submission is a near-exact duplicate, skip audio and AI text analysis — it's already failed.", skip: ["audio","text_ai"] },
        ] as const).map(({ gate, label, hint, skip }) => (
          <div key={gate} style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid #EEF2F8", background: "#F8FAFF" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 12, lineHeight: 1.5 }}>{hint}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {skip.map(eng => (
                <GatingToggle
                  key={eng}
                  label={`${ENGINE_LABELS[eng]?.icon} ${ENGINE_LABELS[eng]?.label}`}
                  checked={gating[gate].includes(eng)}
                  onChange={() => toggleGate(gate, eng)}
                />
              ))}
            </div>
          </div>
        ))}
      </SettingsCard>

      {/* AI Detection Calibration */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>🤖 AI Detection Penalties</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18, padding: "10px 14px", background: "#FFF7ED", borderRadius: 8, border: "1px solid #FED7AA", lineHeight: 1.6 }}>
          Ada's AI detection engine returns a confidence level — HIGH, MEDIUM, or LOW — for each AI-generated response. HIGH confidence means multiple strong signals (OpenAI metadata, C2PA content credentials, GPT-4o visual analysis). MEDIUM means some signals but not conclusive. LOW is treated as authentic to avoid punishing legitimate submissions.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #FEE2E2", background: "#FFF5F5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>HIGH confidence penalty</div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Clear AI signals — multiple independent detectors agree. Submission is very likely AI-generated.</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: RED, minWidth: 52, textAlign: "right" }}>-{aiHighPenalty}pts</div>
            </div>
            <input type="range" min={20} max={70} value={aiHighPenalty} onChange={e => setAiHighPenalty(Number(e.target.value))} style={{ width: "100%", accentColor: RED }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#9CA3AF", marginTop: 4 }}><span>Light (-20)</span><span>Severe (-70)</span></div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #FEF3C7", background: "#FFFBEB" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>MEDIUM confidence penalty</div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Some AI signals detected — warrants human review but not an automatic reject.</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: AMBER, minWidth: 52, textAlign: "right" }}>-{aiMediumPenalty}pts</div>
            </div>
            <input type="range" min={0} max={40} value={aiMediumPenalty} onChange={e => setAiMediumPenalty(Number(e.target.value))} style={{ width: "100%", accentColor: AMBER }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#9CA3AF", marginTop: 4 }}><span>None (0)</span><span>Significant (-40)</span></div>
            <div style={{ marginTop: 12 }}>
              <Toggle value={aiMediumFlag} onChange={setAiMediumFlag} label="Flag MEDIUM detections for supervisor review" description="Sends the submission to the Verify queue for human inspection — without penalising the score further" />
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #DCFCE7", background: "#F0FDF4" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>LOW confidence — no action</div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>A few weak signals detected but nothing conclusive. Treated as authentic to avoid penalising real submissions. No score deduction, no flag.</div>
          </div>
        </div>
      </SettingsCard>

      {backendSaveError && (
        <div style={{ fontSize: 12, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px" }}>
          {backendSaveError}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} style={BTN_PRIMARY}>
          {saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Engine Config"}
        </button>
      </div>
    </div>
  );
}

const SECTION_COMPONENTS: Record<string, React.FC> = {
  organization:OrgSection,workspace:WorkspaceSection,users:UsersSection,roles:RolesSection,
  branding:BrandingSection,integrations:IntegrationsSection,ada:AdaSection,research:ResearchSection,
  engine:EngineSection,
  storage:StorageSection,security:SecuritySection,notifications:NotificationsSection,
  billing:BillingSection,api:ApiSection,audit:AuditSection,danger:DangerSection,
};

const SECTION_META: Record<string,{title:string;description:string}> = {
  organization:{title:"Organisation",description:"Core identity and contact information for your organisation"},
  workspace:{title:"Workspace",description:"Configure your active research workspace and projects"},
  users:{title:"Users & Teams",description:"Manage team members, invitations, and access"},
  roles:{title:"Roles & Permissions",description:"Control what each role can see and do in ResearchOS"},
  branding:{title:"Branding",description:"Customise logos, colours, fonts, and report templates"},
  integrations:{title:"Integrations",description:"Connect ResearchOS to your data collection and productivity tools"},
  ada:{title:"AI & Ada",description:"Configure Ada's behaviour, personality, and AI model settings"},
  research:{title:"Research Defaults",description:"Default thresholds and parameters for FieldScore and InsightScore"},
  engine:{title:"Engine Configuration",description:"Score weights, engine gating rules, and AI detection penalties for FieldScore"},
  storage:{title:"Data & Storage",description:"Storage usage, breakdown, and retention policy"},
  security:{title:"Security",description:"Authentication, sessions, and access controls"},
  notifications:{title:"Notifications",description:"Configure when and how your team is notified"},
  billing:{title:"Billing",description:"Plan, usage, and invoice management"},
  api:{title:"API & Webhooks",description:"Programmatic access and real-time event integrations"},
  audit:{title:"Audit Log",description:"Full history of user and system activity in your organisation"},
  danger:{title:"Danger Zone",description:"Irreversible actions that affect all your organisation's data"},
};

const SECTION_ADA_HINTS: Record<string, { short: string; chips: { label: string; message: string }[] }> = {
  organization: {
    short: "Your organisation name and logo appear on every report you generate. Keep them up to date so clients see your brand, not a placeholder.",
    chips: [
      { label: "What goes on reports?", message: "Your Organisation Name, Logo, and Brand Colour are stamped on every PDF and PPTX you generate from the Reports section. The accent colour appears in chart headers and the footer. Make sure it's your actual brand colour — clients will see it." },
      { label: "How do I add a logo?", message: "In the Branding section (left menu), you can upload your organisation logo. Supported formats are PNG and SVG. Square logos (1:1 ratio) work best — they appear in report covers and the sidebar." },
    ],
  },
  research: {
    short: "These thresholds control how I flag submissions. Min duration, GPS tolerance, and the pass score cutoff all affect what appears as PASS, FLAG, or REJECT on every submission detail page.",
    chips: [
      { label: "What's a good pass threshold?", message: "For most household surveys, 65–70/100 is the sweet spot. Lower than 65 risks passing weak submissions; above 75 will reject too many genuinely good ones. If you're running a high-stakes study (health, election monitoring), push it to 72–75." },
      { label: "Recommended Nigeria defaults?", message: "For typical Nigerian fieldwork: GPS tolerance 100m (network GPS in dense urban areas often drifts to 80–120m), min duration 6 mins for short surveys / 12 mins for household surveys, max 90 mins. Pass threshold 68. Duplicate threshold 80% — the default 85% occasionally lets near-duplicates through." },
    ],
  },
  engine: {
    short: "Score weights and gating rules determine how much each check matters. GPS and Duration carry the most by default because they're the hardest to fake. AI Detection penalises scripted or ChatGPT-generated answers.",
    chips: [
      { label: "Should I turn off any engines?", message: "Only disable an engine if your study genuinely doesn't use that media type. If your form has no photos, turn off Image Quality — it will show 'Not scored' instead of dragging the average down. Never disable GPS unless you're doing phone surveys with no location expectation." },
      { label: "What does gating do?", message: "Gating skips expensive checks when an upstream check already failed decisively. Example: if GPS is rejected (wrong country), there's no point running image and audio analysis — the submission is already disqualified. Gating saves cost and prevents double-penalising a submission for the same root problem." },
    ],
  },
  billing: {
    short: "Rewards credits are applied to your next invoice automatically. You earn them by issuing certificates, generating reports, and completing quality milestones. No redemption needed — they just reduce what you owe.",
    chips: [
      { label: "How do I earn more credits?", message: "Fastest ways to earn: (1) Issue a Data Integrity Certificate after a project completes — ₦5,000 on your first one. (2) Generate a report — ₦2,500 each time. (3) Reach 500 verified submissions — ₦10,000 milestone. (4) Complete 5 projects — ₦20,000. Check your milestone tracker in the Credits panel below." },
      { label: "When are credits applied?", message: "Credits are applied automatically to your next invoice. You don't need to do anything — when your billing date arrives, your balance is deducted from the total before payment is charged. You can see your current balance and transaction history in the Credits panel." },
    ],
  },
  users: {
    short: "Each role has different access. Managers see everything. Viewers can see submissions and reports but can't change settings. Observers (clients) see reports only. Invite clients as Observer so they can track progress without touching your configuration.",
    chips: [
      { label: "What can each role do?", message: "Admin: full access including billing and team management. Manager: all data, submissions, reports, enumerators — no billing. Viewer: read-only access to submissions and reports, no team or settings. Observer: reports and summary dashboards only — ideal for clients who just need to follow progress." },
      { label: "How do I invite a client?", message: "Click 'Invite Member', enter their email, and set their role to Observer. They'll receive an email with a login link. They'll see a simplified view with only reports and dashboards — none of your raw data or enumerator details." },
    ],
  },
  security: {
    short: "Enable 2FA for your whole organisation if you're handling sensitive data. Session timeout of 8 hours is a reasonable default — shorter for higher-security contexts.",
    chips: [],
  },
  integrations: {
    short: "KoboToolbox sends submissions here via webhook. If submissions aren't arriving, check that your REST Service URL is correct and that 'Send all attachments' is enabled in KoboToolbox.",
    chips: [
      { label: "Why aren't my submissions arriving?", message: "Most common causes: (1) The webhook URL in KoboToolbox doesn't match the one here — copy it exactly from the Integrations page. (2) KoboToolbox 'Send all attachments' is disabled — go to Form Settings → REST Services → edit the service → enable 'Send all form data'. (3) Your KoboToolbox account is on a slow plan with delayed webhook delivery. Try submitting a test response and waiting 2 minutes." },
    ],
  },
};

export default function SettingsPage() {
  const location = useLocation();
  const [active, setActive] = useState(() => (location.state as any)?.section || "organization");
  const [adaDismissed, setAdaDismissed] = useState(false);
  const { setOpen, store: adaStore, addMessage, setState } = useAda();
  const lastCmdSeq = useRef<number | null>(null);
  const prevSection = useRef<string | null>(null);

  // Fire a section-specific Ada greeting in the chat whenever the section changes
  useEffect(() => {
    if (prevSection.current === active) return;
    prevSection.current = active;
    setAdaDismissed(false);
    const hint = SECTION_ADA_HINTS[active];
    if (!hint) return;
    const t = setTimeout(() => {
      setState("thinking");
      setTimeout(() => {
        setState("speaking");
        addMessage({ id: Date.now().toString(), role: "assistant", content: hint.short, timestamp: new Date().toISOString(), page: `settings-${active}` });
        setTimeout(() => setState("idle"), 4000);
      }, 500);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const s = (location.state as any)?.section;
    if (s) setActive(s);
  }, [location.state]);

  // Respond to Ada OPEN_SETTINGS_SECTION commands
  useEffect(() => {
    const cmd = adaStore.command;
    if (!cmd || cmd.type !== 'OPEN_SETTINGS_SECTION') return;
    if (lastCmdSeq.current === (cmd as any).seq) return;
    lastCmdSeq.current = (cmd as any).seq;
    setActive(cmd.section);
  }, [adaStore.command]);

  // Respond to Ada ada:change_setting events — write key into engine config
  useEffect(() => {
    const ENGINE_KEYS: Record<string, string[]> = {
      passScoreThreshold: ['passThreshold'],
      flagScoreThreshold: ['flagThreshold'],
      minDurationMins: ['minDurationMins'],
      maxDurationMins: ['maxDurationMins'],
      gpsToleranceMeters: ['gpsToleranceMeters'],
      weight_gps: ['weights', 'gps'],
      weight_duration: ['weights', 'duration'],
      weight_image: ['weights', 'image'],
      weight_audio: ['weights', 'audio'],
      weight_duplicate: ['weights', 'duplicate'],
    };
    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail;
      const path = ENGINE_KEYS[key];
      if (!path) return;
      const current = loadEngineConfig();
      if (path.length === 1) {
        (current as any)[path[0]] = value;
      } else if (path.length === 2) {
        (current as any)[path[0]] = { ...(current as any)[path[0]], [path[1]]: value };
      }
      saveEngineConfig(current);
    };
    window.addEventListener('ada:change_setting', handler);
    return () => window.removeEventListener('ada:change_setting', handler);
  }, []);

  const seenGroups = new Set<string>();
  const sectionGroups: string[] = [];
  SECTIONS.forEach(s => { if (!seenGroups.has(s.group)) { seenGroups.add(s.group); sectionGroups.push(s.group); } });

  const meta = SECTION_META[active] || { title: "", description: "" };
  const SectionComponent = SECTION_COMPONENTS[active];

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "100%", fontFamily: "Inter,sans-serif" }}>
      <div style={{ width: 210, flexShrink: 0, paddingRight: 20 }}>
        {sectionGroups.map(group => (
          <div key={group} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{group}</div>
            {SECTIONS.filter(s => s.group === group).map(s => {
              const isActive = s.id === active;
              return (
                <button key={s.id} onClick={() => setActive(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 8, marginBottom: 1, background: isActive ? "#EFF6FF" : "transparent", border: "none", cursor: "pointer", color: isActive ? BLUE : "#6B7280", fontSize: 12.5, fontWeight: isActive ? 600 : 500, fontFamily: "Inter,sans-serif", textAlign: "left", transition: "all .15s" }}>
                  <s.icon size={13} style={{ flexShrink: 0 }} />{s.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <AnimatePresence>
          {!adaDismissed && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} style={{ background: "linear-gradient(135deg,#1A1F3E,#0F172A)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div onClick={() => setOpen(true)} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0, cursor: "pointer", marginTop: 2 }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Send size={10} color="#93C5FD" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", textTransform: "uppercase", letterSpacing: 0.8 }}>Ada · AI Assistant</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", lineHeight: 1.6, marginBottom: SECTION_ADA_HINTS[active]?.chips?.length ? 10 : 0 }}>
                  {SECTION_ADA_HINTS[active]?.short || "I can help you configure branding, set research defaults, and connect your tools. Ask me anything."}
                </div>
                {(SECTION_ADA_HINTS[active]?.chips?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {SECTION_ADA_HINTS[active].chips.map((chip, i) => (
                      <button key={i} onClick={() => {
                        setState("thinking");
                        setTimeout(() => {
                          setState("speaking");
                          addMessage({ id: Date.now().toString(), role: "assistant", content: chip.message, timestamp: new Date().toISOString(), page: `settings-${active}` });
                          setTimeout(() => setState("idle"), 5000);
                        }, 500);
                      }} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.75)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", transition: "all .15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.14)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)"; }}
                      >{chip.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setAdaDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.3)", padding: 4, flexShrink: 0 }}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingsHeader title={meta.title} description={meta.description} />

        <div key={active} data-settings-section={active}>
          {SectionComponent ? <SectionComponent /> : null}
        </div>
      </div>
    </div>
  );
}
