import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { Search, Download, ChevronRight, X, MapPin, Clock, Camera, Mic, RefreshCw, AlertTriangle, ExternalLink, Shield, Cpu } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAda as useAdaContext } from "../../ada/AdaContext";
import { useLocation, useNavigate } from "react-router-dom";
import { loadEngineConfig } from "../../services/engineConfig";
import { computeTrustIndex } from "../../services/trustEngine";
import type { TrustResult } from "../../services/trustEngine";
import { useProject } from "../../context/ProjectContext";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED";
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;
const vbg=(v:string)=>v==="PASS"?"#ECFDF5":v==="FLAG"?"#FFFBEB":"#FEF2F2";
const vc=(v:string)=>v==="PASS"?GREEN:v==="FLAG"?AMBER:RED;

function ScoreRing({score,size=48}:{score:number;size?:number}){
  const r=size/2-4,c=2*Math.PI*r,color=clr(score);
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={3.5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3.5}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c-c*(score/100)}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size>40?13:10,fontWeight:800,color,fontFamily:"monospace"}}>{score}</div>
    </div>
  );
}

const CYAN="#06B6D4",ROSE="#E11D48";
function EngineBar({label,value,color,icon}:{label:string;value:number;color:string;icon:React.ReactNode}){
  const notScored = value === -1 || value === null || value === undefined;
  const safeVal = notScored ? 0 : Math.min(100, Math.max(0, Math.round(value)));
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F8FAFF"}}>
      <div style={{width:24,height:24,borderRadius:6,background:color+"18",display:"grid",placeItems:"center",flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:11.5,fontWeight:600,color:"#374151"}}>{label}</span>
          {notScored
            ? <span style={{fontSize:11,fontWeight:600,color:"#CBD5E1"}}>Not scored</span>
            : <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:clr(safeVal)}}>{safeVal}/100</span>}
        </div>
        <div style={{height:3,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
          {!notScored && (
            <motion.div style={{height:"100%",background:color,borderRadius:2}}
              initial={{width:0}} animate={{width:`${safeVal}%`}} transition={{duration:0.8,ease:"easeOut"}}/>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaBadge({type,status,score}:{type:"image"|"audio";status:string;score:number}){
  const color = clr(score);
  const icon = type === "image" ? <Camera size={10}/> : <Mic size={10}/>;
  const label = type === "image" ? "Photo" : "Audio";
  return (
    <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:5,background:color+"15",border:`1px solid ${color}30`,fontSize:10,fontWeight:600,color}}>
      {icon}{label} {score > 0 ? score : status}
    </div>
  );
}

export default function SubmissionsPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState<Submission|null>(null);
  const [filter,setFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { activeProject } = useProject();
  useAdaGreeting({ page: "submissions" });
  const { addMessage, setState } = useAdaContext();
  const [cfgVersion, setCfgVersion] = useState(0);
  useEffect(() => {
    const h = () => setCfgVersion(v => v + 1);
    window.addEventListener("fs-engine-config-changed", h);
    return () => window.removeEventListener("fs-engine-config-changed", h);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engineCfg = useMemo(() => loadEngineConfig(), [cfgVersion]);
  // One Trust Index per submission — identical to the detail page by construction
  // (same pure function, same config snapshot). Bible §0 principle 5.
  const trustMap = useMemo(() => {
    const m: Record<string, TrustResult> = {};
    subs.forEach(s => { m[s.submission_id] = computeTrustIndex(s as any, engineCfg); });
    return m;
  }, [subs, engineCfg]);

  const load = useCallback((isRefresh=false)=>{
    if(isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const params: { limit: number; project_id?: string } = { limit: 100 };
    if (activeProject?.id) params.project_id = activeProject.id;
    dashboardApi.getSubmissions(params)
      .then(r=>{
        const submissions = r.data.submissions || r.data || [];
        setSubs(Array.isArray(submissions) ? submissions : []);
      })
      .catch(()=>{
        setError("Could not load submissions. Check your connection and try refreshing.");
      })
      .finally(()=>{ setLoading(false); setRefreshing(false); });
  },[activeProject?.id]);

  useEffect(()=>{
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if(q) setSearch(q);
    load();
  },[load, location.search]);

  useEffect(()=>{
    const handler = () => {
      load(true);
      setState("thinking");
      setTimeout(()=>{
        setState("speaking");
        addMessage({ id: Date.now().toString(), role:"assistant", content:"Refreshing submissions now — pulling the latest data from your connected platforms.", timestamp: new Date().toISOString(), page:"submissions" });
        setTimeout(()=>setState("idle"),3000);
      },600);
    };
    window.addEventListener("researchos:refresh",handler);
    return ()=>window.removeEventListener("researchos:refresh",handler);
  },[load,setState,addMessage]);

  const effectiveVerdict = (s: typeof subs[0]) =>
    (trustMap[s.submission_id]?.verdict ?? s.verdict ?? "FLAG") as "PASS"|"FLAG"|"REJECT";

  const filtered=subs.filter(s=>{
    const adjVerdict = effectiveVerdict(s);
    if(filter!=="ALL"&&adjVerdict!==filter)return false;
    const q = search.toLowerCase();
    if(q&&!s.submission_id.toLowerCase().includes(q)&&!s.enumerator_id.toLowerCase().includes(q)&&!(s as any).enumerator_name?.toLowerCase().includes(q)&&!(s as any).respondent_name?.toLowerCase().includes(q))return false;
    return true;
  });

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Submissions</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>
            {loading ? "Loading…" : `${subs.length} total · ${subs.filter(s=>effectiveVerdict(s)==="PASS").length} passed · ${subs.filter(s=>effectiveVerdict(s)==="FLAG").length} flagged`}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>load(true)} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:refreshing?"not-allowed":"pointer",opacity:refreshing?.6:1}}>
            <RefreshCw size={13} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>{refreshing?"Refreshing…":"Refresh"}
          </button>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:"pointer"}}>
            <Download size={13}/> Export CSV
          </button>
        </div>
      </div>

      {error&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:12.5,color:RED}}>
          <AlertTriangle size={14}/>
          <span>{error}</span>
          <button onClick={()=>load(true)} style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:RED,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Retry</button>
        </div>
      )}

      {!loading&&!error&&subs.length===0&&(
        <div style={{padding:"20px 24px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:12,fontSize:12.5,color:"#92400E",lineHeight:1.6}}>
          <strong>No submissions yet.</strong> Make sure your KoboToolbox form is connected:<br/>
          1. Go to <strong>Integrations</strong> → copy your webhook URL<br/>
          2. In KoboToolbox: Form Settings → REST Services → paste the URL → Save<br/>
          3. Submit a test response, then click <strong>Refresh</strong> above.
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"white",border:"1px solid #E2E8F0",borderRadius:8,padding:"7px 12px",flex:1,maxWidth:300}}>
          <Search size={13} color="#9CA3AF"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ID or enumerator…"
            maxLength={100}
            style={{border:"none",background:"transparent",fontSize:12.5,fontFamily:"Inter,sans-serif",outline:"none",flex:1}}/>
          {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:0}}><X size={12}/></button>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {["ALL","PASS","FLAG","REJECT"].map(v=>(
            <button key={v} onClick={()=>setFilter(v)}
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid",fontSize:11.5,fontWeight:600,cursor:"pointer",transition:"all .15s",
                borderColor:filter===v?BLUE:"#E2E8F0",
                background:filter===v?BLUE:"white",
                color:filter===v?"white":"#6B7280"}}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 400px":"1fr",gap:16,alignItems:"start"}}>
        <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
          {loading?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Loading submissions…</div>
          ):filtered.length===0?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>No submissions match your filter</div>
          ):filtered.map((sub,i)=>{
            const trust = trustMap[sub.submission_id];
            const displayScore = trust?.trustIndex ?? sub.overall_score ?? 0;
            const displayVerdict = effectiveVerdict(sub);
            const imgScore = sub.checks?.image?.score ?? 0;
            const audScore = sub.checks?.audio?.score ?? 0;
            return(
            <motion.div key={sub.submission_id} onClick={()=>setSelected(selected?.submission_id===sub.submission_id?null:sub)}
              whileHover={{background:"#FAFBFF"}}
              data-ada-target={displayVerdict==="FLAG"&&!filtered.slice(0,i).some(s=>effectiveVerdict(s)==="FLAG")?"flagged-row":undefined}
              style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:i<filtered.length-1?"1px solid #F8FAFF":"none",cursor:"pointer",
                background:selected?.submission_id===sub.submission_id?"#F0F7FF":"white",
                borderLeft:selected?.submission_id===sub.submission_id?`3px solid ${BLUE}`:"3px solid transparent"}}>
              <ScoreRing score={displayScore}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,fontFamily:"monospace",color:"#6B7280"}}>{sub.submission_id.substring(0,12)}…</span>
                  <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:5,background:vbg(displayVerdict),color:vc(displayVerdict)}}>{displayVerdict}</span>
                  {imgScore>0&&<MediaBadge type="image" status={sub.checks?.image?.status||""} score={imgScore}/>}
                  {audScore>0&&<MediaBadge type="audio" status={sub.checks?.audio?.status||""} score={audScore}/>}
                </div>
                <div style={{fontSize:12,color:"#374151",fontWeight:500,marginBottom:3}}>{(sub as any).enumerator_name || sub.enumerator_id}</div>
                <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,color:"#9CA3AF"}}>
                  {sub.gps?.address&&<span style={{display:"flex",alignItems:"center",gap:3}}><MapPin size={10}/>{sub.gps.address.split(",").slice(0,2).join(",")}</span>}
                  {sub.duration_mins&&<span style={{display:"flex",alignItems:"center",gap:3}}><Clock size={10}/>{Math.round(Number(sub.duration_mins))}m</span>}
                </div>
                {sub.flags&&(
                  <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                    {(Array.isArray(sub.flags) ? sub.flags : String(sub.flags).split(",")).filter(Boolean).map(f=>(
                      <span key={f} style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"#F1F5F9",color:"#6B7280"}}>{f.trim().replace(/_/g," ")}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"#9CA3AF"}}>{new Date(sub.scored_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>
                  <div style={{fontSize:10,color:"#CBD5E1"}}>{new Date(sub.scored_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                </div>
                <ChevronRight size={14} color={selected?.submission_id===sub.submission_id?BLUE:"#CBD5E1"}/>
              </div>
            </motion.div>
          );})}        </div>

        <AnimatePresence>
          {selected&&(
            <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}}
              style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 4px 24px rgba(10,15,28,.1)",position:"sticky",top:16}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#F8FAFF,white)"}}>
                <div>
                  <div style={{fontSize:11,fontFamily:"monospace",color:"#9CA3AF",marginBottom:2}}>{selected.submission_id.substring(0,16)}…</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>{(selected as any).enumerator_name || selected.enumerator_id}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <ScoreRing score={trustMap[selected.submission_id]?.trustIndex ?? selected.overall_score ?? 0} size={52}/>
                  <button onClick={()=>navigate(`/submissions/${selected.submission_id}`)}
                    title="View full details"
                    style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:7,background:BLUE,border:"none",cursor:"pointer",color:"white",fontSize:11,fontWeight:600,fontFamily:"Inter,sans-serif"}}>
                    <ExternalLink size={12}/> Full
                  </button>
                  <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:4}}><X size={16}/></button>
                </div>
              </div>
              <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16,maxHeight:"calc(100vh - 200px)",overflowY:"auto"}}>
                {(()=>{
                  const selVerdict = effectiveVerdict(selected);
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,background:vbg(selVerdict),border:`1px solid ${vc(selVerdict)}22`}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:vc(selVerdict),flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:12.5,fontWeight:700,color:vc(selVerdict)}}>{selVerdict}</div>
                        <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>{selected.supervisor_action||"No action required"}</div>
                      </div>
                    </div>
                  );
                })()}
                {selected.checks?.image&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8,display:"flex",alignItems:"center",gap:5}}><Camera size={11}/>Image Quality</div>
                    <div style={{background:"#F8FAFF",borderRadius:10,padding:"12px 14px",border:"1px solid #E8EDF5"}}>
                      {selected.checks.image.score > 0 ? (
                        <>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:12,color:"#374151",fontWeight:500,textTransform:"capitalize"}}>{selected.checks.image.status}</span>
                            <span style={{fontSize:13,fontWeight:800,color:clr(selected.checks.image.score),fontFamily:"monospace"}}>{selected.checks.image.score}/100</span>
                          </div>
                          <div style={{height:4,background:"#E8EDF5",borderRadius:2,overflow:"hidden",marginBottom:8}}>
                            <div style={{height:"100%",width:`${selected.checks.image.score}%`,background:clr(selected.checks.image.score),borderRadius:2}}/>
                          </div>
                          {selected.checks.image.finding&&<div style={{fontSize:11.5,color:"#6B7280",fontStyle:"italic"}}>"{ selected.checks.image.finding}"</div>}
                        </>
                      ) : (
                        <div style={{fontSize:12,color:"#9CA3AF"}}>No image submitted or engine did not score this submission.</div>
                      )}
                    </div>
                  </div>
                )}
                {selected.checks?.audio&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8,display:"flex",alignItems:"center",gap:5}}><Mic size={11}/>Audio Quality</div>
                    <div style={{background:"#F8FAFF",borderRadius:10,padding:"12px 14px",border:"1px solid #E8EDF5"}}>
                      {selected.checks.audio.score > 0 ? (
                        <>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:12,color:"#374151",fontWeight:500,textTransform:"capitalize"}}>{selected.checks.audio.status}</span>
                            <span style={{fontSize:13,fontWeight:800,color:clr(selected.checks.audio.score),fontFamily:"monospace"}}>{selected.checks.audio.score}/100</span>
                          </div>
                          <div style={{height:4,background:"#E8EDF5",borderRadius:2,overflow:"hidden",marginBottom:8}}>
                            <div style={{height:"100%",width:`${selected.checks.audio.score}%`,background:clr(selected.checks.audio.score),borderRadius:2}}/>
                          </div>
                          {selected.checks.audio.finding&&<div style={{fontSize:11.5,color:"#6B7280",fontStyle:"italic"}}>"{ selected.checks.audio.finding}"</div>}
                        </>
                      ) : (
                        <div style={{fontSize:12,color:"#9CA3AF"}}>No audio submitted or engine did not score this submission.</div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Quality Engines</div>
                  {(trustMap[selected.submission_id]?.breakdown ?? []).map(b => {
                    const engineColors: Record<string,string> = {gps:BLUE,duration:AMBER,image:PURPLE,audio:GREEN,duplicate:CYAN,text_ai:ROSE};
                    const engineIcons: Record<string,React.ReactNode> = {
                      gps:<MapPin size={12} color={engineColors.gps}/>,
                      duration:<Clock size={12} color={engineColors.duration}/>,
                      image:<Camera size={12} color={engineColors.image}/>,
                      audio:<Mic size={12} color={engineColors.audio}/>,
                      duplicate:<Shield size={12} color={engineColors.duplicate}/>,
                      text_ai:<Cpu size={12} color={engineColors.text_ai}/>,
                    };
                    if (b.requirement === "DISABLED") return null;
                    const requiredMissing = b.included && b.presence === "ABSENT" && !b.flagOverride;
                    const col = b.flagOverride || requiredMissing ? RED : (engineColors[b.key] || BLUE);
                    return (
                      <div key={b.key}>
                        <EngineBar
                          label={b.label}
                          value={b.included ? Math.round(b.shrunkScore ?? 0) : -1}
                          color={col}
                          icon={engineIcons[b.key] || <Shield size={12}/>}
                        />
                        {b.flagOverride && (
                          <div style={{fontSize:10,color:RED,background:"#FEF2F2",borderRadius:5,padding:"3px 8px",marginTop:-6,marginBottom:6}}>
                            ⚑ {b.flagOverride.replace(/_/g," ")} · score capped at {b.effectiveScore}
                          </div>
                        )}
                        {requiredMissing && (
                          <div style={{fontSize:10,color:RED,background:"#FEF2F2",borderRadius:5,padding:"3px 8px",marginTop:-6,marginBottom:6}}>
                            ✕ Required evidence missing — scored 0
                          </div>
                        )}
                        {b.gated && (
                          <div style={{fontSize:10,color:"#9CA3AF",background:"#F8FAFF",borderRadius:5,padding:"3px 8px",marginTop:-6,marginBottom:6}}>
                            ⛔ Gated — upstream check failed
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selected.gps&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Location</div>
                    <div style={{background:"#F8FAFF",borderRadius:10,padding:12,border:"1px solid #E8EDF5"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <MapPin size={12} color={BLUE}/>
                        <span style={{fontSize:12,color:"#374151"}}>{selected.gps.address||"Address not available"}</span>
                      </div>
                      <div style={{fontSize:11,color:"#9CA3AF",fontFamily:"monospace"}}>
                        {selected.gps.lat}, {selected.gps.lon}
                        {selected.gps.accuracy_m&&<span> · ±{selected.gps.accuracy_m}m</span>}
                      </div>
                    </div>
                  </div>
                )}
                {selected.flags&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Flags</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {(Array.isArray(selected.flags) ? selected.flags : String(selected.flags).split(",")).filter(Boolean).map(f=>(
                        <span key={f} style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,background:"#FEF2F2",color:RED,border:"1px solid #FECACA"}}>{f.trim().replace(/_/g," ")}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Details</div>
                  {([
                    ["Submission ID", selected.submission_id.substring(0,20)+"…"],
                    ["Platform",      selected.platform||"KoboToolbox"],
                    ["Duration",      selected.duration_mins?Math.round(Number(selected.duration_mins))+"m":"—"],
                    ["Scored at",     new Date(selected.scored_at).toLocaleString("en-GB")],
                    ["Grade",         selected.grade],
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F8FAFF",fontSize:11.5}}>
                      <span style={{color:"#9CA3AF"}}>{k}</span>
                      <span style={{fontWeight:600,color:"#374151",fontFamily:k==="Submission ID"?"monospace":"inherit"}}>{v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>navigate(`/submissions/${selected.submission_id}`)}
                  style={{width:"100%",padding:"11px",borderRadius:10,background:BLUE,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:"white",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                  <ExternalLink size={14}/> View Full Details — Map, Audio, AI Scan
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
