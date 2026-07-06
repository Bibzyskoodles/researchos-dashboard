import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Layers, Users, Shield, Palette, Puzzle, Brain,
  FlaskConical, Database, Lock, Bell, CreditCard, Code2,
  ClipboardList, ChevronRight, Check, AlertTriangle, RefreshCw,
  Upload, Plus, Trash2, Eye, EyeOff, Copy, Zap, Globe,
  Download, ExternalLink, X,
} from "lucide-react";
import { useAda } from "../../ada/AdaContext";

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
  { id: "storage",       icon: Database,     label: "Data & Storage",      group: "RESEARCH" },
  { id: "security",      icon: Lock,         label: "Security",            group: "SYSTEM" },
  { id: "notifications", icon: Bell,         label: "Notifications",       group: "SYSTEM" },
  { id: "billing",       icon: CreditCard,   label: "Billing",             group: "SYSTEM" },
  { id: "api",           icon: Code2,        label: "API & Webhooks",      group: "SYSTEM" },
  { id: "audit",         icon: ClipboardList,label: "Audit Log",           group: "SYSTEM" },
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

function BillingSection() {
  const plan = {name:"Professional",price:"$299/month",subs:500,users:10,storage:"10 GB"};
  const usage = {subs:182,users:3,storage:"2.4 GB"};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: -0.5 }}>{plan.name}</div><div style={{ fontSize: 13, color: "#9CA3AF" }}>{plan.price} · Renews 1 August 2025</div></div>
          <div style={{ display: "flex", gap: 8 }}><button style={{ ...BTN_GHOST, fontSize: 12 }}>Change Plan</button><button style={{ ...BTN_PRIMARY, fontSize: 12 }}>Upgrade to Enterprise</button></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[{label:"Submissions",used:usage.subs,total:plan.subs,noBar:false},{label:"Team Members",used:usage.users,total:plan.users,noBar:false},{label:"Storage",used:usage.storage,total:plan.storage,noBar:true}].map(m => (
            <div key={m.label} style={{ padding: "14px 16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
              <div style={{ ...LABEL, marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: -0.5 }}>{m.used}<span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF" }}>/{m.total}</span></div>
              {!m.noBar && <div style={{ height: 3, background: "#E2E8F0", borderRadius: 2, marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${(Number(m.used) / Number(m.total)) * 100}%`, background: BLUE, borderRadius: 2 }} /></div>}
            </div>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Recent Invoices">
          {[{date:"1 Jul 2025",amount:"$299.00",status:"paid"},{date:"1 Jun 2025",amount:"$299.00",status:"paid"},{date:"1 May 2025",amount:"$299.00",status:"paid"}].map(inv => (
            <div key={inv.date} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #EEF2F8" }}>
              <div style={{ fontSize: 18 }}>🧾</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{inv.amount}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{inv.date}</div></div>
              <Badge label={inv.status} color={GREEN} />
              <button style={{ ...BTN_GHOST, fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 4 }}><Download size={11} /> PDF</button>
            </div>
          ))}
        </SettingsGroup>
      </SettingsCard>
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

const SECTION_COMPONENTS: Record<string, React.FC> = {
  organization:OrgSection,workspace:WorkspaceSection,users:UsersSection,roles:RolesSection,
  branding:BrandingSection,integrations:IntegrationsSection,ada:AdaSection,research:ResearchSection,
  storage:StorageSection,security:SecuritySection,notifications:NotificationsSection,
  billing:BillingSection,api:ApiSection,audit:AuditSection,
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
  storage:{title:"Data & Storage",description:"Storage usage, breakdown, and retention policy"},
  security:{title:"Security",description:"Authentication, sessions, and access controls"},
  notifications:{title:"Notifications",description:"Configure when and how your team is notified"},
  billing:{title:"Billing",description:"Plan, usage, and invoice management"},
  api:{title:"API & Webhooks",description:"Programmatic access and real-time event integrations"},
  audit:{title:"Audit Log",description:"Full history of user and system activity in your organisation"},
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
