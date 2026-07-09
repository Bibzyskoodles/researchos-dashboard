import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { dashboardApi } from "../../services/api";
import { useIsMobile } from "../../hooks/useIsMobile";
import { ScoreRing } from "../../components/ui/ScoreRing";
import { EngineBar } from "../../components/ui/EngineBar";
import { ArrowLeft, Copy, CheckCircle, XCircle, AlertTriangle, Clock, MapPin, Camera, Mic, Shield, Cpu, Sparkles } from "lucide-react";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED",CYAN="#06B6D4",ROSE="#E11D48";

type AiScanStatus = "idle"|"loading"|"done"|"error";
interface AiResult { score: number; finding: string; status: "PASS"|"FLAG"|"FAIL" }
interface AiScan { status: AiScanStatus; image?: AiResult; audio?: AiResult; text?: AiResult }

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
  BACK_TO_BACK: {label:"Impossible Back-to-Back — this interview's time overlaps another by the same enumerator",severity:"high"},
  IMAGE_AI_UNAVAILABLE: {label:"Image Check Unavailable — the AI image review could not be completed",severity:"low"},
  AUDIO_AI_UNAVAILABLE: {label:"Audio Check Unavailable — the AI audio review could not be completed",severity:"low"},
  AUDIO_EMPTY: {label:"No Speech Detected — the audio recording contains no speech",severity:"high"},
};

// ScoreRing and EngineBar now live in src/components/ui (shared).

export default function SubmissionDetailPage(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [sub,setSub]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [lightbox,setLightbox]=useState(false);
  const [toast,setToast]=useState("");
  const [showRaw,setShowRaw]=useState(false);
  const [aiScan,setAiScan]=useState<AiScan>({status:"idle"});

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

  const isMobile=useIsMobile();
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

  const analyzeTranscriptForAi = useCallback((transcript: string): AiResult => {
    const text = transcript.trim();
    if (!text || text.length < 40) return { score: 50, finding: "Transcript too short to assess for AI generation.", status: "PASS" };
    const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(s=>s.length>0);
    let riskScore = 0;
    // No filler words (um, uh, err, hmm, like, you know)
    const fillerPattern = /\b(um|uh|err|hmm|like|you know|actually|basically|right)\b/i;
    if (!fillerPattern.test(text)) riskScore += 25;
    // Sentences suspiciously uniform in length
    if (sentences.length >= 3) {
      const lens = sentences.map(s=>s.split(/\s+/).length);
      const avg = lens.reduce((a,b)=>a+b,0)/lens.length;
      const variance = lens.reduce((a,b)=>a+Math.pow(b-avg,2),0)/lens.length;
      if (variance < 6) riskScore += 20;
    }
    // No contractions (very formal/TTS pattern)
    const contractionPattern = /\b(i'm|i've|i'll|i'd|don't|doesn't|didn't|can't|won't|it's|that's|they're|we're|you're|isn't|wasn't|weren't)\b/i;
    if (!contractionPattern.test(text) && text.length > 100) riskScore += 15;
    // Perfect punctuation (no run-ons, no trailing thoughts)
    const runOnCount = (text.match(/,\s+and\s+/gi)||[]).length + (text.match(/,\s+but\s+/gi)||[]).length;
    if (runOnCount === 0 && sentences.length > 4) riskScore += 10;
    // No repetitions or self-corrections
    const selfCorrect = /\b(i mean|sorry|actually i|wait|no wait|i meant)\b/i;
    if (!selfCorrect.test(text)) riskScore += 10;
    const status: "PASS"|"FLAG"|"FAIL" = riskScore >= 50 ? "FAIL" : riskScore >= 30 ? "FLAG" : "PASS";
    const finding = riskScore >= 50
      ? `Transcript shows multiple TTS indicators (score ${riskScore}/80): no filler words, uniform sentence structure, no self-corrections. Likely AI-generated or scripted.`
      : riskScore >= 30
      ? `Some TTS patterns detected (score ${riskScore}/80): unusually clean speech. May warrant review.`
      : `Transcript reads like natural human speech. No significant AI/TTS patterns detected.`;
    return { score: Math.max(0, 100 - Math.round(riskScore * 1.25)), finding, status };
  }, []);

  const runAiScan = useCallback(async () => {
    if (!sub) return;
    setAiScan({ status: "loading" });
    const results: Partial<Pick<AiScan,"image"|"audio"|"text">> = {};

    // --- IMAGE: OpenAI Vision ---
    const openaiKey = process.env.REACT_APP_OPENAI_KEY;
    if (sub.image_url && openaiKey) {
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type":"application/json", "Authorization":`Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Analyse this image submitted as field research evidence. Is it AI-generated, a stock photo, or a real photo taken in the field? Respond with JSON only: {\"ai_probability\": 0-100, \"verdict\": \"genuine\"|\"suspicious\"|\"ai_generated\", \"finding\": \"one sentence\"}. ai_probability 0=definitely real fieldwork photo, 100=definitely AI-generated or stock." },
                { type: "image_url", image_url: { url: sub.image_url, detail: "low" } }
              ]
            }]
          })
        });
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "{}";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        const prob = typeof parsed.ai_probability === "number" ? parsed.ai_probability : 50;
        const authenticity = 100 - prob;
        results.image = {
          score: authenticity,
          finding: parsed.finding || (prob >= 60 ? "Image appears to be AI-generated or stock photography." : "Image appears to be a genuine field photograph."),
          status: authenticity >= 70 ? "PASS" : authenticity >= 45 ? "FLAG" : "FAIL",
        };
      } catch {
        results.image = { score: 0, finding: "AI image scan could not complete.", status: "FLAG" };
      }
    } else if (sub.image_url && !openaiKey) {
      results.image = { score: 50, finding: "OpenAI key not configured — image AI scan unavailable.", status: "FLAG" };
    }

    // --- AUDIO: use existing is_genuine_interview + transcript analysis ---
    const checks = sub.checks || {};
    if (checks.audio?.is_genuine_interview !== undefined) {
      const genuine = checks.audio.is_genuine_interview;
      results.audio = {
        score: genuine ? 85 : 20,
        finding: genuine ? "Audio passed genuine interview verification." : "Audio flagged as not a genuine interview — may be scripted or AI-generated speech.",
        status: genuine ? "PASS" : "FAIL",
      };
    } else if (checks.audio?.transcript) {
      results.audio = analyzeTranscriptForAi(checks.audio.transcript);
    }

    // --- TEXT: transcript analysis (separate from audio engine) ---
    if (checks.audio?.transcript && !results.audio) {
      results.text = analyzeTranscriptForAi(checks.audio.transcript);
    }

    setAiScan({ status: "done", ...results });
  }, [sub, analyzeTranscriptForAi]);

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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 340px",gap:20,alignItems:"start"}}>

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
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
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

          {/* AI Authenticity */}
          <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7}}>AI Authenticity</div>
              <div style={{marginLeft:"auto"}}>
                {aiScan.status==="idle"&&(
                  <button onClick={runAiScan}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:ROSE,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:"white",fontFamily:"Inter,sans-serif"}}>
                    <Sparkles size={12}/> Run AI Scan
                  </button>
                )}
                {aiScan.status==="loading"&&(
                  <span style={{fontSize:11,color:ROSE,fontWeight:600}}>Scanning…</span>
                )}
                {aiScan.status==="done"&&(
                  <button onClick={runAiScan}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:"#F8FAFF",border:"1px solid #E8EDF5",cursor:"pointer",fontSize:11,color:"#6B7280",fontFamily:"Inter,sans-serif"}}>
                    <Cpu size={11}/> Re-scan
                  </button>
                )}
                {aiScan.status==="error"&&(
                  <button onClick={runAiScan}
                    style={{padding:"4px 10px",borderRadius:7,background:RED+"15",border:`1px solid ${RED}33`,cursor:"pointer",fontSize:11,color:RED,fontFamily:"Inter,sans-serif"}}>
                    Retry
                  </button>
                )}
              </div>
            </div>
            {aiScan.status==="idle"&&(
              <div style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"16px 0",lineHeight:1.6}}>
                Scan this submission's image, audio, and transcript for signs of AI generation or synthetic content.
              </div>
            )}
            {aiScan.status==="loading"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,padding:"8px 0"}}>
                {[["Image","Calling OpenAI Vision…"],["Audio","Checking interview authenticity…"],["Transcript","Analysing speech patterns…"]].map(([lbl,msg])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F8FAFF",borderRadius:10,border:"1px solid #E8EDF5"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:ROSE,animation:"pulse 1s infinite"}}/>
                    <span style={{fontSize:12,color:"#374151",fontWeight:600}}>{lbl}</span>
                    <span style={{fontSize:11,color:"#9CA3AF",marginLeft:"auto"}}>{msg}</span>
                  </div>
                ))}
              </div>
            )}
            {aiScan.status==="done"&&(
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {aiScan.image&&(
                  <EngineBar label="Image Authenticity" score={aiScan.image.score} status={aiScan.image.status} finding={aiScan.image.finding} weight={0} color={ROSE} icon={<Camera size={13} color={ROSE}/>}/>
                )}
                {aiScan.audio&&(
                  <EngineBar label="Audio / Speech" score={aiScan.audio.score} status={aiScan.audio.status} finding={aiScan.audio.finding} weight={0} color={ROSE} icon={<Mic size={13} color={ROSE}/>}/>
                )}
                {aiScan.text&&(
                  <EngineBar label="Transcript Patterns" score={aiScan.text.score} status={aiScan.text.status} finding={aiScan.text.finding} weight={0} color={ROSE} icon={<Cpu size={13} color={ROSE}/>}/>
                )}
                {!aiScan.image&&!aiScan.audio&&!aiScan.text&&(
                  <div style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"12px 0"}}>No media available to scan.</div>
                )}
              </div>
            )}
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