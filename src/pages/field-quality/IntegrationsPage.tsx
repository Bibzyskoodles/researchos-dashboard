import React, { useState, useCallback, useRef, DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, ChevronUp, Bell, Zap, Upload, FileText, X, AlertCircle } from "lucide-react";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { dashboardApi, API_BASE_URL } from "../../services/api";
import { loadEngineConfig } from "../../services/engineConfig";
import { computeTrustIndex } from "../../services/trustEngine";
import { useProject } from "../../context/ProjectContext";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const CARD: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  border: "1px solid #E8EDF5",
  boxShadow: "0 2px 12px rgba(10,15,28,.06)",
};

function getOrgId(): string | null {
  try {
    const raw = localStorage.getItem("fs_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { org_id?: string };
    return parsed.org_id || null;
  } catch {
    return null;
  }
}

type PlatformStatus = "active" | "available" | "coming-soon";

interface Platform {
  id: string;
  name: string;
  icon: string;
  status: PlatformStatus;
  category: string;
  description: string;
  lastReceived?: string;
  submissionCount?: number;
  setupSteps: string[];
}

const buildSteps = (webhookUrl: string): Record<string, string[]> => ({
  kobo: [
    "Log in to KoboToolbox → open your form",
    "Click Form Settings → REST Services",
    "Click Add Service",
    'Service Name: "FieldScore"',
    `Endpoint URL: ${webhookUrl}`,
    "Method: POST",
    "Click Save",
    "Submit a test response to verify",
  ],
  surveycto: [
    "Log in to SurveyCTO → open your form",
    "Click the Publish tab",
    "Scroll to the Webhooks section",
    "Click Add webhook",
    `URL: ${webhookUrl}`,
    "Select: Send all form submissions",
    "Click Save",
  ],
  odk: [
    "In ODK Central → open your Project",
    "Click the App Users tab",
    "Go to Form Access → select your form",
    "In Project Settings → find Webhooks",
    `Add URL: ${webhookUrl}`,
    "Click Save",
  ],
  commcare: [
    "Log in to CommCare HQ",
    "Go to Project Settings → Data Forwarding",
    "Click Add a forwarding location",
    `URL: ${webhookUrl}`,
    "Type: Form Data",
    "Click Start Forwarding",
  ],
  cspro: [
    "Open CSPro → go to your application",
    "Go to Tools → Paradata Viewer",
    "Enable Data Synchronization",
    `Set the sync endpoint to: ${webhookUrl}`,
    "Set Method: HTTP POST",
    "Save and re-publish your application",
  ],
  generic: [
    `Send a POST request to: ${webhookUrl}`,
    "Content-Type: application/json",
    "Include your form responses as key-value pairs in the JSON body",
    "FieldScore auto-detects the platform from payload structure",
    "A 200 response confirms successful receipt",
  ],
});

function buildPlatforms(webhookUrl: string, koboStats: { count: number; last: string } | null): Platform[] {
  const steps = buildSteps(webhookUrl);
  return [
    // Kobo status reflects REAL submissions for the active project — never a canned count.
    { id:"kobo",name:"KoboToolbox",icon:"🗂",status:koboStats && koboStats.count > 0 ? "active" : "available",category:"Data Collection",description:"The most widely used ODK-based platform for NGO fieldwork.",lastReceived:koboStats?.last || undefined,submissionCount:koboStats?.count,setupSteps:steps.kobo },
    { id:"surveycto",name:"SurveyCTO",icon:"📋",status:"available",category:"Data Collection",description:"Enterprise-grade mobile data collection used by research firms.",setupSteps:steps.surveycto },
    { id:"odk",name:"ODK Collect",icon:"📱",status:"available",category:"Data Collection",description:"Open Data Kit — the open-source standard for mobile surveys.",setupSteps:steps.odk },
    { id:"commcare",name:"CommCare",icon:"🏥",status:"available",category:"Data Collection",description:"Mobile data collection platform popular in health programmes.",setupSteps:steps.commcare },
    { id:"cspro",name:"CSPro",icon:"📊",status:"available",category:"Data Collection",description:"Census and Survey Processing System by the US Census Bureau.",setupSteps:steps.cspro },
    { id:"generic",name:"Generic JSON Webhook",icon:"⚡",status:"available",category:"Custom",description:"Connect any platform that supports HTTP POST webhooks.",setupSteps:steps.generic },
    { id:"gsheets",name:"Google Sheets Export",icon:"📗",status:"coming-soon",category:"Export",description:"Auto-export scored submissions to a Google Sheet.",setupSteps:[] },
    { id:"powerbi",name:"Power BI",icon:"📊",status:"coming-soon",category:"Analytics",description:"Push scored data directly into Power BI dashboards.",setupSteps:[] },
    { id:"zapier",name:"Zapier",icon:"🔗",status:"coming-soon",category:"Automation",description:"Automate workflows when a submission is scored.",setupSteps:[] },
    { id:"teams",name:"Microsoft Teams",icon:"🟦",status:"coming-soon",category:"Notifications",description:"Get Teams notifications when submissions are flagged.",setupSteps:[] },
    { id:"slack",name:"Slack",icon:"💬",status:"coming-soon",category:"Notifications",description:"Receive Slack alerts for flagged or rejected submissions.",setupSteps:[] },
  ];
}

interface ActivityEvent { time: string; platform: string; label: string; status: "processed"|"error"; }

interface CopyButtonProps { text: string; onCopy?: () => void; small?: boolean; }
function CopyButton({ text, onCopy, small }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} style={{ display:"flex",alignItems:"center",gap:5,padding:small?"5px 10px":"7px 14px",borderRadius:7,background:copied?"#ECFDF5":"#EFF6FF",border:`1px solid ${copied?"#A7F3D0":"#BFDBFE"}`,color:copied?GREEN:BLUE,fontSize:small?11:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s",flexShrink:0,whiteSpace:"nowrap" as const }}>
      {copied ? <Check size={small?11:12} /> : <Copy size={small?11:12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface SetupInstructionsProps { platform: Platform; webhookUrl: string; onCopyUrl: () => void; }
function SetupInstructions({ platform, webhookUrl, onCopyUrl }: SetupInstructionsProps) {
  return (
    <motion.div initial={{ opacity:0,height:0 }} animate={{ opacity:1,height:"auto" }} exit={{ opacity:0,height:0 }} transition={{ duration:0.25,ease:"easeInOut" }} style={{ overflow:"hidden" }}>
      <div style={{ borderTop:"1px solid #F1F5F9",padding:"18px 20px 20px",background:"#F8FAFF" }}>
        <div style={{ fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:0.7,marginBottom:14 }}>Setup Instructions</div>
        <ol style={{ margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:10 }}>
          {platform.setupSteps.map((step, i) => {
            const isUrlStep = step.includes("/webhook/") || step.startsWith("Send a POST");
            return (
              <li key={i} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:20,height:20,borderRadius:"50%",background:BLUE,color:"white",fontSize:10,fontWeight:700,display:"grid",placeItems:"center",flexShrink:0,marginTop:1 }}>{i+1}</div>
                <div style={{ flex:1,fontSize:12.5,color:"#374151",lineHeight:1.5 }}>
                  {isUrlStep ? (
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      <span>{step}</span>
                      <div style={{ display:"flex",gap:8,alignItems:"center",background:"white",borderRadius:8,border:"1px solid #E2E8F0",padding:"8px 12px" }}>
                        <code style={{ flex:1,fontSize:11,color:"#374151",fontFamily:"monospace",wordBreak:"break-all" as const }}>{webhookUrl}</code>
                        <CopyButton text={webhookUrl} onCopy={onCopyUrl} small />
                      </div>
                    </div>
                  ) : step}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </motion.div>
  );
}

interface PlatformCardProps { platform: Platform; webhookUrl: string; onSetupOpen: (id: string) => void; isExpanded: boolean; onCopyUrl: () => void; onNotify: (name: string) => void; }
function PlatformCard({ platform, webhookUrl, onSetupOpen, isExpanded, onCopyUrl, onNotify }: PlatformCardProps) {
  const isActive = platform.status === "active";
  const isAvailable = platform.status === "available";
  const isComingSoon = platform.status === "coming-soon";
  const borderColor = isActive ? GREEN : isAvailable ? BLUE : "#E2E8F0";
  const badgeColor = isActive ? GREEN : isAvailable ? BLUE : "#9CA3AF";
  const badgeLabel = isActive ? "Active" : isAvailable ? "Available" : "Coming Soon";
  return (
    <div style={{ ...CARD,borderLeft:`3px solid ${borderColor}`,opacity:isComingSoon?0.65:1,overflow:"hidden" }}>
      <div style={{ padding:"18px 20px" }}>
        <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
          <div style={{ fontSize:28,lineHeight:1,flexShrink:0,marginTop:2 }}>{platform.icon}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#080D1A" }}>{platform.name}</div>
              <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:`${badgeColor}18`,color:badgeColor }}>{badgeLabel}</span>
            </div>
            <div style={{ fontSize:12,color:"#6B7280",lineHeight:1.5,marginBottom:10 }}>{platform.description}</div>
            {isActive && (
              <div style={{ display:"flex",gap:12,fontSize:11.5 }}>
                <div style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:6,height:6,borderRadius:"50%",background:GREEN }} /><span style={{ color:GREEN,fontWeight:600 }}>{platform.submissionCount} submissions received</span></div>
                {platform.lastReceived && <><span style={{ color:"#CBD5E1" }}>·</span>
                <span style={{ color:"#9CA3AF" }}>Last received {platform.lastReceived}</span></>}
              </div>
            )}
            {isAvailable && (
              <button onClick={() => onSetupOpen(platform.id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:isExpanded?"#EFF6FF":BLUE,border:isExpanded?`1px solid ${BLUE}`:"none",color:isExpanded?BLUE:"white",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s" }}>
                {isExpanded ? <><ChevronUp size={13} /> Hide instructions</> : <><ChevronDown size={13} /> Set up</>}
              </button>
            )}
            {isComingSoon && (
              <button onClick={() => onNotify(platform.name)} style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#9CA3AF",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif" }}>
                <Bell size={11} /> Notify me
              </button>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && isAvailable && <SetupInstructions platform={platform} webhookUrl={webhookUrl} onCopyUrl={onCopyUrl} />}
      </AnimatePresence>
    </div>
  );
}

// ─── CSV parser ────────────────────────────────────────────────────────────
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitLine = (line: string) => {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = splitLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

const FIELD_MAP: { key: string; label: string; hints: string[] }[] = [
  { key: 'enumerator_id', label: 'Enumerator ID', hints: ['enumerator', 'interviewer', 'agent', 'collector', 'field_agent'] },
  { key: 'respondent_id', label: 'Respondent ID', hints: ['respondent', 'household', 'hh_id', 'case_id', 'subject'] },
  { key: 'gps_lat',       label: 'GPS Latitude',  hints: ['lat', 'latitude', 'gps_lat', '_gps_latitude'] },
  { key: 'gps_lon',       label: 'GPS Longitude', hints: ['lon', 'lng', 'longitude', 'gps_lon', '_gps_longitude'] },
  { key: 'submitted_at',  label: 'Submission Date', hints: ['date', 'submitted', 'start', 'end', 'timestamp', 'submission_time'] },
  { key: 'overall_score', label: 'Trust Score (0-100)', hints: ['score', 'trust', 'quality', 'overall_score'] },
  { key: 'verdict',       label: 'Verdict (PASS/FLAG/REJECT)', hints: ['verdict', 'status', 'result', 'outcome'] },
  { key: 'duration',      label: 'Duration (minutes)', hints: ['duration', 'interview_duration', 'minutes', 'elapsed'] },
  { key: 'location',      label: 'Location / Address', hints: ['location', 'address', 'lga', 'state', 'region', 'area'] },
];

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  FIELD_MAP.forEach(f => {
    const match = headers.find(h =>
      f.hints.some(hint => h.toLowerCase().replace(/[\s-]/g, '_').includes(hint))
    );
    if (match) mapping[f.key] = match;
  });
  return mapping;
}

function CsvUploadCard() {
  const [stage, setStage] = useState<'idle' | 'mapping' | 'uploading' | 'done' | 'error'>('idle');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      setError('Please upload a CSV file. For Excel, use File → Save As → CSV first.');
      return;
    }
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      if (!h.length) { setError('Could not parse the file — is it a valid CSV?'); return; }
      setHeaders(h);
      setRows(r);
      setMapping(autoMap(h));
      setStage('mapping');
    };
    reader.readAsText(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const onUpload = async () => {
    setStage('uploading');
    setError('');
    const submissions = rows.map(row => {
      const s: Record<string, any> = {};
      FIELD_MAP.forEach(f => {
        if (mapping[f.key] && row[mapping[f.key]] !== undefined) {
          if (f.key === 'gps_lat' || f.key === 'gps_lon') {
            if (!s.gps) s.gps = {};
            if (f.key === 'gps_lat') s.gps.lat = parseFloat(row[mapping[f.key]]) || null;
            if (f.key === 'gps_lon') s.gps.lon = parseFloat(row[mapping[f.key]]) || null;
          } else if (f.key === 'overall_score') {
            s.overall_score = parseFloat(row[mapping[f.key]]) || null;
          } else {
            s[f.key] = row[mapping[f.key]];
          }
        }
      });
      return s;
    });
    try {
      const res = await dashboardApi.uploadSubmissions(submissions);
      setResult(`✓ ${res.data?.imported ?? submissions.length} submissions imported and queued for scoring.`);
      setStage('done');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Upload failed';
      setError(msg);
      setStage('error');
    }
  };

  const reset = () => {
    setStage('idle'); setFileName(''); setHeaders([]); setRows([]);
    setMapping({}); setResult(''); setError('');
  };

  return (
    <div style={{ ...CARD, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={15} color={BLUE} />
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#080D1A' }}>Upload from Spreadsheet</div>
        </div>
        {stage !== 'idle' && (
          <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
        No KoboToolbox connection? Upload a CSV export from any tool — ODK, SurveyCTO, Excel, Google Sheets. Columns are mapped automatically.
      </div>

      {stage === 'idle' && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? BLUE : '#CBD5E1'}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'all .2s',
              background: dragging ? '#EFF6FF' : '#F8FAFF',
            }}
          >
            <FileText size={28} color={dragging ? BLUE : '#CBD5E1'} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Drop your CSV here, or click to browse
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
              CSV, TSV · For Excel: File → Save As → CSV first
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          {error && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-start', color: '#DC2626', fontSize: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px' }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}
        </>
      )}

      {stage === 'mapping' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
            <FileText size={13} color={BLUE} />
            <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>{fileName}</span>
            <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>· {rows.length} rows · {headers.length} columns detected</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
            Map your columns — auto-detected where possible
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {FIELD_MAP.map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{f.label}</label>
                <select
                  value={mapping[f.key] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, color: '#374151', background: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' }}
                >
                  <option value="">— skip —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Preview */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>Preview (first 3 rows)</div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E8EDF5', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {headers.slice(0, 6).map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E8EDF5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none' }}>
                    {headers.slice(0, 6).map(h => (
                      <td key={h} style={{ padding: '7px 10px', color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button onClick={onUpload} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: BLUE, color: 'white', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Upload {rows.length} submissions →
            </button>
          </div>
        </div>
      )}

      {stage === 'uploading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 18, height: 18, border: `2px solid #E2E8F0`, borderTopColor: BLUE, borderRadius: '50%' }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>Uploading {rows.length} submissions...</span>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, fontSize: 13, color: GREEN, fontWeight: 500 }}>
            <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />{result}
          </div>
          <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: 'fit-content' }}>Upload another file</button>
        </div>
      )}

      {stage === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#DC2626' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
          </div>
          <button onClick={() => setStage('mapping')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: 'fit-content' }}>Try again</button>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const orgId = getOrgId();
  const { activeProject, setActiveProject } = useProject();
  // Webhook host = the same backend the dashboard talks to (never hardcoded:
  // a stale host here silently routes client data to the wrong server).
  const webhookBase = `${API_BASE_URL.replace(/\/$/, "")}/webhook/${orgId || "your-org-id"}`;
  // A webhook URL is only ever issued WITH a project binding. Without one,
  // submissions would arrive org-level and could land in the wrong project.
  const webhookUrl = activeProject?.id
    ? `${webhookBase}?project_id=${activeProject.id}`
    : null;
  // Real integration status + activity feed from the project's actual submissions
  const [koboStats, setKoboStats] = useState<{ count: number; last: string } | null>(null);
  const [recentEvents, setRecentEvents] = useState<ActivityEvent[]>([]);
  React.useEffect(() => {
    if (!activeProject?.id) { setKoboStats(null); setRecentEvents([]); return; }
    dashboardApi.getSubmissions({ limit: 5, project_id: activeProject.id })
      .then(r => {
        const subs = r.data.submissions || [];
        const total = r.data.total ?? subs.length;
        const latest = subs[0];
        const last = latest?.scored_at || latest?.submission_date || "";
        setKoboStats({ count: total, last: last ? new Date(last).toLocaleString() : "" });
        setRecentEvents(subs.map((sub: any) => ({
          time: (sub.scored_at || sub.submission_date) ? new Date(sub.scored_at || sub.submission_date).toLocaleString() : "",
          platform: sub.platform || "Webhook",
          label: `${String(sub.submission_id || "").slice(0, 10)}… scored ${computeTrustIndex(sub, loadEngineConfig()).trustIndex ?? "—"}/100`,
          status: "processed" as const,
        })));
      })
      .catch(() => { setKoboStats(null); setRecentEvents([]); });
  }, [activeProject?.id]);

  const platforms = buildPlatforms(webhookUrl ?? "⚠ select a project first to get your webhook URL", koboStats);
  const activeCount = platforms.filter(p => p.status === "active").length;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [toast, setToast] = useState("");
  const { setOpen, addMessage, setState } = useAda();

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const handleNotify = (name: string) => showToast(`We'll notify you when ${name} integration is available`);

  // Form ↔ project link
  const [linkUid, setLinkUid] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [editingLink, setEditingLink] = useState(false);

  // InsightScore project link — without this, scored submissions are never
  // bridged for qualitative analysis and AI Analysis shows 0 interviews.
  const [iscId, setIscId] = useState("");
  const [iscSaving, setIscSaving] = useState(false);
  const [iscMsg, setIscMsg] = useState("");
  const [editingIsc, setEditingIsc] = useState(false);

  const saveIscLink = async () => {
    if (!activeProject?.id || !iscId.trim() || iscSaving) return;
    setIscSaving(true); setIscMsg("");
    try {
      const { projectsApi } = await import("../../services/api");
      await projectsApi.update(activeProject.id, { insightscore_project_id: iscId.trim() });
      setIscMsg("✓ Linked — new PASS submissions will be analysed for qualitative themes.");
      setEditingIsc(false);
      setActiveProject(activeProject.id);
    } catch {
      setIscMsg("Could not link the InsightScore project — check your connection and try again.");
    } finally {
      setIscSaving(false);
    }
  };

  const saveFormLink = async () => {
    if (!activeProject?.id || !linkUid.trim() || linkSaving) return;
    setLinkSaving(true); setLinkMsg("");
    try {
      const { projectsApi } = await import("../../services/api");
      await projectsApi.update(activeProject.id, { kobo_asset_uid: linkUid.trim() });
      setLinkMsg("✓ Form linked — this form's submissions (including earlier ones) now belong to this project.");
      setEditingLink(false);
      // Refresh the project in context so the linked uid shows immediately
      setActiveProject(activeProject.id);
    } catch {
      setLinkMsg("Could not link the form — check your connection and try again.");
    } finally {
      setLinkSaving(false);
    }
  };

  // KoboToolbox pull/import (testing helper)
  const [assetUid, setAssetUid] = useState("");
  const [koboBusy, setKoboBusy] = useState("");
  const [koboForms, setKoboForms] = useState<any[] | null>(null);
  const [koboResult, setKoboResult] = useState<any>(null);
  const [koboError, setKoboError] = useState("");

  const testKobo = async () => {
    setKoboBusy("ping"); setKoboError(""); setKoboForms(null); setKoboResult(null);
    try { const r = await dashboardApi.koboPing(); setKoboForms(r.data.forms || []); }
    catch (e: any) { setKoboError(e?.response?.data?.error || "Connection failed — is KOBO_API_TOKEN set on the server?"); }
    finally { setKoboBusy(""); }
  };
  const importKobo = async () => {
    if (!assetUid.trim()) return;
    setKoboBusy("import"); setKoboError(""); setKoboResult(null);
    try { const r = await dashboardApi.koboImport(assetUid.trim(), 30); setKoboResult(r.data); }
    catch (e: any) { setKoboError(e?.response?.data?.error || "Import failed"); }
    finally { setKoboBusy(""); }
  };

  useAdaGreeting({ page: "integrations" });

  const handleSetupOpen = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
    const platform = platforms.find(p => p.id === id);
    if (!platform) return;
    setState("speaking");
    addMessage({ id:Date.now().toString(),role:"assistant",content:`${platform.name} is ${platform.description.toLowerCase()} Follow the steps below to connect your webhook. Come back here once you've sent a test submission and I'll confirm it's working.`,timestamp:new Date().toISOString(),page:"integrations" });
    setTimeout(() => setState("idle"), 4000);
  }, [platforms, setState, addMessage]);

  const handleCopyUrl = useCallback(() => {
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
    setState("speaking");
    addMessage({ id:Date.now().toString(),role:"assistant",content:`That URL is bound to "${activeProject?.name || "your project"}" — every submission sent to it lands in that project only. Paste it into that project's form webhook settings, send a test response, and come back here so I can confirm it arrived.`,timestamp:new Date().toISOString(),page:"integrations" });
    setTimeout(() => setState("idle"), 4000);
  }, [setState, addMessage, activeProject?.name]);

  const heroText = activeCount > 0
    ? `Your KoboToolbox integration is active — this project has received ${platforms.find(p => p.id === "kobo")?.submissionCount ?? 0} submission${(platforms.find(p => p.id === "kobo")?.submissionCount ?? 0) === 1 ? "" : "s"}. Want me to help you connect another platform?`
    : "Let's connect your first data source. Which platform does your field team use? KoboToolbox is the most common choice for NGO fieldwork.";

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.4 }} style={{ background:"linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)",borderRadius:20,overflow:"hidden",position:"relative",boxShadow:"0 8px 40px rgba(8,13,26,.2)" }}>
        <div style={{ position:"absolute",top:-60,right:160,width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,.22),transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:-40,left:80,width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,.15),transparent 70%)",pointerEvents:"none" }} />
        <div style={{ display:"flex",alignItems:"stretch",position:"relative",zIndex:1 }}>
          <div style={{ width:160,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",padding:"20px 10px 0" }}>
            <motion.div animate={{ y:[0,-6,0] }} transition={{ duration:3,repeat:Infinity,ease:"easeInOut" }} style={{ width:120,height:120 }}>
              <motion.div onClick={() => setOpen(true)} animate={{ boxShadow:["0 0 0 0 rgba(96,165,250,0)","0 0 0 10px rgba(96,165,250,0.3)","0 0 0 20px rgba(96,165,250,0)","0 0 0 0 rgba(96,165,250,0)"] }} transition={{ duration:3,repeat:Infinity,ease:"easeInOut",repeatDelay:1 }} style={{ width:"100%",height:"100%",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"3px solid rgba(255,255,255,.25)" }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%" }} />
              </motion.div>
            </motion.div>
            <div style={{ marginTop:8,marginBottom:16,textAlign:"center" }}>
              <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.5)",letterSpacing:1.2,textTransform:"uppercase" }}>Ada · AI Analyst</div>
            </div>
          </div>
          <div style={{ flex:1,padding:"28px 28px 28px 16px",display:"flex",flexDirection:"column",justifyContent:"center",gap:14 }}>
            <div>
              <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"rgba(37,99,235,.2)",border:"1px solid rgba(37,99,235,.3)",borderRadius:6,padding:"3px 10px",marginBottom:12 }}>
                <div style={{ width:5,height:5,borderRadius:"50%",background:activeCount>0?"#34D399":"#60A5FA" }} />
                <span style={{ fontSize:9.5,fontWeight:700,color:"#93C5FD",letterSpacing:1,textTransform:"uppercase" }}>{activeCount>0?`${activeCount} Active Integration`:"No Integrations Yet"}</span>
              </div>
              <div style={{ fontSize:15,fontWeight:600,color:"white",lineHeight:1.6,maxWidth:520 }}>{heroText}</div>
            </div>
            <button onClick={() => setOpen(true)} style={{ padding:"9px 20px",borderRadius:10,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",width:"fit-content",fontFamily:"Inter,sans-serif" }}>Ask Ada</button>
          </div>
        </div>
      </motion.div>

      <div style={{ ...CARD,padding:"20px 24px" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap" as const }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}><Zap size={15} color={BLUE} /><div style={{ fontSize:13.5,fontWeight:700,color:"#080D1A" }}>Your FieldScore Webhook URL</div></div>
            {webhookUrl ? (
              <>
                {/* Project binding — impossible to miss */}
                <div style={{ display:"inline-flex",alignItems:"center",gap:7,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"6px 12px",marginBottom:10 }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:GREEN }} />
                  <span style={{ fontSize:12,color:"#1E40AF" }}>
                    This URL delivers submissions to: <strong>{activeProject?.name}</strong>
                  </span>
                </div>
                <div style={{ fontSize:12,color:"#6B7280",marginBottom:12 }}>
                  Paste it into the form for <strong>this project only</strong>. Running another project too? Switch to it in the top bar first — each project has its own URL, and pasting the wrong one sends that form's data to the wrong project.
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <div style={{ flex:1,background:"#F8FAFF",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 14px",fontFamily:"monospace",fontSize:12.5,color:"#374151",wordBreak:"break-all" as const }}>{webhookUrl}</div>
                  <CopyButton text={webhookUrl} onCopy={handleCopyUrl} />
                </div>
                {/* Form ↔ project link — powers routing verification and claims
                    historical submissions written before URL-based routing */}
                <div style={{ marginTop:12,padding:"10px 14px",borderRadius:8,background:"#F8FAFF",border:"1px solid #EEF2F8" }}>
                  {activeProject?.kobo_asset_uid && !editingLink ? (
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const }}>
                      <span style={{ fontSize:11.5,color:"#374151" }}>
                        Linked KoboToolbox form: <code style={{ fontFamily:"monospace",background:"#F1F5F9",padding:"1px 6px",borderRadius:4 }}>{activeProject.kobo_asset_uid}</code>
                      </span>
                      <span style={{ fontSize:11,color:"#9CA3AF" }}>Submissions from other forms sent to this URL will be flagged.</span>
                      <button onClick={()=>{ setEditingLink(true); setLinkUid(activeProject.kobo_asset_uid || ""); }}
                        style={{ marginLeft:"auto",fontSize:11,fontWeight:600,color:BLUE,background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif" }}>Change</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize:11.5,fontWeight:600,color:"#374151",marginBottom:4 }}>
                        {activeProject?.kobo_asset_uid ? "Change linked KoboToolbox form" : "Link your KoboToolbox form to this project"}
                      </div>
                      <div style={{ fontSize:11,color:"#9CA3AF",marginBottom:8,lineHeight:1.5 }}>
                        Paste the form's asset UID (find it with "Test Connection" below, or in the form's URL on KoboToolbox). Linking lets FieldScore verify every submission came from the right form — and pulls this form's earlier submissions into this project.
                      </div>
                      <div style={{ display:"flex",gap:8 }}>
                        <input value={linkUid} onChange={e=>setLinkUid(e.target.value)} placeholder="e.g. aBcD1234xyz"
                          style={{ flex:1,minWidth:160,border:"1px solid #E2E8F0",borderRadius:7,padding:"7px 10px",fontSize:12,fontFamily:"monospace",outline:"none" }} />
                        <button onClick={saveFormLink} disabled={!linkUid.trim()||linkSaving}
                          style={{ padding:"7px 14px",borderRadius:7,background:BLUE,border:"none",color:"white",fontSize:11.5,fontWeight:600,cursor:linkSaving?"wait":"pointer",fontFamily:"Inter,sans-serif",opacity:!linkUid.trim()||linkSaving?0.6:1 }}>
                          {linkSaving ? "Linking…" : "Link form"}
                        </button>
                        {editingLink && (
                          <button onClick={()=>setEditingLink(false)}
                            style={{ padding:"7px 10px",borderRadius:7,background:"white",border:"1px solid #E2E8F0",color:"#6B7280",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif" }}>Cancel</button>
                        )}
                      </div>
                      {linkMsg && <div style={{ marginTop:6,fontSize:11.5,color:linkMsg.startsWith("✓")?GREEN:"#DC2626" }}>{linkMsg}</div>}
                    </div>
                  )}
                </div>
                {/* InsightScore project link — without this, verified submissions
                    are scored but never bridged for qualitative analysis. */}
                <div style={{ marginTop:10,padding:"10px 14px",borderRadius:8,background:"#F5F3FF",border:"1px solid #E9D5FF" }}>
                  {activeProject?.insightscore_project_id && !editingIsc ? (
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const }}>
                      <span style={{ fontSize:11.5,color:"#374151" }}>
                        Linked InsightScore project: <code style={{ fontFamily:"monospace",background:"#F1F5F9",padding:"1px 6px",borderRadius:4 }}>{activeProject.insightscore_project_id}</code>
                      </span>
                      <span style={{ fontSize:11,color:"#9CA3AF" }}>PASS submissions are analysed for qualitative themes.</span>
                      <button onClick={()=>{ setEditingIsc(true); setIscId(activeProject.insightscore_project_id || ""); }}
                        style={{ marginLeft:"auto",fontSize:11,fontWeight:600,color:"#7C3AED",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif" }}>Change</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize:11.5,fontWeight:600,color:"#374151",marginBottom:4 }}>
                        {activeProject?.insightscore_project_id ? "Change linked InsightScore project" : "Link this project to InsightScore for qualitative analysis"}
                      </div>
                      <div style={{ fontSize:11,color:"#9CA3AF",marginBottom:8,lineHeight:1.5 }}>
                        Without this, submissions are still verified for fraud but never sent for theme/sentiment analysis — AI Analysis will show 0 interviews. Create a project on the AI Analysis page first if you haven't, then paste its project ID here.
                      </div>
                      <div style={{ display:"flex",gap:8 }}>
                        <input value={iscId} onChange={e=>setIscId(e.target.value)} placeholder="InsightScore project ID"
                          style={{ flex:1,minWidth:160,border:"1px solid #E2E8F0",borderRadius:7,padding:"7px 10px",fontSize:12,fontFamily:"monospace",outline:"none" }} />
                        <button onClick={saveIscLink} disabled={!iscId.trim()||iscSaving}
                          style={{ padding:"7px 14px",borderRadius:7,background:"#7C3AED",border:"none",color:"white",fontSize:11.5,fontWeight:600,cursor:iscSaving?"wait":"pointer",fontFamily:"Inter,sans-serif",opacity:!iscId.trim()||iscSaving?0.6:1 }}>
                          {iscSaving ? "Linking…" : "Link project"}
                        </button>
                        {editingIsc && (
                          <button onClick={()=>setEditingIsc(false)}
                            style={{ padding:"7px 10px",borderRadius:7,background:"white",border:"1px solid #E2E8F0",color:"#6B7280",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif" }}>Cancel</button>
                        )}
                      </div>
                      {iscMsg && <div style={{ marginTop:6,fontSize:11.5,color:iscMsg.startsWith("✓")?GREEN:"#DC2626" }}>{iscMsg}</div>}
                    </div>
                  )}
                </div>
                {!orgId && <div style={{ marginTop:10,fontSize:11.5,color:AMBER }}>⚠ Organisation ID not found — log in to see your personalised URL.</div>}
              </>
            ) : (
              <div style={{ padding:"16px 18px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:12.5,color:"#92400E",lineHeight:1.7 }}>
                <strong>Select a project first.</strong> Webhook URLs are issued per project so every form's submissions land in exactly one project. Use the project switcher in the top bar (or the Projects page) to choose the project this form belongs to, then come back here to copy its URL.
              </div>
            )}
          </div>
          {urlCopied && <motion.div initial={{ opacity:0,scale:0.9 }} animate={{ opacity:1,scale:1 }} style={{ padding:"8px 14px",borderRadius:8,background:"#ECFDF5",border:"1px solid #A7F3D0",fontSize:12,fontWeight:600,color:GREEN,flexShrink:0,display:"flex",alignItems:"center",gap:4 }}><Check size={12} />URL copied!</motion.div>}
        </div>
      </div>

      {/* Pull from KoboToolbox — testing helper */}
      <div style={{ ...CARD, padding:"20px 24px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
          <Zap size={15} color={BLUE} /><div style={{ fontSize:13.5,fontWeight:700,color:"#080D1A" }}>Pull submissions from KoboToolbox</div>
        </div>
        <div style={{ fontSize:12,color:"#6B7280",marginBottom:12 }}>Import and score existing submissions from a Kobo form — handy for testing without waiting on the webhook. Requires <code style={{ fontFamily:"monospace" }}>KOBO_API_TOKEN</code> on the server.</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12 }}>
          <button onClick={testKobo} disabled={koboBusy!==""} style={{ padding:"9px 16px",borderRadius:8,background:"white",border:"1px solid #E2E8F0",color:"#374151",fontSize:12.5,fontWeight:600,cursor:koboBusy?"wait":"pointer",fontFamily:"Inter,sans-serif" }}>{koboBusy==="ping"?"Testing…":"Test Connection"}</button>
          <input value={assetUid} onChange={e=>setAssetUid(e.target.value)} placeholder="Form asset UID (e.g. aBcD123…)" style={{ flex:1,minWidth:200,border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px",fontSize:12.5,fontFamily:"Inter,sans-serif",outline:"none" }} />
          <button onClick={importKobo} disabled={koboBusy!==""||!assetUid.trim()} style={{ padding:"9px 16px",borderRadius:8,background:BLUE,border:"none",color:"white",fontSize:12.5,fontWeight:600,cursor:koboBusy?"wait":"pointer",fontFamily:"Inter,sans-serif",opacity:koboBusy||!assetUid.trim()?0.6:1 }}>{koboBusy==="import"?"Importing…":"Import & Score"}</button>
        </div>
        {koboError && <div style={{ fontSize:12,color:"#DC2626",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",marginBottom:8 }}>{koboError}</div>}
        {koboForms && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.6,marginBottom:6 }}>Your forms ({koboForms.length}) — click one to use its UID</div>
            {koboForms.length ? koboForms.map((f:any)=>(
              <div key={f.uid} onClick={()=>setAssetUid(f.uid)} style={{ display:"flex",justifyContent:"space-between",gap:10,padding:"7px 10px",borderRadius:8,background:"#F8FAFF",border:"1px solid #EEF2F8",marginBottom:6,cursor:"pointer",fontSize:12 }}>
                <span style={{ fontWeight:600,color:"#080D1A" }}>{f.name}</span>
                <span style={{ color:"#9CA3AF",fontFamily:"monospace" }}>{f.uid} · {f.submissions} subs</span>
              </div>
            )) : <div style={{ fontSize:12,color:"#9CA3AF" }}>No forms found on this account.</div>}
          </div>
        )}
        {koboResult && (
          <div style={{ fontSize:12.5,color:GREEN,background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:8,padding:"10px 12px" }}>
            ✓ Imported and scored {koboResult.scored} of {koboResult.fetched} submissions{koboResult.errors?` (${koboResult.errors} errors)`:""}. They now appear on your dashboard.
          </div>
        )}
      </div>

      <CsvUploadCard />

      <div>
        <div style={{ fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:0.7,marginBottom:14 }}>Platforms</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14 }}>
          {platforms.map(platform => (
            <PlatformCard key={platform.id} platform={platform} webhookUrl={webhookUrl ?? "⚠ select a project first to get your webhook URL"} onSetupOpen={handleSetupOpen} isExpanded={expandedId===platform.id} onCopyUrl={handleCopyUrl} onNotify={handleNotify} />
          ))}
        </div>
      </div>

      <div style={{ ...CARD,overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 12px",borderBottom:"1px solid #F1F5F9" }}>
          <div style={{ fontSize:13.5,fontWeight:700,color:"#080D1A" }}>Recent Webhook Activity</div>
          <div style={{ fontSize:11,color:"#9CA3AF",marginTop:2 }}>Last 5 events received by your endpoint</div>
        </div>
        {recentEvents.length === 0 ? (
          <div style={{ padding:"18px 20px",fontSize:12.5,color:"#9CA3AF" }}>
            No webhook activity yet for this project — events appear here the moment your first submission arrives.
          </div>
        ) : recentEvents.map((event,i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<recentEvents.length-1?"1px solid #F8FAFF":"none" }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:event.status==="processed"?GREEN:"#DC2626",flexShrink:0 }} />
            <div style={{ flex:1 }}><div style={{ fontSize:13,fontWeight:600,color:"#080D1A" }}>{event.platform}</div><div style={{ fontSize:11.5,color:"#9CA3AF" }}>{event.label}</div></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:11.5,color:"#9CA3AF" }}>{event.time}</div><div style={{ fontSize:10.5,fontWeight:600,color:event.status==="processed"?GREEN:"#DC2626",marginTop:2 }}>{event.status}</div></div>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#111827",color:"white",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,.3)",pointerEvents:"none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
