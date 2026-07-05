import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { Search, Download, ChevronRight, X, MapPin, Clock, Camera, Mic } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";

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
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F8FAFF"}}>
      <div style={{width:24,height:24,borderRadius:6,background:color+"18",display:"grid",placeItems:"center",flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:11.5,fontWeight:600,color:"#374151"}}>{label}</span>
          <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:clr(value)}}>{value}/100</span>
        </div>
        <div style={{height:3,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
          <motion.div style={{height:"100%",background:color,borderRadius:2}}
            initial={{width:0}} animate={{width:`${value}%`}} transition={{duration:0.8,ease:"easeOut"}}/>
        </div>
      </div>
    </div>
  );
}

export default function SubmissionsPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Submission|null>(null);
  const [filter,setFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  useAdaGreeting({ page: "submissions" });

  useEffect(()=>{
    dashboardApi.getSubmissions({limit:50})
      .then(r=>setSubs(r.data.submissions||[]))
      .finally(()=>setLoading(false));
  },[]);

  const filtered=subs.filter(s=>{
    if(filter!=="ALL"&&s.verdict!==filter)return false;
    if(search&&!s.submission_id.toLowerCase().includes(search.toLowerCase())&&!s.enumerator_id.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Submissions</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>{subs.length} total · {subs.filter(s=>s.verdict==="PASS").length} passed · {subs.filter(s=>s.verdict==="FLAG").length} flagged</p>
        </div>
        <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:"pointer"}}>
          <Download size={13}/> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"white",border:"1px solid #E2E8F0",borderRadius:8,padding:"7px 12px",flex:1,maxWidth:300}}>
          <Search size={13} color="#9CA3AF"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search submissions..."
            style={{border:"none",background:"transparent",fontSize:12.5,fontFamily:"Inter,sans-serif",outline:"none",flex:1}}/>
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

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 380px":"1fr",gap:16,alignItems:"start"}}>
        {/* List */}
        <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
          {loading?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Loading submissions...</div>
          ):filtered.length===0?(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>No submissions found</div>
          ):filtered.map((sub,i)=>(
            <motion.div key={sub.submission_id} onClick={()=>setSelected(selected?.submission_id===sub.submission_id?null:sub)}
              whileHover={{background:"#FAFBFF"}}
              style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:i<filtered.length-1?"1px solid #F8FAFF":"none",cursor:"pointer",
                background:selected?.submission_id===sub.submission_id?"#F0F7FF":"white",
                borderLeft:selected?.submission_id===sub.submission_id?`3px solid ${BLUE}`:"3px solid transparent"}}>
              <ScoreRing score={sub.overall_score}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:11,fontFamily:"monospace",color:"#6B7280"}}>{sub.submission_id.substring(0,12)}…</span>
                  <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:5,background:vbg(sub.verdict),color:vc(sub.verdict)}}>{sub.verdict}</span>
                  <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:5,background:"#EFF6FF",color:BLUE,fontFamily:"monospace"}}>{sub.overall_score}/100</span>
                </div>
                <div style={{fontSize:12,color:"#374151",fontWeight:500,marginBottom:3}}>{sub.enumerator_id}</div>
                <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,color:"#9CA3AF"}}>
                  {sub.gps?.address&&<span style={{display:"flex",alignItems:"center",gap:3}}><MapPin size={10}/>{sub.gps.address.split(",").slice(0,2).join(",")}</span>}
                  {sub.duration_mins&&<span style={{display:"flex",alignItems:"center",gap:3}}><Clock size={10}/>{Math.round(Number(sub.duration_mins))}m</span>}
                </div>
                {sub.flags&&(
                  <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                    {sub.flags.split(",").filter(Boolean).map(f=>(
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
          ))}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected&&(
            <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}}
              style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 4px 24px rgba(10,15,28,.1)",position:"sticky",top:16}}>
              {/* Header */}
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
                {/* Verdict */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,background:vbg(selected.verdict),border:`1px solid ${vc(selected.verdict)}22`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:vc(selected.verdict),flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:700,color:vc(selected.verdict)}}>{selected.verdict}</div>
                    <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>{selected.supervisor_action}</div>
                  </div>
                </div>

                {/* Location */}
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
                        {selected.gps.accuracy_m&&<span> · ±{selected.gps.accuracy_m}m accuracy</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Engine breakdown */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Quality Engines</div>
                  <EngineBar label="GPS Accuracy" value={92} color={BLUE} icon={<MapPin size={12} color={BLUE}/>}/>
                  <EngineBar label="Image Quality" value={selected.checks?.image?.score||0} color={PURPLE} icon={<Camera size={12} color={PURPLE}/>}/>
                  <EngineBar label="Audio Quality" value={selected.checks?.audio?.score||0} color={GREEN} icon={<Mic size={12} color={GREEN}/>}/>
                  <EngineBar label="Duration" value={85} color={AMBER} icon={<Clock size={12} color={AMBER}/>}/>
                </div>

                {/* Flags */}
                {selected.flags&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Flags</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {selected.flags.split(",").filter(Boolean).map(f=>(
                        <span key={f} style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,background:"#FEF2F2",color:RED,border:"1px solid #FECACA"}}>{f.trim().replace(/_/g," ")}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Details</div>
                  {[
                    ["Submission ID", selected.submission_id.substring(0,16)+"…"],
                    ["Platform", selected.platform||"KoboToolbox"],
                    ["Duration", selected.duration_mins?Math.round(Number(selected.duration_mins))+"m":"—"],
                    ["Scored at", new Date(selected.scored_at).toLocaleString("en-GB")],
                    ["Grade", selected.grade],
                  ].map(([k,v])=>(
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