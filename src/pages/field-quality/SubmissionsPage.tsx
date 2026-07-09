import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { Search, Download, ChevronRight, X, MapPin, Clock, Camera, Mic, RefreshCw, AlertTriangle, CheckSquare, Square, CheckCircle2, XCircle, Flag } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAda as useAdaContext } from "../../ada/AdaContext";
import { useLocation } from "react-router-dom";
import { usePlatform } from "../../platform/PlatformProvider";

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

function EngineBar({label,value,color,icon}:{label:string;value:number;color:string;icon:React.ReactNode}){
  const notScored = value === 0 || value === null || value === undefined;
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
  const [checkedIds,setCheckedIds]=useState<Set<string>>(new Set());
  const [bulkActing,setBulkActing]=useState("");
  const location = useLocation();
  const { t } = usePlatform();
  useAdaGreeting({ page: "submissions" });
  const { addMessage, setState } = useAdaContext();

  const load = useCallback((isRefresh=false)=>{
    if(isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    dashboardApi.getSubmissions({limit:100})
      .then(r=>{
        const submissions = r.data.submissions || r.data || [];
        setSubs(Array.isArray(submissions) ? submissions : []);
      })
      .catch(()=>{
        setError("Could not load submissions. Check your connection and try refreshing.");
      })
      .finally(()=>{ setLoading(false); setRefreshing(false); });
  },[]);

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

  const filtered=subs.filter(s=>{
    if(filter!=="ALL"&&s.verdict!==filter)return false;
    const q = search.toLowerCase();
    if(q&&!s.submission_id.toLowerCase().includes(q)&&!s.enumerator_id.toLowerCase().includes(q))return false;
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every(s => checkedIds.has(s.submission_id));
  const someChecked = filtered.some(s => checkedIds.has(s.submission_id));
  const checkedCount = filtered.filter(s => checkedIds.has(s.submission_id)).length;

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if(allChecked) setCheckedIds(prev => { const n = new Set(prev); filtered.forEach(s => n.delete(s.submission_id)); return n; });
    else setCheckedIds(prev => { const n = new Set(prev); filtered.forEach(s => n.add(s.submission_id)); return n; });
  };
  const bulkAction = async (action: "approve"|"reject"|"flag") => {
    const ids = filtered.filter(s => checkedIds.has(s.submission_id)).map(s => s.submission_id);
    setBulkActing(action);
    await Promise.allSettled(ids.map(id => dashboardApi.actionSubmission(id, action)));
    setBulkActing("");
    setCheckedIds(new Set());
    load(true);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Submissions</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>
            {loading ? "Loading…" : `${subs.length} total · ${subs.filter(s=>s.verdict==="PASS").length} passed · ${subs.filter(s=>s.verdict==="FLAG").length} flagged`}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>load(true)} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:refreshing?"not-allowed":"pointer",opacity:refreshing?.6:1}}>
            <RefreshCw size={13} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>{refreshing?"Refreshing…":"Refresh"}
          </button>
          <button onClick={()=>{
            const headers=["submission_id","enumerator_id","verdict","overall_score","duration_mins","scored_at"];
            const rows=filtered.map(s=>[s.submission_id,s.enumerator_id,s.verdict,s.overall_score,s.duration_mins??'',s.scored_at??''].join(","));
            const csv=[headers.join(","),...rows].join("\n");
            const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
            const a=document.createElement("a");a.href=url;a.download="submissions.csv";a.click();URL.revokeObjectURL(url);
          }} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:"pointer"}}>
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
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search by ID or ${t("enumerator","enumerator")}…`}
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

      <AnimatePresence>
        {checkedCount > 0 && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#EFF4FF",borderRadius:10,border:"1px solid #BFDBFE"}}>
            <span style={{fontSize:12.5,fontWeight:700,color:BLUE,flex:1}}>{checkedCount} submission{checkedCount>1?"s":""} selected</span>
            <button onClick={()=>bulkAction("approve")} disabled={!!bulkActing}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 13px",borderRadius:7,border:"none",background:GREEN,color:"white",fontSize:12,fontWeight:600,cursor:"pointer",opacity:bulkActing?"approve"?1:.5:1}}>
              <CheckCircle2 size={12}/>{bulkActing==="approve"?"Approving…":"Approve"}
            </button>
            <button onClick={()=>bulkAction("flag")} disabled={!!bulkActing}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 13px",borderRadius:7,border:"none",background:AMBER,color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              <Flag size={12}/>{bulkActing==="flag"?"Flagging…":"Flag"}
            </button>
            <button onClick={()=>bulkAction("reject")} disabled={!!bulkActing}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 13px",borderRadius:7,border:"none",background:RED,color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              <XCircle size={12}/>{bulkActing==="reject"?"Rejecting…":"Reject"}
            </button>
            <button onClick={()=>setCheckedIds(new Set())}
              style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:"4px 6px",fontSize:12,fontWeight:500}}>
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 400px":"1fr",gap:16,alignItems:"start"}}>
        <div data-ada-target="submissions-table" style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
          {!loading && filtered.length > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:"1px solid #F1F5F9",background:"#FAFBFF"}}>
              <div onClick={toggleAll} style={{cursor:"pointer",color:allChecked?BLUE:someChecked?"#94A3B8":"#CBD5E1",flexShrink:0,display:"grid",placeItems:"center"}}>
                {allChecked ? <CheckSquare size={16} color={BLUE}/> : someChecked ? <CheckSquare size={16} color="#94A3B8"/> : <Square size={16}/>}
              </div>
              <span style={{fontSize:11,fontWeight:600,color:"#9CA3AF"}}>{allChecked?"Deselect all":`Select all ${filtered.length}`}</span>
            </div>
          )}
          {loading?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Loading submissions…</div>
          ):filtered.length===0?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>No submissions match your filter</div>
          ):filtered.map((sub,i)=>{
            const imgScore = sub.checks?.image?.score ?? 0;
            const audScore = sub.checks?.audio?.score ?? 0;
            const isChecked = checkedIds.has(sub.submission_id);
            return(
            <motion.div key={sub.submission_id} onClick={()=>setSelected(selected?.submission_id===sub.submission_id?null:sub)}
              whileHover={{background:isChecked?"#EFF4FF":"#FAFBFF"}}
              data-ada-target={sub.verdict==="FLAG"&&!filtered.slice(0,i).some(s=>s.verdict==="FLAG")?"flagged-row":undefined}
              style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:i<filtered.length-1?"1px solid #F8FAFF":"none",cursor:"pointer",
                background:isChecked?"#F0F7FF":selected?.submission_id===sub.submission_id?"#F0F7FF":"white",
                borderLeft:isChecked?`3px solid ${BLUE}`:selected?.submission_id===sub.submission_id?`3px solid ${BLUE}`:"3px solid transparent"}}>
              <div onClick={e=>toggleCheck(sub.submission_id,e)} style={{flexShrink:0,display:"grid",placeItems:"center",color:isChecked?BLUE:"#CBD5E1",cursor:"pointer"}}>
                {isChecked ? <CheckSquare size={16} color={BLUE}/> : <Square size={16}/>}
              </div>
              <ScoreRing score={sub.overall_score}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,fontFamily:"monospace",color:"#6B7280"}}>{sub.submission_id.substring(0,12)}…</span>
                  <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:5,background:vbg(sub.verdict),color:vc(sub.verdict)}}>{sub.verdict}</span>
                  {imgScore>0&&<MediaBadge type="image" status={sub.checks?.image?.status||""} score={imgScore}/>}
                  {audScore>0&&<MediaBadge type="audio" status={sub.checks?.audio?.status||""} score={audScore}/>}
                </div>
                <div style={{fontSize:12,color:"#374151",fontWeight:500,marginBottom:3}}>{sub.enumerator_id}</div>
                <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,color:"#9CA3AF"}}>
                  {sub.gps?.address&&<span style={{display:"flex",alignItems:"center",gap:3}}><MapPin size={10}/>{sub.gps.address.split(",").slice(0,2).join(",")}</span>}
                  {sub.duration_mins&&<span style={{display:"flex",alignItems:"center",gap:3}}><Clock size={10}/>{Math.round(Number(sub.duration_mins))}m</span>}
                </div>
                {sub.flags&&(
                  <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                    {(Array.isArray(sub.flags)?sub.flags:sub.flags.split(",")).filter(Boolean).map(f=>(
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
                  <div style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>{selected.enumerator_id}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <ScoreRing score={selected.overall_score} size={52}/>
                  <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:4}}><X size={16}/></button>
                </div>
              </div>
              <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16,maxHeight:"calc(100vh - 200px)",overflowY:"auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,background:vbg(selected.verdict),border:`1px solid ${vc(selected.verdict)}22`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:vc(selected.verdict),flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:700,color:vc(selected.verdict)}}>{selected.verdict}</div>
                    <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>{selected.supervisor_action||"No action required"}</div>
                  </div>
                </div>
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
                  <EngineBar label="GPS Accuracy"  value={selected.gps?.accuracy_m ? Math.max(0,100-selected.gps.accuracy_m) : 92} color={BLUE}   icon={<MapPin size={12} color={BLUE}/>}/>
                  <EngineBar label="Image Quality" value={selected.checks?.image?.score??0}  color={PURPLE} icon={<Camera size={12} color={PURPLE}/>}/>
                  <EngineBar label="Audio Quality" value={selected.checks?.audio?.score??0}  color={GREEN}  icon={<Mic size={12} color={GREEN}/>}/>
                  <EngineBar label="Duration"      value={selected.duration_mins ? Math.min(100, Math.round((Number(selected.duration_mins)/60)*100)) : 0} color={AMBER} icon={<Clock size={12} color={AMBER}/>}/>
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
                      {(Array.isArray(selected.flags)?selected.flags:selected.flags.split(",")).filter(Boolean).map(f=>(
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
