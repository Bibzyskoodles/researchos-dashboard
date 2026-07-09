import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Layers, Users, Shield, Palette, Puzzle, Brain,
  FlaskConical, Database, Lock, Bell, CreditCard, Code2,
  ClipboardList, ChevronRight, Check, AlertTriangle, RefreshCw,
  Upload, Plus, Trash2, Eye, EyeOff, Copy, Zap, Globe,
  Download, ExternalLink, X,
} from "lucide-react";
import { useAda } from "../../ada/AdaContext";
import { useIndustry } from "../../store/IndustryContext";
import { useAuth } from "../../store/AuthContext";
import { useSettings } from "../../store/SettingsContext";
import { authApi } from "../../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

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

function SaveRow({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
      <button onClick={save} style={BTN_PRIMARY}>
        {saved
          ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span>
          : label}
      </button>
    </div>
  );
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
  { id: "billing",       icon: CreditCard,   label: "Billing & Capacity",  group: "SYSTEM" },
  { id: "api",           icon: Code2,        label: "API & Webhooks",      group: "SYSTEM" },
  { id: "audit",         icon: ClipboardList,label: "Audit Log",           group: "SYSTEM" },
];

function OrgSection() {
  const { org } = useAuth();
  const [name, setName] = useState(org?.name || "");
  const { industry, setIndustry, INDUSTRIES } = useIndustry();
  const [country, setCountry] = useState("Nigeria");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [website, setWebsite] = useState("https://researchos.io");
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  // Seed the editable name from the real organisation once auth resolves.
  useEffect(() => { if (org?.name) setName(org.name); }, [org?.name]);
  const planLabel = org?.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="Organisation Details">
          {org && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12, color: "#6B7280" }}>
              {planLabel && <Badge label={`${planLabel} plan`} color={BLUE} />}
              {org.status && <Badge label={org.status} color={org.status === "active" ? GREEN : AMBER} />}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SettingsField label="Organisation Name"><input style={INPUT} value={name} onChange={e => setName(e.target.value)} /></SettingsField>
            <SettingsField label="Industry" hint="Adapts Ada's language and dashboard labels to your sector">
              <select style={{ ...INPUT }} value={industry} onChange={e => setIndustry(e.target.value as any)}>
                {INDUSTRIES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
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
            <button onClick={() => { if (window.confirm("Are you sure? This permanently deletes your organisation and cannot be undone.")) alert("Deletion requested — please contact support to complete this action."); }} style={{ ...BTN_GHOST, color: RED, borderColor: "#FEE2E2", fontSize: 12 }}>Delete Organisation</button>
          </div>
        </SettingsGroup>
      </SettingsCard>
    </div>
  );
}

function WorkspaceSection() {
  const { org } = useAuth();
  const { settings, changeSetting } = useSettings();
  const [wsName, setWsName] = useState(org?.name || "My Workspace");
  const [desc, setDesc] = useState("Primary workspace for Q3 2025 fieldwork");
  const lang = settings.language;
  const setLang = (v: string) => changeSetting('language', v);
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
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
      {[{ name: org?.name ? `${org.name} — Active Study` : "Active Study", subs: 18, status: "active" },{ name: "Draft Study", subs: 0, status: "draft" }].map(p => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #EEF2F8", marginBottom: 8 }}>
          <div style={{ fontSize: 18 }}>📂</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.subs} submissions</div></div>
          <Badge label={p.status} color={p.status === "active" ? GREEN : AMBER} />
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button onClick={save} style={BTN_PRIMARY}>{saved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Workspace"}</button></div>
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);
  const saveBrand = () => { setBrandSaved(true); setTimeout(() => setBrandSaved(false), 2000); };
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLogoUrl(URL.createObjectURL(file));
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
              <input ref={logoInputRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }} onChange={handleLogoFile} />
              <div onClick={() => logoInputRef.current?.click()} style={{ width: 100, height: 100, borderRadius: 14, border: "2px dashed #E2E8F0", display: "grid", placeItems: "center", background: "#F8FAFF", cursor: "pointer", overflow: "hidden" }}>
                {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ textAlign: "center" }}><Upload size={20} color="#CBD5E1" /><div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>Upload</div></div>}
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={saveBrand} style={BTN_PRIMARY}>{brandSaved ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Saved</span> : "Save Branding"}</button>
        </div>
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
  const { settings, changeSetting } = useSettings();
  const personality = settings.adaPersonality;
  const setPersonality = (v: string) => changeSetting('adaPersonality', v as any);
  const proactive = settings.adaProactive;
  const setProactive = (v: boolean) => changeSetting('adaProactive', v);
  const brief = settings.adaBrief;
  const setBrief = (v: boolean) => changeSetting('adaBrief', v);
  const guidance = settings.adaGuidance;
  const setGuidance = (v: boolean) => changeSetting('adaGuidance', v);
  const celebrations = settings.adaCelebrations;
  const setCelebrations = (v: boolean) => changeSetting('adaCelebrations', v);
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
        <SaveRow label="Save Ada Settings" />
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
  const { settings, changeSetting } = useSettings();
  const gps = settings.gpsAccuracy;
  const setGps = (v: number) => changeSetting('gpsAccuracy', v);
  const dupThreshold = settings.dupThreshold;
  const setDupThreshold = (v: number) => changeSetting('dupThreshold', v);
  const minDuration = settings.minDuration;
  const setMinDuration = (v: number) => changeSetting('minDuration', v);
  const maxDuration = settings.maxDuration;
  const setMaxDuration = (v: number) => changeSetting('maxDuration', v);
  const mediaRetention = settings.mediaRetention;
  const setMediaRetention = (v: string) => changeSetting('mediaRetention', v);
  const passThreshold = settings.passThreshold;
  const setPassThreshold = (v: number) => changeSetting('passThreshold', v);
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
        <SaveRow label="Save Research Defaults" />
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

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { setState: setAdaState } = useAda();

  const submit = async () => {
    setMsg(null);
    if (next.length < 8) { setMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: "New passwords do not match." }); return; }
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      setMsg({ ok: true, text: "Password updated successfully. Ada: your password has been updated — keep it safe." });
      setCurrent(""); setNext(""); setConfirm("");
      setAdaState("celebrating");
      setTimeout(() => setAdaState("idle"), 3000);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error || "Could not update password. Check your current password and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard style={{ padding: 24 }}>
      <SettingsGroup label="Change Password">
        <SettingsField label="Current Password">
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={INPUT} autoComplete="current-password" />
        </SettingsField>
        <SettingsField label="New Password" hint="At least 8 characters">
          <input type="password" value={next} onChange={e => setNext(e.target.value)} style={INPUT} autoComplete="new-password" />
        </SettingsField>
        <SettingsField label="Confirm New Password">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={INPUT} autoComplete="new-password" />
        </SettingsField>
        {msg && (
          <div style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: 8, background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? GREEN : RED, border: `1px solid ${msg.ok ? "#A7F3D0" : "#FECACA"}` }}>{msg.text}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={submit} disabled={busy || !current || !next || !confirm} style={{ ...BTN_PRIMARY, opacity: busy || !current || !next || !confirm ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Updating…" : "Update Password"}
          </button>
        </div>
      </SettingsGroup>
    </SettingsCard>
  );
}

function SecuritySection() {
  const { settings, changeSetting } = useSettings();
  const twoFa = settings.twoFa;
  const setTwoFa = (v: boolean) => changeSetting('twoFa', v);
  const sessionTimeout = settings.sessionTimeout;
  const setSessionTimeout = (v: string) => changeSetting('sessionTimeout', v);
  const [sso, setSso] = useState(false);
  const [ipRestrict, setIpRestrict] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ChangePasswordCard />
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
        <SaveRow label="Save Security Settings" />
      </SettingsCard>
    </div>
  );
}

function NotificationsSection() {
  const { settings, changeSetting } = useSettings();
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
  // Per-event prefs seeded from global channel toggles from Ada-controllable settings
  const [prefs, setPrefs] = useState<Record<string,Record<string,boolean>>>(() => {
    const init: Record<string,Record<string,boolean>> = {};
    events.forEach(e => { init[e.label] = {email:settings.notifyEmail,slack:settings.notifySlack,inapp:settings.notifyInApp}; });
    return init;
  });
  // When global channel settings change (e.g. Ada turned off Slack), sync all rows
  const prevEmail = useRef(settings.notifyEmail);
  const prevSlack = useRef(settings.notifySlack);
  const prevInApp = useRef(settings.notifyInApp);
  useEffect(() => {
    const emailChanged = prevEmail.current !== settings.notifyEmail;
    const slackChanged = prevSlack.current !== settings.notifySlack;
    const inAppChanged = prevInApp.current !== settings.notifyInApp;
    if (emailChanged || slackChanged || inAppChanged) {
      setPrefs(p => {
        const next = { ...p };
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key] };
          if (emailChanged) next[key].email = settings.notifyEmail;
          if (slackChanged) next[key].slack = settings.notifySlack;
          if (inAppChanged) next[key].inapp = settings.notifyInApp;
        }
        return next;
      });
      prevEmail.current = settings.notifyEmail;
      prevSlack.current = settings.notifySlack;
      prevInApp.current = settings.notifyInApp;
    }
  }, [settings.notifyEmail, settings.notifySlack, settings.notifyInApp]);

  const toggle = (event: string, channel: string) => {
    setPrefs(p => {
      const next = {...p,[event]:{...p[event],[channel]:!p[event][channel]}};
      // Keep global setting in sync if user manually toggles a channel column uniformly
      const allOff = Object.values(next).every(r => !r[channel]);
      const allOn = Object.values(next).every(r => r[channel]);
      if (channel === 'email' && (allOff || allOn)) changeSetting('notifyEmail', allOn);
      if (channel === 'slack' && (allOff || allOn)) changeSetting('notifySlack', allOn);
      if (channel === 'inapp' && (allOff || allOn)) changeSetting('notifyInApp', allOn);
      return next;
    });
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
      <SaveRow label="Save Notifications" />
    </SettingsCard>
  );
}

const MOCK_BILLING = {
  plan: "Professional" as string,
  status: "active" as string, // active | trial | expired
  days_used: 7, days_total: 31, days_remaining: 24,
  monthly_price_ngn: 350000, monthly_price_usd: 219,
  next_billing: "1 August 2026",
  capacity: [
    { key: "fieldscore", label: "FieldScore Verifications", description: "Surveys & interviews verified for quality", icon: "🔍", used: 347, total: 2000, color: "#2463EB" },
    { key: "insightscore", label: "Qualitative Interviews Analysed", description: "FGDs, IDIs, open-ended responses", icon: "💬", used: 12, total: 200, color: "#7C3AED" },
    { key: "reports", label: "Executive Reports Generated", description: "Word, PowerPoint & Excel reports", icon: "📄", used: 3, total: 20, color: "#059669" },
    { key: "presentations", label: "PowerPoint Presentations", description: "Board-ready presentations", icon: "📊", used: 1, total: 10, color: "#D97706" },
    { key: "questionnaires", label: "Questionnaires Generated", description: "AI-generated or AI-reviewed", icon: "📋", used: 0, total: 5, color: "#06B6D4" },
  ],
  intelligence_credits: {
    used: 1240, total: 5000, breakdown: [
      { label: "FieldScore AI scoring", value: 890, color: "#2463EB" },
      { label: "InsightScore analysis", value: 280, color: "#7C3AED" },
      { label: "Report generation", value: 70, color: "#059669" },
    ],
  },
  usage_history: [
    { month: "May", fieldscore: 180, insightscore: 5, reports: 1 },
    { month: "Jun", fieldscore: 290, insightscore: 8, reports: 2 },
    { month: "Jul", fieldscore: 347, insightscore: 12, reports: 3 },
  ],
  invoices: [
    { date: "2026-07-01", ref: "INV-2026-007", amount_ngn: 350000, amount_usd: 219, status: "paid" },
    { date: "2026-06-01", ref: "INV-2026-006", amount_ngn: 350000, amount_usd: 219, status: "paid" },
    { date: "2026-05-01", ref: "INV-2026-005", amount_ngn: 350000, amount_usd: 219, status: "paid" },
  ],
};

const NGN_PER_USD = 1600;
function money(ngn: number, currency: "NGN" | "USD") {
  return currency === "NGN" ? `₦${ngn.toLocaleString()}` : `$${Math.round(ngn / NGN_PER_USD).toLocaleString()}`;
}

function DaysRing({ remaining, total }: { remaining: number; total: number }) {
  const size = 120, stroke = 8, r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, remaining / total));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#60A5FA" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - frac * c }}
        transition={{ duration: 1, ease: "easeOut" }} />
    </svg>
  );
}

function CreditGauge({ used, total }: { used: number; total: number }) {
  const w = 220, h = 118, r = 92, cx = w / 2, cy = h - 8, stroke = 14;
  const len = Math.PI * r;
  const frac = Math.max(0, Math.min(1, used / total));
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width={w} height={h}>
      <path d={path} fill="none" stroke="#EEF2F8" strokeWidth={stroke} strokeLinecap="round" />
      <motion.path d={path} fill="none" stroke={BLUE} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={len} initial={{ strokeDashoffset: len }} animate={{ strokeDashoffset: len - frac * len }}
        transition={{ duration: 1.1, ease: "easeOut" }} />
      <text x={cx} y={cy - 28} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: "#080D1A", letterSpacing: -1 }}>{used.toLocaleString()}</text>
      <text x={cx} y={cy - 10} textAnchor="middle" style={{ fontSize: 11, fill: "#9CA3AF" }}>of {total.toLocaleString()} used</text>
    </svg>
  );
}

function BillingSection() {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [toast, setToast] = useState("");
  const b = MOCK_BILLING;
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const overallPct = Math.round((b.capacity.reduce((s, c) => s + c.used / c.total, 0) / b.capacity.length) * 100);
  const adaMsg = b.status === "trial"
    ? `You have ${b.days_remaining} days left on your trial. Your usage suggests the Professional plan would be a good fit.`
    : overallPct > 70
      ? "You're approaching your monthly limit on some metrics. Consider upgrading before your cycle resets."
      : overallPct >= 30
        ? "You've used about a third of your monthly capacity. You're on track for the month."
        : "You're in great shape. At your current rate you'll have plenty of capacity when this cycle resets.";
  const statusColor = b.status === "active" ? GREEN : b.status === "trial" ? AMBER : RED;
  const statusLabel = b.status === "active" ? "Active" : b.status === "trial" ? "Trial" : "Expired";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#1A1F3E", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.2)" }}>{toast}</div>}

      {/* Currency toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 20, padding: 3 }}>
          {(["NGN", "USD"] as const).map(cur => (
            <button key={cur} onClick={() => setCurrency(cur)} style={{ padding: "5px 14px", borderRadius: 18, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Inter,sans-serif", background: currency === cur ? "white" : "transparent", color: currency === cur ? "#080D1A" : "#9CA3AF", boxShadow: currency === cur ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
              {cur === "NGN" ? "₦ NGN" : "$ USD"}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1 — Plan overview */}
      <div style={{ background: "linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)", borderRadius: 16, padding: "24px 28px", color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Current plan</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{b.plan}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${statusColor}22`, color: statusColor }}>{statusLabel}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10, letterSpacing: -0.5 }}>{money(b.monthly_price_ngn, currency)}<span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,.5)" }}>/month</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Billed monthly · Cancel anytime</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Next billing: {b.next_billing}</div>
            {currency === "USD" && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)", marginTop: 6 }}>Converted at approx. ₦{NGN_PER_USD.toLocaleString()}/$1 · Rate may vary</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
              <DaysRing remaining={b.days_remaining} total={b.days_total} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{b.days_remaining}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 6 }}>days remaining in cycle</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)" }}>Resets {b.next_billing}</div>
            <button onClick={() => showToast("Plan upgrade flow coming soon")} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 8, background: BLUE, border: "none", color: "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Upgrade Plan →</button>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "flex-start", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "12px 14px" }}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)", lineHeight: 1.6 }}>{adaMsg}</div>
        </div>
      </div>

      {/* SECTION 2 — Capacity summary bar */}
      <div style={{ background: "#0F172A", borderRadius: 16, padding: "18px 20px", display: "grid", gridTemplateColumns: `repeat(${b.capacity.length},1fr)`, gap: 16 }}>
        {b.capacity.map(c => {
          const pct = Math.round((c.used / c.total) * 100);
          return (
            <div key={c.key} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16 }}>{c.icon}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", margin: "4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{c.used.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,.4)" }}> / {c.total.toLocaleString()}</span></div>
              <div style={{ height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2, margin: "6px 0 4px", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", background: c.color, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Detailed capacity cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        {b.capacity.map((c, i) => {
          const pct = Math.round((c.used / c.total) * 100);
          const remaining = c.total - c.used;
          const critical = pct > 95, warning = pct > 80 && !critical, unused = c.used === 0;
          const borderColor = critical ? RED : warning ? AMBER : "#E8EDF5";
          return (
            <div key={c.key} style={{ ...CARD, padding: "18px 20px", borderLeft: `3px solid ${borderColor}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 28 }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>{c.label}</div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.5 }}>{c.description}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: c.color, letterSpacing: -1 }}>{c.used.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>of {c.total.toLocaleString()} total</span>
              </div>
              <div style={{ height: 6, background: "#EEF2F8", borderRadius: 3, margin: "10px 0 6px", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }} style={{ height: "100%", background: c.color, borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: critical ? RED : warning ? AMBER : "#9CA3AF", fontWeight: 600 }}>
                  {unused ? "Not used yet this cycle" : critical ? "Contact us to upgrade" : warning ? "Approaching limit" : `${remaining.toLocaleString()} remaining`}
                </span>
                <span style={{ color: "#9CA3AF", fontWeight: 700 }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 3 — Research Intelligence Credits */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ ...LABEL, marginBottom: 2 }}>Research Intelligence Credits</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Consumed across all AI-powered features — verification, analysis, report generation</div>
        <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <CreditGauge used={b.intelligence_credits.used} total={b.intelligence_credits.total} />
          <div style={{ flex: 1, minWidth: 220 }}>
            {b.intelligence_credits.breakdown.map(row => {
              const pct = Math.round((row.value / b.intelligence_credits.used) * 100);
              return (
                <div key={row.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", marginBottom: 4 }}>
                    <span>{row.label}</span><span style={{ fontWeight: 700 }}>{row.value} credits</span>
                  </div>
                  <div style={{ height: 6, background: "#EEF2F8", borderRadius: 3, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", background: row.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>Credits replenish at the start of each Research Cycle</div>
          </div>
        </div>
      </SettingsCard>

      {/* SECTION 4 — Usage history */}
      <SettingsCard style={{ padding: 24 }}>
        <div style={{ ...LABEL, marginBottom: 16 }}>Usage Over Time</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={b.usage_history} barGap={4} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#F8FAFF" }} contentStyle={{ borderRadius: 10, border: "1px solid #E8EDF5", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="fieldscore" name="FieldScore" fill={BLUE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="insightscore" name="InsightScore" fill={PURPLE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="reports" name="Reports" fill={GREEN} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SettingsCard>

      {/* SECTION 5 — Invoice history */}
      <SettingsCard style={{ padding: 24, overflowX: "auto" }}>
        <div style={{ ...LABEL, marginBottom: 16 }}>Invoice History</div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead><tr>{["Date", "Invoice", "Amount", "Status", "Action"].map(h => <th key={h} style={{ ...LABEL, textAlign: "left", padding: "0 0 12px" }}>{h}</th>)}</tr></thead>
          <tbody>
            {b.invoices.map(inv => (
              <tr key={inv.ref} style={{ borderBottom: "1px solid #F8FAFF" }}>
                <td style={{ padding: "12px 0", fontSize: 12.5, color: "#374151" }}>{new Date(inv.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td style={{ padding: "12px 0", fontSize: 12.5, color: "#374151", fontFamily: "monospace" }}>{inv.ref}</td>
                <td style={{ padding: "12px 0", fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>{money(inv.amount_ngn, currency)}</td>
                <td style={{ padding: "12px 0" }}><Badge label="✓ Paid" color={GREEN} /></td>
                <td style={{ padding: "12px 0" }}><button onClick={() => showToast("Invoice download coming soon")} style={{ ...BTN_GHOST, fontSize: 11, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Download size={11} /> Download</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>

      {/* Upgrade card — only for Trial/Starter */}
      {(b.status === "trial" || b.plan === "Starter") && (
        <div style={{ ...CARD, padding: 24, borderLeft: `3px solid ${BLUE}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#080D1A", marginBottom: 4 }}>Ready for more research capacity?</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 16 }}>Upgrade to Professional for higher limits across every capability.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="mailto:bibilade@intelligencyai.com.ng" style={{ ...BTN_GHOST, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Talk to Sales</a>
            <button onClick={() => showToast("Upgrade flow coming soon")} style={BTN_PRIMARY}>Start Upgrade</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiSection() {
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const mockKey = "rsos_live_a8f3k2x9p1mq7w4n6j0d5e";
  const copyKey = () => {
    navigator.clipboard.writeText(mockKey).catch(() => {});
    setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard style={{ padding: 24 }}>
        <SettingsGroup label="API Keys">
          <div style={{ padding: "16px", background: "#F8FAFF", borderRadius: 10, border: "1px solid #EEF2F8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Production Key</div><Badge label="Active" color={GREEN} /></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value={showKey ? mockKey : "rsos_live_••••••••••••••••••"} style={{ ...INPUT, fontFamily: "monospace", fontSize: 12, color: "#374151", flex: 1 }} />
              <button onClick={() => setShowKey(!showKey)} style={{ ...BTN_GHOST, padding: "9px 12px" }}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              <button onClick={copyKey} style={{ ...BTN_GHOST, padding: "9px 12px", color: keyCopied ? GREEN : undefined }}>{keyCopied ? <Check size={14} /> : <Copy size={14} />}</button>
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
