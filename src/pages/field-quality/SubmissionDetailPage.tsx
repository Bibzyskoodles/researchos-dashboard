import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { dashboardApi } from "../../services/api";
import { ArrowLeft, Copy, CheckCircle, XCircle, AlertTriangle, Clock, MapPin, Camera, Mic, Shield } from "lucide-react";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED",CYAN="#06B6D4";

const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;
const vclr=(v:string)=>v==="PASS"?GREEN:v==="FLAG"?AMBER:RED;

const FLAG_LABELS:Record<string,{label:string,severity:"high"|"medium"|"low"}> = {
  DUPLICATE_SUBMISSION: {label:"Duplicate Submission — this submission appears to have been submitted before",severity:"high"},
  DUPLICATE_IMAGE: {label:"Duplicate Image — this photo has been used in a previous submission",severity:"high"},
  DUPLICATE_AUDIO: {label:"Duplicate Audio — this audio recording matches a previous submission",severity:"high"},
  GPS_OUTSIDE_NIGERIA: {label:"Location Issue — GPS coordinates are outside the expected survey area",severity:"high"},
  DURATION_TOO_SHORT: {label:"Interview Too Short — the interview was significantly shorter than expected",severity:"medium"},
  DURATION_TOO_LONG: {label:"Interview Too Long — the interview duration is unusually long",severity:"medium"},
  IMAGE_QUALITY_ISSUE: {label:"Image Quality Issue — the submitted image did not pass quality checks",severity:"medium"},
  AUDIO_QUALITY_ISSUE: {label:"Audio Quality Issue — the audio recording did not pass quality checks",severity:"medium"},
  LOW_GPS_ACCURACY: {label:"Low GPS Accuracy — the location could not be precisely determined",severity:"low"},
  GPS_POOR_ACCURACY: {label:"Low GPS Accuracy — the recorded location accuracy is below the required threshold",severity:"low"},
  NO_GPS: {label:"No GPS Data — this submission has no location recorded",severity:"medium"},
  GPS_PARSE_ERROR: {label:"GPS Unreadable — the location data could not be parsed",severity:"medium"},
  OUTSIDE_ASSIGNED_ZONE: {label:"Outside Assigned Zone — the submission was captured outside the enumerator's assigned area",severity:"high"},
  DURATION_NOT_CALCULABLE: {label:"Duration Unknown — start or end time is missing, so length can't be verified",severity:"medium"},
  DURATION_PARSE_ERROR: {label:"Duration Unreadable — the interview timestamps could not be parsed",severity:"medium"},
  DURATION_NEGATIVE: {label:"Invalid Timing — the end time is before the start time",severity:"high"},
  IMAGE_AI_UNAVAILABLE: {label:"Image Check Unavailable — the AI image review could not be completed",severity:"low"},
  AUDIO_AI_UNAVAILABLE: {label:"Audio Check Unavailable — the AI audio review could not be completed",severity:"low"},
  AUDIO_EMPTY: {label:"No Speech Detected — the audio recording contains no speech",severity:"high"},
};

function ScoreRing({score,size=80}:{score:number,size:number}){
  const r=size/2-6; const c=2*Math.PI*r;
  const pct=score/100; const color=clr(score);
  return(
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={6}/>
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} initial={{strokeDashoffset:c}}
        animate={{strokeDashoffset:c-(pct*c)}} transition={{duration:1,ease:"easeOut"}}
        strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{transform:`rotate(90deg) translate(0,0)`,transformOrigin:`${size/2}px ${size/2}px`,
          fontSize:size>100?28:18,fontWeight:800,fill:color,fontFamily:"Inter,sans-serif"}}>
        {score}
      </text>
    </svg>
  );
}

function EngineBar({label,score,status,finding,weight,color,icon}:any){
  const notMeasured=!status||status==="NOT_AVAILABLE"||status==="SKIPPED"||status==="not_available";
  return(
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}
      style={{padding:"12px 0",borderBottom:"1px solid #F1F5F9"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:color+"15",display:"grid",placeItems:"center"}}>
            {icon}
          </div>
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:"#374151"}}>{label}</div>
            <div style={{fontSize:10.5,color:"#9CA3AF"}}>{weight}% of total score</div>
          </div>
        </div>
        {notMeasured?(
          <span style={{fontSize:11,color:"#9CA3AF",background:"#F1F5F9",padding:"3px 10px",borderRadius:20,fontWeight:500}}>
            Not measured
          </span>
        ):(
          <span style={{fontSize:14,fontWeight:800,color:clr(score),fontFamily:"monospace"}}>{score}/100</span>
        )}
      </div>
      {!notMeasured&&(
        <div style={{height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden",marginBottom:6}}>
          <motion.div style={{height:"100%",background:color,borderRadius:2}}
            initial={{width:0}} animate={{width:`${score}%`}} transition={{duration:0.8,ease:"easeOut"}}/>
        </div>
      )}
      {finding&&<div style={{fontSize:11.5,color:"#6B7280",lineHeight:1.5}}>{finding}</div>}
    </motion.div>
  );
}

export default function SubmissionDetailPage(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [sub,setSub]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [lightbox,setLightbox]=useState(false);
  const [toast,setToast]=useState("");
  const [showRaw,setShowRaw]=useState(false);

  useEffect(()=>{
    if(!id)return;
    dashboardApi.getSubmission(id)
      .then(r=>setSub(r.data))
      .catch(()=>setError("Submission not found"))
      .finally(()=>setLoading(false));
  },[id]);

  const showToast=(msg:string)=>{
    setToast(msg);
    setTimeout(()=>setToast(""),2500);
  };

  const [acting,setActing]=useState("");
  const act=async(action:"approve"|"reject"|"flag",label:string,status:string)=>{
    if(!id)return;
    setActing(action);
    try{
      await dashboardApi.actionSubmission(id,action);
      setSub((s:any)=>s?{...s,review_status:status}:s);
      showToast(label);
    }catch{
      showToast("Action failed — please try again");
    }finally{
      setActing("");
    }
  };

  const adaBriefing=(s:any)=>{
    if(!s)return"";
    if(s.verdict==="PASS") return `This submission passed all quality checks. GPS verified${s.gps?.address?` in ${s.gps.address.split(",")[0]}`:""}, interview duration is appropriate, and all media checks passed.`;
    if(s.verdict==="FLAG"){
      const flags=(Array.isArray(s.flags)?s.flags:String(s.flags||"").split(",").filter(Boolean)).map((f:string)=>FLAG_LABELS[f]?.label||f).slice(0,2).join("; ");
      return `I found some concerns with this submission. ${flags}. I recommend reviewing before approving for analysis.`;
    }
    return `This submission failed quality verification. ${(Array.isArray(s.flags)?s.flags:String(s.flags||"").split(",").filter(Boolean)).map((f:string)=>FLAG_LABELS[f]?.label||f).slice(0,2).join("; ")}. I recommend rejecting this submission.`;
  };

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:400,color:"#9CA3AF",fontSize:14}}>
      Loading submission...
    </div>
  );
  if(error||!sub) return(
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:16,color:RED,marginBottom:12}}>{error||"Submission not found"}</div>
      <button onClick={()=>navigate("/submissions")} style={{padding:"8px 16px",borderRadius:8,background:BLUE,color:"white",border:"none",cursor:"pointer",fontSize:13}}>
        ← Back to Submissions
      </button>
    </div>
  );

  const checks=sub.checks||{};
  const gps=sub.gps||{};
  const lat=Number(gps.lat)||6.5244;
  const lon=Number(gps.lon)||3.3792;

  return(
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.2}}
      style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:20,right:20,background:"#1A1F3E",color:"white",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
          {toast}
        </div>
      )}

      {/* Lightbox */}
      {lightbox&&sub.image_url&&(
        <div onClick={()=>setLightbox(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <img src={sub.image_url} alt="submission" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,objectFit:"contain"}}/>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <button onClick={()=>navigate("/submissions")}
          style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,background:"white",border:"1px solid #E2E8F0",cursor:"pointer",fontSize:13,fontWeight:600,color:"#374151",fontFamily:"Inter,sans-serif"}}>
          <ArrowLeft size={14}/> Submissions
        </button>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <code style={{fontSize:12,color:"#9CA3AF",background:"#F8FAFF",padding:"4px 10px",borderRadius:6,border:"1px solid #E8EDF5"}}>
            {sub.submission_id?.slice(0,24)}...
          </code>
          <span style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:vclr(sub.verdict)+"15",color:vclr(sub.verdict)}}>
            {sub.verdict}
          </span>
          <span style={{fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:6,background:"#F8FAFF",border:"1px solid #E8EDF5",color:"#374151"}}>
            Grade {sub.grade}
          </span>
          <span style={{fontSize:12,color:"#9CA3AF"}}>{sub.enumerator_id}</span>
          <span style={{fontSize:11,color:"#9CA3AF"}}>{sub.scored_at?new Date(sub.scored_at).toLocaleString():""}</span>
        </div>
        <ScoreRing score={sub.overall_score||0} size={72}/>
      </div>

      {/* Ada Briefing */}
      <div style={{background:"linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)",borderRadius:16,padding:"24px 28px",border:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(255,255,255,.2)",flexShrink:0}}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Ada · Assessment</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.85)",lineHeight:1.7}}>{adaBriefing(sub)}</div>
            {sub.supervisor_action&&(
              <div style={{marginTop:12,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"6px 12px"}}>
                <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>Recommended action:</span>
                <span style={{fontSize:12,fontWeight:600,color:"white"}}>{sub.supervisor_action}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two column */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:20,alignItems:"start"}}>

        {/* LEFT */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* GPS */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:8}}>
              <MapPin size={15} color={BLUE}/><span style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>GPS Location</span>
              <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,
                background:checks.gps?.status==="PASS"?GREEN+"15":AMBER+"15",
                color:checks.gps?.status==="PASS"?GREEN:AMBER}}>
                {checks.gps?.status==="PASS"?"Verified":"Review"}
              </span>
            </div>
            <div style={{height:200}}>
              <MapContainer center={[lat,lon]} zoom={14} style={{height:"100%",width:"100%"}} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png" attribution=""/>
                <CircleMarker center={[lat,lon]} radius={10} pathOptions={{color:"white",weight:2,fillColor:BLUE,fillOpacity:1}}/>
              </MapContainer>
            </div>
            <div style={{padding:"14px 20px",display:"flex",gap:20,flexWrap:"wrap"}}>
              <div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Coordinates</div>
                <div style={{fontSize:12.5,fontFamily:"monospace",color:"#374151"}}>{lat.toFixed(6)}, {lon.toFixed(6)}</div></div>
              {gps.address&&<div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Address</div>
                <div style={{fontSize:12.5,color:"#374151"}}>{gps.address}</div></div>}
              {gps.accuracy_m&&<div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Accuracy</div>
                <div style={{fontSize:12.5,color:Number(gps.accuracy_m)>100?AMBER:GREEN,fontWeight:600}}>{gps.accuracy_m}m</div></div>}
            </div>
          </div>

          {/* Image */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:8}}>
              <Camera size={15} color={PURPLE}/><span style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Image Evidence</span>
            </div>
            {sub.image_url?(
              <div style={{position:"relative",cursor:"zoom-in"}} onClick={()=>setLightbox(true)}>
                <img src={sub.image_url} alt="submission" style={{width:"100%",maxHeight:280,objectFit:"cover"}}/>
                <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,.6)",color:"white",fontSize:11,padding:"4px 8px",borderRadius:6}}>
                  Click to expand
                </div>
              </div>
            ):(
              <div style={{height:140,display:"grid",placeItems:"center",background:"#F8FAFF",color:"#9CA3AF",fontSize:13}}>
                No image submitted
              </div>
            )}
            {checks.image&&(
              <div style={{padding:"14px 20px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px",background:"#F8FAFF",borderRadius:10,border:"1px solid #E8EDF5"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>What Ada saw in this image</div>
                    <div style={{fontSize:12.5,color:"#374151",lineHeight:1.65}}>{checks.image.finding||"No assessment available"}</div>
                  </div>
                </div>
                {checks.image.status&&checks.image.status!=="NOT_AVAILABLE"&&(
                  <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:clr(checks.image.score||0),fontFamily:"monospace"}}>{checks.image.score}/100</span>
                    <div style={{flex:1,height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${checks.image.score||0}%`,height:"100%",background:PURPLE,borderRadius:2}}/>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:8}}>
              <Mic size={15} color={GREEN}/><span style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Audio Evidence</span>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
              {sub.audio_url?(
                <div style={{background:"#F8FAFF",borderRadius:10,padding:14,border:"1px solid #E8EDF5"}}>
                  <audio controls src={sub.audio_url} style={{width:"100%",height:36}}/>
                  <div style={{display:"flex",gap:4,alignItems:"flex-end",height:28,marginTop:10}}>
                    {[4,7,5,9,6,8,4,7,5,6,8,5,7,4,9,6,5,8,7,4].map((h,i)=>(
                      <div key={i} style={{flex:1,background:GREEN,borderRadius:2,height:`${h*3}px`,opacity:0.6}}/>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{height:60,display:"grid",placeItems:"center",background:"#F8FAFF",borderRadius:10,color:"#9CA3AF",fontSize:13}}>
                  No audio submitted
                </div>
              )}
              {checks.audio?.transcript&&(
                <div>
                  <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Interview Transcript</div>
                  <div style={{maxHeight:180,overflowY:"auto",fontSize:12.5,color:"#374151",lineHeight:1.7,background:"#F8FAFF",padding:12,borderRadius:10,border:"1px solid #E8EDF5"}}>
                    {checks.audio.transcript}
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:8}}>
                    {checks.audio.word_count&&<span style={{fontSize:11,color:"#9CA3AF"}}>{checks.audio.word_count} words</span>}
                    {checks.audio.is_genuine_interview!==undefined&&(
                      <span style={{fontSize:11,fontWeight:600,color:checks.audio.is_genuine_interview?GREEN:RED}}>
                        {checks.audio.is_genuine_interview?"✓ Genuine interview":"✗ Not a genuine interview"}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {checks.audio&&(
                <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px",background:"#F8FAFF",borderRadius:10,border:"1px solid #E8EDF5"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>What Ada heard</div>
                    <div style={{fontSize:12.5,color:"#374151",lineHeight:1.65}}>{checks.audio.finding||"No assessment available"}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duplicate */}
          <div style={{background:"white",borderRadius:16,padding:"16px 20px",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Copy size={15} color={CYAN}/><span style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Duplicate Check</span>
              <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,
                background:checks.duplicate?.status==="PASS"?GREEN+"15":RED+"15",
                color:checks.duplicate?.status==="PASS"?GREEN:RED}}>
                {checks.duplicate?.status==="PASS"?"No duplicate":"Duplicate detected"}
              </span>
            </div>
            <div style={{fontSize:12.5,color:"#6B7280",lineHeight:1.65}}>
              {checks.duplicate?.finding||"No duplicate analysis available"}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Score card */}
          <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)",textAlign:"center"}}>
            <ScoreRing score={sub.overall_score||0} size={120}/>
            <div style={{fontSize:36,fontWeight:800,color:clr(sub.overall_score||0),letterSpacing:-2,marginTop:8,lineHeight:1}}>{sub.overall_score}</div>
            <div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>out of 100</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:700,padding:"5px 14px",borderRadius:20,background:vclr(sub.verdict)+"15",color:vclr(sub.verdict)}}>{sub.verdict}</span>
              <span style={{fontSize:13,fontWeight:700,padding:"5px 14px",borderRadius:20,background:"#F8FAFF",border:"1px solid #E8EDF5",color:"#374151"}}>Grade {sub.grade}</span>
            </div>
            {sub.supervisor_action&&<div style={{fontSize:12,color:"#6B7280",marginTop:10,padding:"8px",background:"#F8FAFF",borderRadius:8}}>{sub.supervisor_action}</div>}
            {sub.duration_mins&&<div style={{fontSize:11.5,color:"#9CA3AF",marginTop:8,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><Clock size={12}/>{sub.duration_mins} minutes</div>}
          </div>

          {/* Engine breakdown */}
          <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:12}}>Quality Engines</div>
            <EngineBar label="GPS Accuracy" score={checks.gps?.score||0} status={checks.gps?.status} finding={checks.gps?.finding} weight={28} color={BLUE} icon={<MapPin size={13} color={BLUE}/>}/>
            <EngineBar label="Interview Duration" score={checks.timing?.score||0} status={checks.timing?.status} finding={checks.timing?.finding} weight={25} color={AMBER} icon={<Clock size={13} color={AMBER}/>}/>
            <EngineBar label="Image Quality" score={checks.image?.score||0} status={checks.image?.status} finding={checks.image?.finding} weight={22} color={PURPLE} icon={<Camera size={13} color={PURPLE}/>}/>
            <EngineBar label="Audio Quality" score={checks.audio?.score||0} status={checks.audio?.status} finding={checks.audio?.finding} weight={15} color={GREEN} icon={<Mic size={13} color={GREEN}/>}/>
            <EngineBar label="Duplicate Detection" score={checks.duplicate?.score||0} status={checks.duplicate?.status} finding={checks.duplicate?.finding} weight={10} color={CYAN} icon={<Shield size={13} color={CYAN}/>}/>
          </div>

          {/* Flags */}
          {sub.flags&&sub.flags.length>0&&(
            <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:12}}>Flags</div>
              {(Array.isArray(sub.flags)?sub.flags:String(sub.flags||"").split(",").filter(Boolean)).map((f:string)=>{
                const info=FLAG_LABELS[f]||{label:f,severity:"medium"};
                const sc=info.severity==="high"?RED:info.severity==="medium"?AMBER:"#9CA3AF";
                return(
                  <div key={f} style={{display:"flex",gap:10,marginBottom:10,padding:"10px 12px",background:sc+"08",borderRadius:10,border:`1px solid ${sc}22`}}>
                    <AlertTriangle size={14} color={sc} style={{flexShrink:0,marginTop:1}}/>
                    <div style={{fontSize:12,color:"#374151",lineHeight:1.5}}>{info.label}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:12}}>Actions</div>
            {sub.review_status&&(
              <div style={{fontSize:12,fontWeight:600,marginBottom:10,padding:"8px 12px",borderRadius:8,textAlign:"center",
                background:(sub.review_status==="APPROVED"?GREEN:sub.review_status==="REJECTED"?RED:AMBER)+"15",
                color:sub.review_status==="APPROVED"?GREEN:sub.review_status==="REJECTED"?RED:AMBER}}>
                {sub.review_status==="APPROVED"?"✓ Approved":sub.review_status==="REJECTED"?"Rejected":"Flagged for review"}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button disabled={acting!==""} onClick={()=>act("approve","Marked as approved ✓","APPROVED")}
                style={{padding:"10px",borderRadius:9,background:GREEN,border:"none",cursor:acting?"wait":"pointer",fontSize:13,fontWeight:600,color:"white",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:acting&&acting!=="approve"?0.6:1}}>
                <CheckCircle size={14}/> {acting==="approve"?"Approving…":"Approve"}
              </button>
              <button disabled={acting!==""} onClick={()=>act("reject","Marked as rejected","REJECTED")}
                style={{padding:"10px",borderRadius:9,background:RED,border:"none",cursor:acting?"wait":"pointer",fontSize:13,fontWeight:600,color:"white",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:acting&&acting!=="reject"?0.6:1}}>
                <XCircle size={14}/> {acting==="reject"?"Rejecting…":"Reject"}
              </button>
              <button disabled={acting!==""} onClick={()=>act("flag","Flagged for supervisor review","FLAGGED_FOR_REVIEW")}
                style={{padding:"10px",borderRadius:9,background:AMBER,border:"none",cursor:acting?"wait":"pointer",fontSize:13,fontWeight:600,color:"white",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:acting&&acting!=="flag"?0.6:1}}>
                <AlertTriangle size={14}/> {acting==="flag"?"Flagging…":"Flag for review"}
              </button>
            </div>
          </div>

          {/* Raw details */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5"}}>
            <button onClick={()=>setShowRaw(!showRaw)}
              style={{width:"100%",padding:"14px 20px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12.5,fontWeight:600,color:"#6B7280",fontFamily:"Inter,sans-serif"}}>
              Raw Details <span>{showRaw?"▲":"▼"}</span>
            </button>
            {showRaw&&(
              <div style={{padding:"0 20px 16px",borderTop:"1px solid #F1F5F9"}}>
                {[["Platform",sub.platform],["Form ID",sub.form_id],["Submission Date",sub.submission_date],["Scored At",sub.scored_at]].map(([k,v])=>v?(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F8FAFF",fontSize:12}}>
                    <span style={{color:"#9CA3AF"}}>{k}</span>
                    <span style={{color:"#374151",fontFamily:"monospace",fontSize:11}}>{String(v)}</span>
                  </div>
                ):null)}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}