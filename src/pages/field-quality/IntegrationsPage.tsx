import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, ChevronUp, Bell, Zap } from "lucide-react";
import { useAda } from "../../ada/AdaContext";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";

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

function buildPlatforms(webhookUrl: string): Platform[] {
  const steps = buildSteps(webhookUrl);
  return [
    { id:"kobo",name:"KoboToolbox",icon:"🗂",status:"active",category:"Data Collection",description:"The most widely used ODK-based platform for NGO fieldwork.",lastReceived:"3 minutes ago",submissionCount:18,setupSteps:steps.kobo },
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

interface ActivityEvent { time: string; platform: string; count: number; status: "processed"|"error"; }
const RECENT_ACTIVITY: ActivityEvent[] = [
  {time:"3 mins ago",platform:"KoboToolbox",count:1,status:"processed"},
  {time:"14 mins ago",platform:"KoboToolbox",count:1,status:"processed"},
  {time:"1h ago",platform:"KoboToolbox",count:3,status:"processed"},
  {time:"2h ago",platform:"KoboToolbox",count:1,status:"error"},
  {time:"3h ago",platform:"KoboToolbox",count:2,status:"processed"},
];

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
            const isUrlStep = step.includes("web-production-f5bab") || step.startsWith("Send a POST");
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

interface PlatformCardProps { platform: Platform; webhookUrl: string; onSetupOpen: (id: string) => void; isExpanded: boolean; onCopyUrl: () => void; }
function PlatformCard({ platform, webhookUrl, onSetupOpen, isExpanded, onCopyUrl }: PlatformCardProps) {
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
                <span style={{ color:"#CBD5E1" }}>·</span>
                <span style={{ color:"#9CA3AF" }}>Last received {platform.lastReceived}</span>
              </div>
            )}
            {isAvailable && (
              <button onClick={() => onSetupOpen(platform.id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:isExpanded?"#EFF6FF":BLUE,border:isExpanded?`1px solid ${BLUE}`:"none",color:isExpanded?BLUE:"white",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s" }}>
                {isExpanded ? <><ChevronUp size={13} /> Hide instructions</> : <><ChevronDown size={13} /> Set up</>}
              </button>
            )}
            {isComingSoon && (
              <button style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#9CA3AF",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif" }}>
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

export default function IntegrationsPage() {
  const orgId = getOrgId();
  const webhookUrl = orgId
    ? `https://web-production-f5bab.up.railway.app/webhook/${orgId}`
    : "https://web-production-f5bab.up.railway.app/webhook/your-org-id";
  const platforms = buildPlatforms(webhookUrl);
  const activeCount = platforms.filter(p => p.status === "active").length;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const { setOpen, addMessage, setState } = useAda();

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
    addMessage({ id:Date.now().toString(),role:"assistant",content:"Paste that URL into your platform's webhook settings. Come back here once you've sent a test submission and I'll confirm it's working.",timestamp:new Date().toISOString(),page:"integrations" });
    setTimeout(() => setState("idle"), 4000);
  }, [setState, addMessage]);

  const heroText = activeCount > 0
    ? `Your KoboToolbox integration is active and receiving ${platforms.find(p => p.id === "kobo")?.submissionCount ?? 0} submissions. Want me to help you connect another platform?`
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
            <div style={{ fontSize:12,color:"#6B7280",marginBottom:12 }}>This is your unique endpoint. Paste it into any supported platform to start sending submissions to FieldScore.</div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <div style={{ flex:1,background:"#F8FAFF",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 14px",fontFamily:"monospace",fontSize:12.5,color:"#374151",wordBreak:"break-all" as const }}>{webhookUrl}</div>
              <CopyButton text={webhookUrl} onCopy={handleCopyUrl} />
            </div>
            {!orgId && <div style={{ marginTop:10,fontSize:11.5,color:AMBER }}>⚠ Organisation ID not found — log in to see your personalised URL.</div>}
            <div style={{ marginTop:10,fontSize:11.5,color:"#9CA3AF" }}>All submissions sent to this URL are automatically scored and verified by FieldScore.</div>
          </div>
          {urlCopied && <motion.div initial={{ opacity:0,scale:0.9 }} animate={{ opacity:1,scale:1 }} style={{ padding:"8px 14px",borderRadius:8,background:"#ECFDF5",border:"1px solid #A7F3D0",fontSize:12,fontWeight:600,color:GREEN,flexShrink:0,display:"flex",alignItems:"center",gap:4 }}><Check size={12} />URL copied!</motion.div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:0.7,marginBottom:14 }}>Platforms</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14 }}>
          {platforms.map(platform => (
            <PlatformCard key={platform.id} platform={platform} webhookUrl={webhookUrl} onSetupOpen={handleSetupOpen} isExpanded={expandedId===platform.id} onCopyUrl={handleCopyUrl} />
          ))}
        </div>
      </div>

      <div style={{ ...CARD,overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 12px",borderBottom:"1px solid #F1F5F9" }}>
          <div style={{ fontSize:13.5,fontWeight:700,color:"#080D1A" }}>Recent Webhook Activity</div>
          <div style={{ fontSize:11,color:"#9CA3AF",marginTop:2 }}>Last 5 events received by your endpoint</div>
        </div>
        {RECENT_ACTIVITY.map((event,i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<RECENT_ACTIVITY.length-1?"1px solid #F8FAFF":"none" }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:event.status==="processed"?GREEN:"#DC2626",flexShrink:0 }} />
            <div style={{ flex:1 }}><div style={{ fontSize:13,fontWeight:600,color:"#080D1A" }}>{event.platform}</div><div style={{ fontSize:11.5,color:"#9CA3AF" }}>{event.count} submission{event.count!==1?"s":""} received</div></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:11.5,color:"#9CA3AF" }}>{event.time}</div><div style={{ fontSize:10.5,fontWeight:600,color:event.status==="processed"?GREEN:"#DC2626",marginTop:2 }}>{event.status}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
