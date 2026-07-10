import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Layers, Users, Shield, Palette, Puzzle, Brain,
  FlaskConical, Database, Lock, Bell, CreditCard, Code2,
  ClipboardList, ChevronRight, Check, AlertTriangle, RefreshCw,
  Upload, Plus, Trash2, Eye, EyeOff, Copy, Zap, Globe,
  Download, ExternalLink, X, ShieldAlert, Cpu,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAda } from "../../ada/AdaContext";
import { orgAdminApi } from "../../services/api";
import { useNavigate as useNav } from "react-router-dom";

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
  const [name, setName] = useState("ResearchOS Demo Org");
  const [industry, setIndustry] = useState("Research & Consulting");
  const [country, setCountry] = useState("Nigeria");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [website, setWebsite] = useState("https://researchos.io");
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={save} style={BTN_PRIMARY}>{saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Changes"}</button>
        </div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Danger Zone">
          <div style={{ padding: 16, borderRadius: 10, border: "1px solid #FEE2E2", background: "#FFF5F5" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 4 }}>Delete Organisation</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>This will permanently delete your organisation and all data. This action cannot be undone.</div>
            <button style={{ ...BTN_GHOST, color: RED, borderColor: "#FEE2E2", fontSize: 12 }}>Delete Organisation</button>
          </div>
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function WorkspaceSection() {
  const [wsName, setWsName] = useState("Lagos Retail Audit");
  const [desc, setDesc] = useState("Primary workspace for Q3 2025 fieldwork");
  const [lang, setLang] = useState("English");
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
      {[{ name: "Lagos Retail Audit", subs: 18, status: "active" },{ name: "Abuja Healthcare Survey", subs: 0, status: "draft" }].map(p => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #EEF2F8", marginBottom: 8 }}>
          <div style={{ fontSize: 18 }}>📂</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.subs} submissions</div></div>
          <Badge label={p.status} color={p.status === "active" ? GREEN : AMBER} />
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={BTN_PRIMARY}>Save Workspace</button></div>
    </SettingsCard>
  );
}

interface MockUser { id: string; name: string; email: string; role: string; status: string; last: string; }
const MOCK_USERS: MockUser[] = [
  { id: "1", name: "Bibzi Adeoyeleke", email: "bibiladeoyeleke@gmail.com", role: "Admin", status: "active", last: "Just now" },
  { id: "2", name: "Amara Okafor", email: "amara@researchos.io", role: "Manager", status: "active", last: "2h ago" },
  { id: "3", name: "Chidi Eze", email: "chidi@researchos.io", role: "Viewer", status: "invited", last: "Never" },
];

function UsersSection() {
  const [users] = useState<MockUser[]>(MOCK_USERS);
  const [invite, setInvite] = useState("");
  return (
    <SettingsCard style={{ padding: 24 }}>
      <SettingsHeader title="" description="" action={
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...INPUT, width: 220 }} placeholder="Invite by email" value={invite} onChange={e => setInvite(e.target.value)} />
          <button style={BTN_PRIMARY}><Plus size={13} style={{ marginRight: 4 }} />Invite</button>
        </div>
      } />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["Name","Email","Role","Status","Last Active",""].map(h => <th key={h} style={{ ...LABEL, textAlign: "left", padding: "0 0 10px", borderBottom: "1px solid #F1F5F9" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #F8FAFF" }}>
              <td style={{ padding: "12px 0", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#2463EB,#7C3AED)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "white" }}>{u.name.charAt(0)}</div>
                  {u.name}
                </div>
              </td>
              <td style={{ padding: "12px 8px", fontSize: 12.5, color: "#6B7280" }}>{u.email}</td>
              <td style={{ padding: "12px 8px" }}>
                <select style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #E2E8F0", color: "#374151", fontFamily: "Inter,sans-serif" }} defaultValue={u.role}>
                  {["Admin","Manager","Viewer"].map(r => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td style={{ padding: "12px 8px" }}><Badge label={u.status} color={u.status === "active" ? GREEN : AMBER} /></td>
              <td style={{ padding: "12px 8px", fontSize: 11.5, color: "#9CA3AF" }}>{u.last}</td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}><button style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  );
}

function RolesSection() {
  const roles = ["Admin", "Manager", "Viewer"];
  const permissions = [
    { group: "Submissions", items: ["View Submissions","Flag Submissions","Delete Submissions","Export Submissions"] },
    { group: "Reports", items: ["View Reports","Generate Reports","Download Reports","Share Reports"] },
    { group: "Enumerators", items: ["View Enumerators","Manage Enumerators","Assign Enumerators"] },
    { group: "Settings", items: ["View Settings","Edit Settings","Manage Users","Manage Billing"] },
    { group: "AI & Ada", items: ["Use Ada Chat","View AI Reports","Configure Ada"] },
  ];
  const defaults: Record<string, Record<string, boolean>> = {
    "View Submissions":{Admin:true,Manager:true,Viewer:true},"Flag Submissions":{Admin:true,Manager:true,Viewer:false},
    "Delete Submissions":{Admin:true,Manager:false,Viewer:false},"Export Submissions":{Admin:true,Manager:true,Viewer:false},
    "View Reports":{Admin:true,Manager:true,Viewer:true},"Generate Reports":{Admin:true,Manager:true,Viewer:false},
    "Download Reports":{Admin:true,Manager:true,Viewer:true},"Share Reports":{Admin:true,Manager:true,Viewer:false},
    "View Enumerators":{Admin:true,Manager:true,Viewer:true},"Manage Enumerators":{Admin:true,Manager:true,Viewer:false},
    "Assign Enumerators":{Admin:true,Manager:true,Viewer:false},"View Settings":{Admin:true,Manager:true,Viewer:false},
    "Edit Settings":{Admin:true,Manager:false,Viewer:false},"Manage Users":{Admin:true,Manager:false,Viewer:false},
    "Manage Billing":{Admin:true,Manager:false,Viewer:false},"Use Ada Chat":{Admin:true,Manager:true,Viewer:true},
    "View AI Reports":{Admin:true,Manager:true,Viewer:true},"Configure Ada":{Admin:true,Manager:false,Viewer:false},
  };
  return (
    <SettingsCard style={{ padding: 24, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
        <thead>
          <tr>
            <th style={{ ...LABEL, textAlign: "left", padding: "0 0 12px", width: "50%" }}>Permission</th>
            {roles.map(r => <th key={r} style={{ ...LABEL, textAlign: "center", padding: "0 0 12px" }}>{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {permissions.map(g => (
            <React.Fragment key={g.group}>
              <tr><td colSpan={4} style={{ padding: "16px 0 6px" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.8 }}>{g.group}</span></td></tr>
              {g.items.map(item => (
                <tr key={item} style={{ borderBottom: "1px solid #F8FAFF" }}>
                  <td style={{ padding: "10px 0", fontSize: 13, color: "#374151" }}>{item}</td>
                  {roles.map(r => <td key={r} style={{ textAlign: "center", padding: "10px 0" }}>{defaults[item]?.[r] ? <Check size={14} color={GREEN} /> : <X size={14} color="#E2E8F0" />}</td>)}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, padding: "10px 14px", background: "#F0F7FF", borderRadius: 8, fontSize: 12, color: "#3B82F6" }}>Custom role editor coming in Enterprise plan.</div>
    </SettingsCard>
  );
}

function BrandingSection() {
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
              <div style={{ width: 100, height: 100, borderRadius: 14, border: "2px dashed #E2E8F0", display: "grid", placeItems: "center", background: "#F8FAFF", cursor: "pointer" }}>
                <div style={{ textAlign: "center" }}><Upload size={20} color="#CBD5E1" /><div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>Upload</div></div>
              </div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 6 }}>PNG, SVG · Max 2MB</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SettingsField label="Primary Colour">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" defaultValue="#2463EB" style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer", padding: 2 }} />
                    <input style={{ ...INPUT }} defaultValue="#2463EB" />
                  </div>
                </SettingsField>
                <SettingsField label="Accent Colour">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" defaultValue="#7C3AED" style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", cursor: "pointer", padding: 2 }} />
                    <input style={{ ...INPUT }} defaultValue="#7C3AED" />
                  </div>
                </SettingsField>
                <SettingsField label="Report Font">
                  <select style={{ ...INPUT }}>{["Inter","Helvetica Neue","Georgia","Calibri","Roboto","Open Sans"].map(f => <option key={f}>{f}</option>)}</select>
                </SettingsField>
                <SettingsField label="Report Footer"><input style={INPUT} defaultValue="Confidential · ResearchOS" /></SettingsField>
              </div>
            </div>
          </div>
        </SettingsGroup>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Report Templates">
          {templates.map(t => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: "1px solid #E8EDF5", background: "#F8FAFF" }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.label}</div><div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{t.hint}</div></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...BTN_GHOST, fontSize: 11.5, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}><Download size={12} /> Download</button>
                <label style={{ ...BTN_PRIMARY, fontSize: 11.5, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <Upload size={12} /> Upload<input type="file" accept={t.accepted} style={{ display: "none" }} />
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
  { id:"gdrive",name:"Google Drive",icon:"💾",category:"Storage",status:"connected",lastSync:"5 mins ago",health:98 },
  { id:"onedrive",name:"OneDrive",icon:"☁️",category:"Storage",status:"disconnected",lastSync:"Never",health:0 },
  { id:"dropbox",name:"Dropbox",icon:"📦",category:"Storage",status:"disconnected",lastSync:"Never",health:0 },
  { id:"slack",name:"Slack",icon:"💬",category:"Notifications",status:"connected",lastSync:"2h ago",health:100 },
  { id:"teams",name:"Microsoft Teams",icon:"🟦",category:"Notifications",status:"disconnected",lastSync:"Never",health:0 },
  { id:"powerbi",name:"Power BI",icon:"📊",category:"Analytics",status:"error",lastSync:"3d ago",health:12 },
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
  const model = "claude-sonnet-5";
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={BTN_PRIMARY}>Save Ada Settings</button></div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Memory & Context">
          <div style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Ada's Learned Context</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>Ada remembers your preferences, project context, and team patterns to provide better guidance over time.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...BTN_GHOST, fontSize: 11.5, padding: "6px 12px" }}>View Memory</button>
              <button style={{ ...BTN_GHOST, fontSize: 11.5, padding: "6px 12px", color: RED, borderColor: "#FEE2E2" }}>Clear Memory</button>
            </div>
          </div>
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function ResearchSection() {
  const [gps, setGps] = useState(50);
  const [dupThreshold, setDupThreshold] = useState(85);
  const [minDuration, setMinDuration] = useState(8);
  const [maxDuration, setMaxDuration] = useState(120);
  const [mediaRetention, setMediaRetention] = useState("90");
  const [passThreshold, setPassThreshold] = useState(70);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="FieldScore Defaults">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SettingsField label={`GPS Accuracy Tolerance: ${gps}m`} hint="Submissions outside this radius are flagged"><input type="range" min={10} max={500} value={gps} onChange={e => setGps(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Duplicate Detection Threshold: ${dupThreshold}%`} hint="Similarity score that triggers a duplicate flag"><input type="range" min={50} max={100} value={dupThreshold} onChange={e => setDupThreshold(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Min Interview Duration: ${minDuration} mins`} hint="Submissions below this are flagged as too fast"><input type="range" min={1} max={60} value={minDuration} onChange={e => setMinDuration(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Max Interview Duration: ${maxDuration} mins`} hint="Submissions above this are flagged as too slow"><input type="range" min={30} max={360} value={maxDuration} onChange={e => setMaxDuration(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
            <SettingsField label={`Pass Score Threshold: ${passThreshold}/100`} hint="Minimum score for a PASS verdict"><input type="range" min={0} max={100} value={passThreshold} onChange={e => setPassThreshold(Number(e.target.value))} style={{ width: "100%" }} /></SettingsField>
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={BTN_PRIMARY}>Save Research Defaults</button></div>
      </SettingsCard>
    </div>
  );
}

function StorageSection() {
  const usedGB = 2.4; const totalGB = 10; const pct = (usedGB / totalGB) * 100;
  const breakdown = [
    { label: "Media (Audio/Video)", gb: 1.8, color: BLUE },
    { label: "Reports & Documents", gb: 0.4, color: PURPLE },
    { label: "AI Processing Outputs", gb: 0.15, color: GREEN },
    { label: "System & Logs", gb: 0.05, color: AMBER },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Storage Overview">
          <div style={{ padding: "20px 24px", background: "#F8FAFF", borderRadius: 12, border: "1px solid #EEF2F8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{usedGB} GB used</span><span style={{ fontSize: 13, color: "#9CA3AF" }}>{totalGB} GB total</span></div>
            <div style={{ height: 8, background: "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} style={{ height: "100%", background: `linear-gradient(to right, ${BLUE}, ${PURPLE})`, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>{(totalGB - usedGB).toFixed(1)} GB available</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: "#374151" }}>{b.label}</div>
                <div style={{ flex: 2, height: 4, background: "#EEF2F8", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(b.gb / totalGB) * 100}%` }} transition={{ duration: 1, delay: 0.2 }} style={{ height: "100%", background: b.color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", width: 48, textAlign: "right" }}>{b.gb} GB</div>
              </div>
            ))}
          </div>
        </SettingsGroup>
        <SectionDivider label="Retention Policy" />
        <SettingsGroup>
          <Toggle value={true} onChange={() => {}} label="Auto-delete Raw Audio after 90 days" description="Audio files are deleted after analysis is complete" />
          <Toggle value={false} onChange={() => {}} label="Archive submissions older than 12 months" description="Move to cold storage to reduce active storage usage" />
          <Toggle value={true} onChange={() => {}} label="Keep AI outputs indefinitely" description="Insight reports and analysis are never auto-deleted" />
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function SecuritySection() {
  const [twoFa, setTwoFa] = useState(false);
  const [sso, setSso] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("8h");
  const [ipRestrict, setIpRestrict] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Authentication">
          <Toggle value={twoFa} onChange={setTwoFa} label="Two-Factor Authentication" description="Require 2FA for all users in this organisation" />
          <Toggle value={sso} onChange={setSso} label="Single Sign-On (SSO)" description="Enterprise plan required · Connect via SAML or OIDC" />
        </SettingsGroup>
        <SectionDivider label="Session Management" />
        <SettingsGroup>
          <SettingsField label="Session Timeout">
            <select style={{ ...INPUT }} value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}>
              {[["1h","1 hour"],["4h","4 hours"],["8h","8 hours"],["24h","24 hours"],["7d","7 days"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </SettingsField>
          <Toggle value={ipRestrict} onChange={setIpRestrict} label="IP Restriction" description="Only allow logins from specified IP ranges (Enterprise)" />
        </SettingsGroup>
        <SectionDivider label="Active Sessions" />
        {[{device:"Chrome · macOS",location:"Lagos, Nigeria",active:true,time:"Now"},{device:"Safari · iPhone",location:"Lagos, Nigeria",active:false,time:"2h ago"}].map((s,i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #EEF2F8", marginBottom: 8 }}>
            <Globe size={16} color="#9CA3AF" />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.device}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.location} · {s.time}</div></div>
            {s.active ? <Badge label="Current" color={GREEN} /> : <button style={{ ...BTN_GHOST, fontSize: 11, padding: "4px 10px", color: RED, borderColor: "#FEE2E2" }}>Revoke</button>}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={BTN_PRIMARY}>Save Security Settings</button></div>
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
  const [prefs, setPrefs] = useState<Record<string,Record<string,boolean>>>(() => {
    const init: Record<string,Record<string,boolean>> = {};
    events.forEach(e => { init[e.label] = {email:true,slack:false,inapp:true}; });
    return init;
  });
  const toggle = (event: string, channel: string) => {
    setPrefs(p => ({...p,[event]:{...p[event],[channel]:!p[event][channel]}}));
  };
  return (
    <SettingsCard style={{ padding: 24, overflowX: "auto" }}>
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={BTN_PRIMARY}>Save Notifications</button></div>
    </SettingsCard>
  );
}

// ─── Billing mock data ────────────────────────────────────────────────────────
const MOCK_BILLING = {
  plan: "Professional",
  status: "active" as "active" | "trial" | "expired",
  cycle_start: "2026-07-01",
  cycle_end: "2026-07-31",
  days_remaining: 24,
  days_total: 31,
  currency: "NGN" as "NGN" | "USD",
  monthly_price: 350000,
  next_billing: "2026-08-01",
  capacity: [
    { key: "fieldscore",     label: "FieldScore Verifications",      icon: "🔍", used: 347, total: 2000, color: "#2463EB" },
    { key: "insightscore",   label: "Qualitative Interviews Analysed",icon: "💬", used: 12,  total: 200,  color: "#7C3AED" },
    { key: "reports",        label: "Executive Reports Generated",    icon: "📄", used: 3,   total: 20,   color: "#059669" },
    { key: "presentations",  label: "PowerPoint Presentations",       icon: "📊", used: 1,   total: 10,   color: "#D97706" },
    { key: "questionnaires", label: "Questionnaires Generated",       icon: "📋", used: 0,   total: 5,    color: "#06B6D4" },
  ],
  intelligence_credits: { used: 1240, total: 5000, label: "Research Intelligence Credits" },
  credits_breakdown: [
    { label: "FieldScore AI scoring",    value: 890,  color: "#2463EB" },
    { label: "InsightScore analysis",    value: 280,  color: "#7C3AED" },
    { label: "Report generation",        value: 70,   color: "#059669" },
  ],
  usage_history: [
    { month: "May",  fieldscore: 210, insightscore: 8,  reports: 2 },
    { month: "Jun",  fieldscore: 290, insightscore: 10, reports: 3 },
    { month: "Jul",  fieldscore: 347, insightscore: 12, reports: 3 },
  ],
  invoice_history: [
    { date: "2026-07-01", amount: 350000, status: "paid", ref: "INV-2026-007" },
    { date: "2026-06-01", amount: 350000, status: "paid", ref: "INV-2026-006" },
    { date: "2026-05-01", amount: 350000, status: "paid", ref: "INV-2026-005" },
  ],
};

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

// ─── Animated capacity bar ────────────────────────────────────────────────────
function CapacityBar({ pct, color, animate: shouldAnimate }: { pct: number; color: string; animate: boolean }) {
  return (
    <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: shouldAnimate ? `${pct}%` : 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        style={{ height: "100%", background: color, borderRadius: 3 }}
      />
    </div>
  );
}

// ─── Cycle ring ───────────────────────────────────────────────────────────────
function CycleRing({ used, total }: { used: number; total: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = used / total;
  return (
    <svg width={108} height={108} viewBox="0 0 108 108">
      <circle cx={54} cy={54} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={8} />
      <motion.circle
        cx={54} cy={54} r={r} fill="none"
        stroke="#2463EB" strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        transform="rotate(-90 54 54)"
      />
      <text x={54} y={50} textAnchor="middle" fill="white" fontSize={20} fontWeight={800} fontFamily="Inter,sans-serif">{total - used}</text>
      <text x={54} y={66} textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize={9} fontFamily="Inter,sans-serif">DAYS LEFT</text>
    </svg>
  );
}

// ─── Toast helper ─────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); };
  return { msg, show };
}

// ─── BillingSection ───────────────────────────────────────────────────────────
function BillingSection() {
  const { addMessage, setState } = useAda();
  const [currency, setCurrency] = useState<"NGN" | "USD">(MOCK_BILLING.currency);
  const [barsReady, setBarsReady] = useState(false);
  const toast = useToast();

  const B = MOCK_BILLING;
  const rate = 1600;
  const fmt = (n: number) => currency === "NGN"
    ? `₦${n.toLocaleString()}`
    : `$${(n / rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const statusColor = B.status === "active" ? GREEN : B.status === "trial" ? AMBER : RED;
  const statusLabel = B.status === "active" ? "Active" : B.status === "trial" ? "Trial" : "Expired";

  const primaryUsagePct = Math.round((B.capacity[0].used / B.capacity[0].total) * 100);
  const adaMsg =
    primaryUsagePct < 50
      ? `You're in great shape this month. ${B.capacity[0].used.toLocaleString()} of your ${B.capacity[0].total.toLocaleString()} verifications used. Plenty of capacity for your current projects.`
      : primaryUsagePct < 80
      ? `You've used about half your monthly capacity. If you have more fieldwork planned this month, you may want to keep an eye on your FieldScore verifications.`
      : `You're approaching your monthly limit on FieldScore verifications. I'd recommend reviewing your remaining projects or considering an upgrade before your cycle resets.`;

  useEffect(() => {
    const t = setTimeout(() => {
      setState("thinking");
      setTimeout(() => {
        setState("speaking");
        addMessage({ id: Date.now().toString(), role: "assistant", content: adaMsg, timestamp: new Date().toISOString(), page: "settings-billing" });
        setTimeout(() => setState("idle"), 4000);
      }, 600);
    }, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setTimeout(() => setBarsReady(true), 200); return () => clearTimeout(t); }, []);

  const handleDownload = () => toast.show("Invoice download coming soon.");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Toast */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "#111827", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Currency toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>Currency:</span>
        {(["NGN", "USD"] as const).map(c => (
          <button key={c} onClick={() => setCurrency(c)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: currency === c ? BLUE : "white", color: currency === c ? "white" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", transition: "all .15s" }}>
            {c === "NGN" ? "₦ NGN" : "$ USD"}
          </button>
        ))}
        {currency === "USD" && <span style={{ fontSize: 10.5, color: "#9CA3AF" }}>≈ ₦1,600/$1</span>}
      </div>

      {/* Plan hero */}
      <div style={{ background: "linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)", borderRadius: 18, padding: 28, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "radial-gradient(circle,rgba(36,99,235,.25) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 20 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Current Plan</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "white", letterSpacing: -1 }}>{B.plan}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: `${statusColor}28`, color: statusColor, border: `1px solid ${statusColor}40` }}>{statusLabel}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: -0.5, marginBottom: 4 }}>{fmt(B.monthly_price)}<span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,.4)" }}>/month</span></div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.35)", marginBottom: 18 }}>Billed monthly · Cancel anytime</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 18 }}>Next billing: <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{B.next_billing}</span></div>
            <button style={{ ...BTN_PRIMARY, fontSize: 12.5, padding: "10px 20px", background: BLUE, boxShadow: "0 4px 14px rgba(36,99,235,.45)" }}>Upgrade Plan →</button>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, padding: "12px 14px", background: "rgba(255,255,255,.06)", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)" }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", lineHeight: 1.55 }}>
                "You're on track this month. At your current usage rate you'll have plenty of capacity remaining when this cycle resets."
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <CycleRing used={B.days_total - B.days_remaining} total={B.days_total} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textAlign: "center" }}>Resets {B.next_billing}</div>
          </div>
        </div>
      </div>

      {/* Capacity summary */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 4 }}>Research Capacity This Month</div>
          <div style={{ fontSize: 12.5, color: "#6B7280" }}>All limits reset on {B.next_billing}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${B.capacity.length},1fr)`, gap: 12, marginBottom: 20, overflowX: "auto" as const }}>
          {B.capacity.map(cap => {
            const pct = Math.round((cap.used / cap.total) * 100);
            return (
              <div key={cap.key} style={{ minWidth: 110, padding: "12px 14px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{cap.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 6, lineHeight: 1.3 }}>{cap.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: -0.5, marginBottom: 2 }}>
                  <AnimatedNumber target={cap.used} /><span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>/{cap.total.toLocaleString()}</span>
                </div>
                <CapacityBar pct={pct} color={cap.color} animate={barsReady} />
                <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 4 }}>{pct}% used</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {B.capacity.map(cap => {
            const pct = Math.round((cap.used / cap.total) * 100);
            const remaining = cap.total - cap.used;
            const isWarn = pct >= 80 && pct < 95;
            const isCrit = pct >= 95;
            const borderColor = isCrit ? RED : isWarn ? AMBER : "#EEF2F8";
            const bgColor = isCrit ? "#FEF2F2" : isWarn ? "#FFFBEB" : "#F8FAFF";
            return (
              <motion.div key={cap.key}
                animate={isWarn ? { boxShadow: ["0 0 0 0 rgba(217,119,6,.15)", "0 0 0 4px rgba(217,119,6,.05)", "0 0 0 0 rgba(217,119,6,.15)"] } : {}}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{ padding: "14px 16px", background: bgColor, borderRadius: 10, border: `1px solid ${borderColor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{cap.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{cap.label}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{remaining.toLocaleString()} remaining</div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: -0.5 }}><AnimatedNumber target={cap.used} /><span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF" }}>/{cap.total.toLocaleString()}</span></div>
                    <div style={{ fontSize: 10.5, color: pct >= 80 ? (isCrit ? RED : AMBER) : "#9CA3AF", fontWeight: pct >= 80 ? 700 : 400 }}>{pct}%</div>
                  </div>
                </div>
                <CapacityBar pct={pct} color={cap.color} animate={barsReady} />
                {isWarn && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11.5, color: AMBER, fontWeight: 600 }}><AlertTriangle size={12} /> Approaching limit — monitor usage</div>}
                {isCrit && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11.5, color: RED, fontWeight: 600 }}><AlertTriangle size={12} /> Limit critical — contact us to upgrade</div>}
              </motion.div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Intelligence Credits */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 4 }}>Research Intelligence Credits</div>
            <div style={{ fontSize: 12.5, color: "#6B7280" }}>Used across all AI-powered features — verifications, analysis, reports</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>
              <AnimatedNumber target={B.intelligence_credits.used} />
              <span style={{ fontSize: 13, fontWeight: 400, color: "#9CA3AF" }}>/{B.intelligence_credits.total.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{Math.round((B.intelligence_credits.used / B.intelligence_credits.total) * 100)}% used</div>
          </div>
        </div>
        <div style={{ height: 12, background: "#F1F5F9", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: barsReady ? `${Math.round((B.intelligence_credits.used / B.intelligence_credits.total) * 100)}%` : 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            style={{ height: "100%", background: "linear-gradient(90deg,#2463EB,#7C3AED)", borderRadius: 6 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {B.credits_breakdown.map(row => {
            const pct = Math.round((row.value / B.intelligence_credits.total) * 100);
            return (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{row.value.toLocaleString()} credits</div>
                </div>
                <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: barsReady ? `${pct}%` : 0 }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                    style={{ height: "100%", background: row.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={11} /> Credits replenish each Research Cycle
        </div>
      </SettingsCard>

      {/* Usage Trend */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 4 }}>Monthly Usage History</div>
        <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 20 }}>Last 3 research cycles</div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          {[{ label: "FieldScore", color: "#2463EB" }, { label: "InsightScore", color: "#7C3AED" }, { label: "Reports", color: "#059669" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B7280" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />{l.label}
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={B.usage_history} barCategoryGap="30%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E8EDF5", fontSize: 12, fontFamily: "Inter,sans-serif" }} />
            <Bar dataKey="fieldscore"   name="FieldScore"   fill="#2463EB" radius={[4,4,0,0]} />
            <Bar dataKey="insightscore" name="InsightScore" fill="#7C3AED" radius={[4,4,0,0]} />
            <Bar dataKey="reports"      name="Reports"      fill="#059669" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </SettingsCard>

      {/* Invoice History */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 16 }}>Invoice History</div>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                {["Date", "Reference", "Amount", "Status", ""].map(h => (
                  <th key={h} style={{ ...LABEL, padding: "0 12px 10px", textAlign: "left" as const, whiteSpace: "nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {B.invoice_history.map(inv => (
                <tr key={inv.ref} style={{ borderBottom: "1px solid #F8FAFF" }}>
                  <td style={{ padding: "12px", color: "#374151" }}>{inv.date}</td>
                  <td style={{ padding: "12px", color: "#374151", fontFamily: "monospace", fontSize: 11.5 }}>{inv.ref}</td>
                  <td style={{ padding: "12px", color: "#111827", fontWeight: 700 }}>{fmt(inv.amount)}</td>
                  <td style={{ padding: "12px" }}><Badge label="✅ Paid" color={GREEN} /></td>
                  <td style={{ padding: "12px" }}>
                    <button onClick={handleDownload} style={{ ...BTN_GHOST, fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                      <Download size={11} /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {/* Upgrade path */}
      {(B.status === "trial" || B.plan === "Starter") && (
        <SettingsCard style={{ padding: 24, border: `1px solid ${BLUE}30`, background: "#F8FBFF" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", letterSpacing: -0.4, marginBottom: 6 }}>Ready to grow? 🚀</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 18 }}>Upgrade to Professional for more capacity and priority support.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="mailto:bibilade@intelligencyai.com.ng" style={{ ...BTN_GHOST, fontSize: 12.5, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>Talk to Sales</a>
            <button style={{ ...BTN_PRIMARY, fontSize: 12.5 }}>Start Upgrade</button>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

function ApiSection() {
  const [showKey, setShowKey] = useState(false);
  const mockKey = "rsos_live_a8f3k2x9p1mq7w4n6j0d5e";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="API Keys">
          <div style={{ padding: "16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Production Key</div><Badge label="Active" color={GREEN} /></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value={showKey ? mockKey : "rsos_live_••••••••••••••••••"} style={{ ...INPUT, fontFamily: "monospace", fontSize: 12, color: "#374151", flex: 1 }} />
              <button onClick={() => setShowKey(!showKey)} style={{ ...BTN_GHOST, padding: "9px 12px" }}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              <button style={{ ...BTN_GHOST, padding: "9px 12px" }}><Copy size={14} /></button>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>Created 1 Jun 2025 · Last used 2h ago</div>
          </div>
          <button style={{ ...BTN_PRIMARY, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}><Plus size={13} /> Generate New Key</button>
        </SettingsGroup>
        <SectionDivider label="Webhooks" />
        <SettingsGroup>
          <div style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}><div style={{ fontSize: 12, fontFamily: "monospace", color: "#374151" }}>https://hooks.zapier.com/hooks/catch/...</div><Badge label="active" color={GREEN} /></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>{["submission.scored","report.ready"].map(e => <Badge key={e} label={e} color={BLUE} />)}</div>
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

interface AuditEvent { id: string; user: string; action: string; resource: string; detail: string; ip: string; time: string; severity: "info"|"warning"|"critical"; }
const AUDIT_EVENTS: AuditEvent[] = [
  {id:"1",user:"Bibzi A.",action:"LOGIN",resource:"Auth",detail:"Successful login",ip:"105.112.x.x",time:"2 mins ago",severity:"info"},
  {id:"2",user:"Bibzi A.",action:"EXPORT",resource:"Submissions",detail:"Exported 182 submissions to CSV",ip:"105.112.x.x",time:"1h ago",severity:"info"},
  {id:"3",user:"Amara O.",action:"UPDATE",resource:"Settings",detail:"Changed GPS tolerance from 100m to 50m",ip:"102.88.x.x",time:"3h ago",severity:"warning"},
  {id:"4",user:"System",action:"GENERATE",resource:"Report",detail:"Executive Summary generated by Ada",ip:"—",time:"5h ago",severity:"info"},
  {id:"5",user:"Bibzi A.",action:"INVITE",resource:"Users",detail:"Invited chidi@researchos.io as Viewer",ip:"105.112.x.x",time:"1d ago",severity:"info"},
  {id:"6",user:"System",action:"ERROR",resource:"Integration",detail:"Power BI sync failed — token expired",ip:"—",time:"3d ago",severity:"critical"},
  {id:"7",user:"Amara O.",action:"DELETE",resource:"Submission",detail:"Deleted submission SUB-0042 (duplicate)",ip:"102.88.x.x",time:"5d ago",severity:"warning"},
];

function AuditSection() {
  const [filter, setFilter] = useState("all");
  const severityColor = (s: string) => s === "critical" ? RED : s === "warning" ? AMBER : "#9CA3AF";
  const filtered = filter === "all" ? AUDIT_EVENTS : AUDIT_EVENTS.filter(e => e.severity === filter);
  return (
    <SettingsCard style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["all","info","warning","critical"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${filter === f ? BLUE : "#E2E8F0"}`, background: filter === f ? "#EFF6FF" : "white", color: filter === f ? BLUE : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", textTransform: "capitalize" as const }}>{f}</button>
          ))}
        </div>
        <button style={{ ...BTN_GHOST, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Download size={12} /> Export Audit Log</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {filtered.map((ev, i) => (
          <div key={ev.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < filtered.length - 1 ? "1px solid #F8FAFF" : "none" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: severityColor(ev.severity), marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", padding: "1px 6px", borderRadius: 4, background: "#F1F5F9", color: "#374151" }}>{ev.action}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ev.resource}</span>
                <span style={{ fontSize: 12, color: "#6B7280" }}>by {ev.user}</span>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>{ev.detail}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{ev.time}</div>
              <div style={{ fontSize: 10.5, color: "#CBD5E1", marginTop: 2 }}>{ev.ip}</div>
            </div>
            {ev.severity !== "info" && <AlertTriangle size={13} color={severityColor(ev.severity)} style={{ flexShrink: 0, marginTop: 4 }} />}
          </div>
        ))}
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
type EnabledMap = { gps:boolean; duration:boolean; image:boolean; audio:boolean; duplicate:boolean; text_ai:boolean; };

const DEFAULT_WEIGHTS: WeightMap = { gps:0.25, duration:0.22, image:0.20, audio:0.13, duplicate:0.10, text_ai:0.10 };
const DEFAULT_GATING: GatingMap = {
  gps_reject_skips: ["image","audio"],
  duration_reject_skips: [],
  duplicate_reject_skips: ["audio","text_ai"],
};
const DEFAULT_ENABLED: EnabledMap = { gps:true, duration:true, image:true, audio:true, duplicate:true, text_ai:true };

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
  const [weights, setWeights] = useState<WeightMap>({ ...DEFAULT_WEIGHTS });
  const [gating, setGating] = useState<GatingMap>({ ...DEFAULT_GATING, gps_reject_skips: [...DEFAULT_GATING.gps_reject_skips], duration_reject_skips: [...DEFAULT_GATING.duration_reject_skips], duplicate_reject_skips: [...DEFAULT_GATING.duplicate_reject_skips] });
  const [enabled, setEnabled] = useState<EnabledMap>({ ...DEFAULT_ENABLED });
  const [aiHighPenalty, setAiHighPenalty] = useState(55);
  const [aiMediumPenalty, setAiMediumPenalty] = useState(20);
  const [aiMediumFlag, setAiMediumFlag] = useState(true);
  const [saved, setSaved] = useState(false);

  const totalW = ENGINE_ORDER.reduce((s, k) => s + (enabled[k as keyof EnabledMap] ? weights[k as keyof WeightMap] : 0), 0);

  const toggleGate = (gate: keyof GatingMap, engine: string) => {
    setGating(prev => {
      const arr = prev[gate];
      return { ...prev, [gate]: arr.includes(engine) ? arr.filter(e => e !== engine) : [...arr, engine] };
    });
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setState("thinking");
    setTimeout(() => {
      setState("speaking");
      const active = ENGINE_ORDER.filter(k => enabled[k as keyof EnabledMap]);
      addMessage({ id: Date.now().toString(), role: "assistant", content: `Engine config saved. You have ${active.length} active engines with GPS carrying the most weight (${Math.round((weights.gps / totalW) * 100)}% after normalisation). Gating is set up so a GPS reject skips ${gating.gps_reject_skips.length > 0 ? gating.gps_reject_skips.join(" and ") : "nothing"} — that saves processing time and avoids penalising real submissions twice. AI detection is set to HIGH = ${aiHighPenalty} point penalty, MEDIUM = ${aiMediumPenalty} points${aiMediumFlag ? " + flag for review" : ", no flag"}. These settings apply to all new submissions scored from now.`, timestamp: new Date().toISOString(), page: "settings-engine" });
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
          Each active engine contributes to the final FieldScore out of 100. Weights are normalised automatically, so the relative balance is what matters — not the exact total. GPS and Duration carry the most weight by default because they are the hardest to fake.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ENGINE_ORDER.map(key => {
            const k = key as keyof WeightMap;
            const meta = ENGINE_LABELS[key];
            const w = weights[k];
            const pct = totalW > 0 ? Math.round((w / totalW) * 100) : 0;
            const isEnabled = enabled[k as keyof EnabledMap];
            return (
              <div key={key} style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${isEnabled ? "#EEF2F8" : "#F1F5F9"}`, background: isEnabled ? "#F8FAFF" : "#FAFAFA", opacity: isEnabled ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isEnabled ? 10 : 0 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{meta.desc}</div>
                  </div>
                  {isEnabled && <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, minWidth: 36, textAlign: "right" }}>{pct}%</div>}
                  <button
                    onClick={() => setEnabled(prev => ({ ...prev, [k]: !prev[k as keyof EnabledMap] }))}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${isEnabled ? "#BFDBFE" : "#E2E8F0"}`, background: isEnabled ? "#EFF6FF" : "white", color: isEnabled ? BLUE : "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}
                  >
                    {isEnabled ? "On" : "Off"}
                  </button>
                </div>
                {isEnabled && (
                  <input
                    type="range" min={1} max={50} value={Math.round(w * 100)}
                    onChange={e => setWeights(prev => ({ ...prev, [k]: Number(e.target.value) / 100 }))}
                    style={{ width: "100%", accentColor: BLUE }}
                  />
                )}
              </div>
            );
          })}
        </div>
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

export default function SettingsPage() {
  const [active, setActive] = useState("organization");
  const [adaDismissed, setAdaDismissed] = useState(false);
  const { setOpen } = useAda();

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
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} style={{ background: "linear-gradient(135deg,#1A1F3E,#0F172A)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <div onClick={() => setOpen(true)} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0, cursor: "pointer" }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 2 }}>Let's make ResearchOS feel like your organisation.</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>I can help you configure branding, set research defaults, and connect your tools. Ask me anything.</div>
              </div>
              <button onClick={() => setAdaDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.3)", padding: 4 }}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingsHeader title={meta.title} description={meta.description} />

        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {SectionComponent ? <SectionComponent /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
