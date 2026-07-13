import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { dashboardApi } from "../../services/api";
import { useIsMobile } from "../../hooks/useIsMobile";
import { ScoreRing } from "../../components/ui/ScoreRing";
import { EngineBar } from "../../components/ui/EngineBar";
import { ArrowLeft, Copy, CheckCircle, XCircle, AlertTriangle, Clock, MapPin, Camera, Mic, Shield, Cpu, Sparkles } from "lucide-react";
import { loadEngineConfig } from "../../services/engineConfig";
import { computeTrustIndex, HARD_GATE_FLAGS } from "../../services/trustEngine";
import type { TrustResult } from "../../services/trustEngine";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED",CYAN="#06B6D4",ROSE="#E11D48";

type AiScanStatus = "idle"|"loading"|"done"|"error";
interface AiResult { score: number; finding: string; status: "PASS"|"FLAG"|"FAIL" }
interface AiScan { status: AiScanStatus; image?: AiResult; metadata?: AiResult; download?: AiResult; audio?: AiResult; text?: AiResult }

// Known AI tool signatures in EXIF/XMP/IPTC metadata
const AI_TOOL_SIGNATURES = [
  "DALL-E","dall-e","dall_e","openai",
  "Stable Diffusion","stable-diffusion","stable_diffusion","StableDiffusion","SDXL",
  "Midjourney","midjourney",
  "Adobe Firefly","firefly","adobe firefly",
  "NovelAI","novelai",
  "DreamBooth","dreambooth",
  "Imagen","imagen",
  "Gemini","gemini",
  "Flux","flux",
  "ComfyUI","comfyui",
  "Automatic1111","automatic1111",
  "InvokeAI","invokeai",
  "ControlNet","controlnet",
  "AI generated","AI-generated","ai_generated",
  "artificial intelligence",
  "text-to-image","text_to_image",
  "C2PA","c2pa","content credentials",
];

async function scanImageMetadata(imageUrl: string): Promise<AiResult> {
  try {
    const resp = await fetch(imageUrl, { mode: "cors" });
    if (!resp.ok) {
      return { score: 50, finding: "Image not accessible for metadata scan (may require authentication).", status: "FLAG" };
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Decode the first 64KB as Latin-1 to scan for text signatures in EXIF/XMP/IPTC
    const decoder = new TextDecoder("latin1");
    const textSample = decoder.decode(bytes.slice(0, Math.min(65536, bytes.length)));
    const found: string[] = [];
    for (const sig of AI_TOOL_SIGNATURES) {
      if (textSample.includes(sig)) found.push(sig);
    }
    // Also check for C2PA box (JUMBF marker: bytes 0xFF 0xE2 with "JP" label or "c2pa" string)
    const c2paMarker = textSample.includes("c2pa") || textSample.includes("C2PA") || textSample.includes("content/c2pa");
    if (c2paMarker && !found.includes("C2PA")) found.push("C2PA content credentials");
    if (found.length > 0) {
      const toolNames = found.filter(f => !f.toLowerCase().startsWith("c2pa") && !f.toLowerCase().startsWith("content")).slice(0, 3);
      const hasC2PA = found.some(f => f.toLowerCase().includes("c2pa") || f.toLowerCase().includes("content credential"));
      if (hasC2PA && toolNames.length === 0) {
        return { score: 10, finding: `C2PA Content Credentials detected — this image carries a cryptographic watermark from an AI tool. This is a strong indicator of AI generation.`, status: "FAIL" };
      }
      return {
        score: 5,
        finding: `AI tool signature found in image metadata: ${found.slice(0,3).join(", ")}. This image was almost certainly created or processed by an AI tool.`,
        status: "FAIL",
      };
    }
    return { score: 95, finding: "No AI tool signatures or content credentials found in image metadata.", status: "PASS" };
  } catch {
    return { score: 50, finding: "Metadata scan failed — image may be on a different origin (CORS).", status: "FLAG" };
  }
}

// Web/stock images come in standard dimensions that cameras don't produce.
// Returns a risk note if dimensions match common web formats, null if looks like a real camera shot.
async function checkImageDimensions(blob: Blob): Promise<{ flag: boolean; note: string }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      const ratio = w / h;
      // Common web/social media image dimensions
      const webSizes: Array<[number,number,string]> = [
        [1200, 630, "OG/Twitter card"],
        [1200, 628, "OG/Twitter card"],
        [1080, 1080, "Instagram square"],
        [1080, 1920, "Instagram/Snapchat story"],
        [1920, 1080, "HD widescreen / banner"],
        [1280, 720, "HD 720p"],
        [800, 600, "Standard web image"],
        [640, 480, "VGA web image"],
        [1200, 800, "Stock photo standard"],
        [3000, 2000, "Stock photo hi-res"],
        [4500, 3000, "Stock photo hi-res"],
      ];
      for (const [sw, sh, label] of webSizes) {
        if (Math.abs(w - sw) <= 2 && Math.abs(h - sh) <= 2) {
          resolve({ flag: true, note: `Exact web dimension match: ${w}×${h}px (${label}) — cameras don't produce this size.` });
          return;
        }
      }
      // Square images from phones are usually cropped — flag if very round ratio and not a camera portrait/landscape
      if (Math.abs(ratio - 1) < 0.02 && w >= 1000) {
        resolve({ flag: true, note: `Perfect square image (${w}×${h}px) — common for social media crops, not raw camera output.` });
        return;
      }
      // Suspiciously small for a field photo
      if (w < 400 || h < 400) {
        resolve({ flag: true, note: `Very small image (${w}×${h}px) — genuine field photos from smartphones are typically larger.` });
        return;
      }
      resolve({ flag: false, note: `Dimensions ${w}×${h}px — consistent with a real camera or smartphone shot.` });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ flag: false, note: "" }); };
    img.src = url;
  });
}

const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;
const vclr=(v:string)=>v==="PASS"?GREEN:v==="FLAG"?AMBER:RED;
const riskClr=(r:string)=>r==="VERY_LOW"||r==="LOW"?GREEN:r==="MEDIUM"?AMBER:r==="HIGH"?"#EA580C":RED;

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
  AI_GENERATED_IMAGE: {label:"AI-Generated Image — the submitted photo shows signs of being AI-generated or synthetic, not a genuine field photo",severity:"high"},
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
  const [imageError,setImageError]=useState(false);
  const [engineCfgVersion,setEngineCfgVersion]=useState(0);
  const [rescoreOpen,setRescoreOpen]=useState(false);
  const [rescoreLevel,setRescoreLevel]=useState<"recompute"|"full">("recompute");
  const [rescoring,setRescoring]=useState(false);
  const [rescoreResult,setRescoreResult]=useState<any>(null);
  const [rescoreError,setRescoreError]=useState("");

  useEffect(()=>{
    if(!id)return;
    dashboardApi.getSubmission(id)
      .then(r=>{
        const data=r.data;
        // KoboToolbox stores audio/image as _attachments array.
        // Normalise them so the rest of the page can use audio_url / image_url.
        if(!data.audio_url&&Array.isArray(data._attachments)){
          const audioAtt=data._attachments.find((a:any)=>{
            const name=String(a.filename||a.name||"").toLowerCase();
            return name.endsWith(".mp3")||name.endsWith(".m4a")||name.endsWith(".ogg")||name.endsWith(".wav")||name.endsWith(".aac")||name.endsWith(".3gp")||name.endsWith(".amr");
          });
          if(audioAtt) data.audio_url=audioAtt.download_url||audioAtt.url||audioAtt.filename;
        }
        if(!data.image_url&&Array.isArray(data._attachments)){
          const imgAtt=data._attachments.find((a:any)=>{
            const name=String(a.filename||a.name||"").toLowerCase();
            return name.endsWith(".jpg")||name.endsWith(".jpeg")||name.endsWith(".png")||name.endsWith(".webp")||name.endsWith(".gif");
          });
          if(imgAtt) data.image_url=imgAtt.download_url||imgAtt.url||imgAtt.filename;
        }
        setSub(data);
      })
      .catch(()=>setError("Submission not found"))
      .finally(()=>setLoading(false));
  },[id]);

  // Re-compute when engine config changes (e.g. user saves new weights in Settings)
  useEffect(()=>{
    const handler=()=>setEngineCfgVersion(v=>v+1);
    window.addEventListener("fs-engine-config-changed",handler);
    return ()=>window.removeEventListener("fs-engine-config-changed",handler);
  },[]);

  // Auto-run AI scan once when submission loads and has an image or audio
  useEffect(()=>{
    if(!sub)return;
    if(sub.image_url||sub.audio_url||sub.checks?.audio?.transcript){
      const t=setTimeout(()=>runAiScan(),1200);
      return ()=>clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sub?.submission_id]);

  const showToast=(msg:string)=>{
    setToast(msg);
    setTimeout(()=>setToast(""),2500);
  };

  const isMobile=useIsMobile();
  const [acting,setActing]=useState("");
  const [overrideTarget,setOverrideTarget]=useState("");
  const [overrideReason,setOverrideReason]=useState("");
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

  const runRescore=async()=>{
    if(!id)return;
    setRescoring(true);
    setRescoreError("");
    try{
      const r=await dashboardApi.rescoreSubmission(id,rescoreLevel);
      setRescoreResult(r.data);
      if(r.data?.changed){
        // Reflect the new verdict/score immediately without a full page reload.
        setSub((s:any)=>s?{...s,overall_score:r.data.current.score,verdict:r.data.current.verdict,flags:r.data.current.flags}:s);
      }
    }catch(e:any){
      setRescoreError(e?.response?.data?.error||"Rescore failed — please try again.");
    }finally{
      setRescoring(false);
    }
  };

  // Kept as fallback when no OpenAI key available
  const analyzeTranscriptHeuristic = useCallback((transcript: string): AiResult => {
    const text = transcript.trim();
    if (!text || text.length < 40) return { score: 50, finding: "Transcript too short to assess for AI generation.", status: "PASS" };
    const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(s=>s.length>0);
    let riskScore = 0;
    if (!/\b(um|uh|err|hmm|like|you know|actually|basically|right)\b/i.test(text)) riskScore += 25;
    if (sentences.length >= 3) {
      const lens = sentences.map(s=>s.split(/\s+/).length);
      const avg = lens.reduce((a,b)=>a+b,0)/lens.length;
      const variance = lens.reduce((a,b)=>a+Math.pow(b-avg,2),0)/lens.length;
      if (variance < 6) riskScore += 20;
    }
    if (!/\b(i'm|i've|i'll|i'd|don't|doesn't|didn't|can't|won't|it's|that's|they're|we're|you're|isn't|wasn't|weren't)\b/i.test(text) && text.length > 100) riskScore += 15;
    const runOnCount = (text.match(/,\s+and\s+/gi)||[]).length + (text.match(/,\s+but\s+/gi)||[]).length;
    if (runOnCount === 0 && sentences.length > 4) riskScore += 10;
    if (!/\b(i mean|sorry|actually i|wait|no wait|i meant)\b/i.test(text)) riskScore += 10;
    const status: "PASS"|"FLAG"|"FAIL" = riskScore >= 50 ? "FAIL" : riskScore >= 30 ? "FLAG" : "PASS";
    const finding = riskScore >= 50
      ? `Transcript shows multiple TTS indicators: no filler words, uniform sentence structure, no self-corrections. Likely AI-generated or scripted.`
      : riskScore >= 30
      ? `Some TTS patterns detected: unusually clean speech. May warrant review.`
      : `Transcript reads like natural human speech. No significant AI/TTS patterns detected.`;
    return { score: Math.max(0, 100 - Math.round(riskScore * 1.25)), finding, status };
  }, []);

  // Every AI-authenticity opinion here is sourced from the backend's engine
  // (sub.checks.image / sub.checks.audio) — the one place that actually ran
  // the filename check, metadata scan, and GPT-4o vision call server-side.
  // This used to re-run its own GPT-4o calls directly from the browser using
  // a REACT_APP_OPENAI_KEY baked into the JS bundle — a key any visitor could
  // read out of devtools, and a second opinion that could (and did) contradict
  // the real, authoritative flag. Client-side re-scanning of image bytes for
  // metadata/dimensions is kept below since it costs nothing and needs no key.
  const runAiScan = useCallback(async () => {
    if (!sub) return;
    setAiScan({ status: "loading" });
    const results: Partial<Pick<AiScan,"image"|"metadata"|"download"|"audio"|"text">> = {};

    if (sub.image_url) {
      let imageBlob: Blob | null = null;
      try {
        const imgResp = await fetch(sub.image_url, { mode: "cors" });
        if (imgResp.ok) imageBlob = await imgResp.blob();
      } catch { /* CORS blocked — fall back to URL-based metadata scan */ }

      const [metaResult, dimResult] = await Promise.all([
        // METADATA: EXIF/XMP/C2PA AI tool signatures (client-side, no API key)
        imageBlob
          ? (async () => {
              const arr = await imageBlob!.arrayBuffer();
              const bytes = new Uint8Array(arr);
              const text = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(65536, bytes.length)));
              const found: string[] = [];
              for (const sig of AI_TOOL_SIGNATURES) { if (text.includes(sig)) found.push(sig); }
              const c2pa = text.includes("c2pa") || text.includes("C2PA") || text.includes("content/c2pa");
              if (c2pa && !found.some(f=>f.toLowerCase().includes("c2pa"))) found.push("C2PA content credentials");
              if (found.length > 0) {
                return { score: 5, finding: `AI tool signature in metadata: ${found.slice(0,3).join(", ")}. Near-certain AI origin.`, status: "FAIL" as const };
              }
              return { score: 95, finding: "No AI tool signatures or C2PA watermarks in image metadata.", status: "PASS" as const };
            })()
          : scanImageMetadata(sub.image_url),

        // DIMENSIONS: detect standard web/social/stock image sizes (no API key)
        imageBlob
          ? checkImageDimensions(imageBlob)
          : Promise.resolve({ flag: false, note: "" }),
      ]);

      results.metadata = metaResult;

      // AI-GENERATION VERDICT: sourced from the backend's authoritative engine
      // (includes the filename check, metadata scan, and GPT-4o vision call).
      const imgCheck = sub.checks?.image;
      if (imgCheck && imgCheck.status !== "NOT_AVAILABLE") {
        const isAi = !!imgCheck.ai_generated;
        const conf = imgCheck.ai_generated_confidence || "LOW";
        const authScore = isAi ? (conf === "HIGH" ? 5 : conf === "MEDIUM" ? 25 : 60) : Math.max(imgCheck.score ?? 70, 70);
        const sigs: string[] = imgCheck.ai_generated_signals || [];
        results.image = {
          score: authScore,
          finding: sigs.length ? `${imgCheck.finding || ""} Signals: ${sigs.join("; ")}`.trim() : (imgCheck.finding || "No AI-generation signals detected."),
          status: isAi ? (conf === "HIGH" ? "FAIL" : "FLAG") : "PASS",
        };
      } else {
        results.image = { score: 50, finding: "Backend AI-generation check unavailable for this submission.", status: "FLAG" };
      }

      results.download = dimResult.flag
        ? { score: 30, finding: dimResult.note, status: "FAIL" }
        : { score: 90, finding: dimResult.note || "Dimensions consistent with a real camera/smartphone shot.", status: "PASS" };
    }

    // AUDIO: backend engine result when available, heuristic transcript scan otherwise
    const checks = sub.checks || {};
    if (checks.audio?.is_genuine_interview !== undefined) {
      const genuine = checks.audio.is_genuine_interview;
      results.audio = {
        score: genuine ? 85 : 20,
        finding: genuine ? "Audio engine verified this as a genuine interview." : "Audio engine flagged this as not a genuine interview — may be scripted or AI-generated speech.",
        status: genuine ? "PASS" : "FAIL",
      };
    } else if (checks.audio?.transcript) {
      results.text = analyzeTranscriptHeuristic(checks.audio.transcript);
    } else if (sub.audio_url && !checks.audio?.transcript) {
      results.audio = {
        score: 50,
        finding: "Audio file present but our transcription engine hasn't produced a transcript for it yet — it may still be processing, or the recording may be empty or unreadable. Speech analysis will run automatically once the transcript is ready; try Refresh in a few minutes.",
        status: "FLAG",
      };
    }

    setAiScan({ status: "done", ...results });
  }, [sub, analyzeTranscriptHeuristic]);

  const adaBriefing=(s:any, verdict:"PASS"|"FLAG"|"REJECT", trustResult?: TrustResult)=>{
    if(!s)return"";
    const flagArr:string[]=Array.isArray(s.flags)?s.flags:String(s.flags||"").split(",").map((f:string)=>f.trim()).filter(Boolean);
    const flagDesc=flagArr.map((f:string)=>FLAG_LABELS[f]?.label||f);
    const gpsOk=!flagArr.some((f:string)=>["GPS_PARSE_ERROR","NO_GPS","GPS_OUTSIDE_NIGERIA"].includes(f));
    // Never claim "all checks passed" when evidence is actually missing —
    // completeness < 100% means at least one channel wasn't measured, which
    // is a materially different situation from every channel measuring clean.
    const missingLabels = (trustResult?.breakdown || [])
      .filter(b => b.presence === "ABSENT" || b.presence === "PRESENT_UNMEASURED")
      .map(b => b.label);
    const completenessPct = trustResult ? Math.round(trustResult.completeness * 100) : 100;
    const missingNote = missingLabels.length > 0
      ? ` ${missingLabels.length === 1 ? missingLabels[0] : missingLabels.slice(0,-1).join(", ") + " and " + missingLabels[missingLabels.length-1]} ${missingLabels.length === 1 ? "wasn't" : "weren't"} available for this submission — that's excluded from scoring, not held against the enumerator, but it does mean this verdict is based on ${completenessPct}% of possible evidence.`
      : "";
    // A hard-gated verdict (e.g. AI_GENERATED_IMAGE, DUPLICATE_SUBMISSION) is
    // driven entirely by ONE engine's own finding — that engine must be named
    // and quoted here. Without this, the narrative could discuss five other
    // engines being unavailable while never mentioning the one that actually
    // decided the verdict (previously observed: verdict REJECT for
    // AI_GENERATED_IMAGE, but the Image engine itself was never described).
    const hardGateFlag = flagArr.find(f => HARD_GATE_FLAGS.has(f));
    const hardGateEngine = hardGateFlag
      ? trustResult?.breakdown.find(b => b.flagOverride === hardGateFlag)
      : undefined;
    const hardGateFinding = hardGateEngine ? s.checks?.[hardGateEngine.key]?.finding : "";
    const hardGateNote = hardGateEngine
      ? ` ${hardGateEngine.label} is why: ${hardGateFinding || FLAG_LABELS[hardGateFlag!]?.label || hardGateFlag} (score forced to ${hardGateEngine.effectiveScore}, hard gate — this alone determines the verdict regardless of every other engine).`
      : "";
    if(verdict==="PASS"){
      if(flagArr.length===0){
        return `This submission passed every check it was measured against. GPS verified${s.gps?.address?` in ${s.gps.address.split(",")[0]}`:""}, interview duration is appropriate.${missingNote}`;
      }
      // PASS verdict but has minor flags — be transparent
      return `This submission passed the quality threshold despite ${flagArr.length===1?"a concern":"some concerns"}: ${flagDesc.slice(0,2).join("; ")}. ${gpsOk?"GPS looks good.":"Note: GPS data is unreliable for this submission."}${missingNote} Review the flags before approving for analysis.`;
    }
    if(verdict==="FLAG"){
      const flagList=flagDesc.slice(0,2).join("; ");
      return `I found some concerns with this submission. ${flagList}.${hardGateNote}${missingNote} I recommend reviewing before approving for analysis.`;
    }
    return `This submission failed quality verification. ${flagDesc.slice(0,2).join("; ")}.${hardGateNote}${missingNote} I recommend rejecting this submission.`;
  };

  // Memoized so detail score always matches list (same config snapshot, re-runs on config change)
  const engineCfg = useMemo(() => loadEngineConfig(), [engineCfgVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const trust: TrustResult = useMemo(() => computeTrustIndex(sub||{}, engineCfg), [sub, engineCfg]);

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:400,color:"#9CA3AF",fontSize:14}}>
      Loading submission...
    </div>
  );
  if(error||!sub) return(
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:16,color:RED,marginBottom:12}}>{error||"Submission not found"}</div>
      <button onClick={()=>navigate(-1)} style={{padding:"8px 16px",borderRadius:8,background:BLUE,color:"white",border:"none",cursor:"pointer",fontSize:13}}>
        ← Back to Submissions
      </button>
    </div>
  );

  const checks=sub.checks||{};
  const gps=sub.gps||{};
  const flags:string[]=Array.isArray(sub.flags)?sub.flags:String(sub.flags||"").split(",").map((f:string)=>f.trim()).filter(Boolean);
  const gpsErrorFlags=["GPS_PARSE_ERROR","NO_GPS","GPS_OUTSIDE_NIGERIA"];
  const hasGpsError=flags.some((f:string)=>gpsErrorFlags.includes(f));
  const lat=gps.lat&&!isNaN(Number(gps.lat))?Number(gps.lat):null;
  const lon=gps.lon&&!isNaN(Number(gps.lon))?Number(gps.lon):null;
  const canShowMap=!hasGpsError&&lat!==null&&lon!==null;

  // The Trust Index is the one number, on every surface (Bible §0, principle 5).
  const displayScore = trust.trustIndex;
  const algorithmicVerdict: "PASS"|"FLAG"|"REJECT" = trust.verdict;
  // A supervisor override changes what's DISPLAYED, never the algorithm's
  // own call underneath — always shown alongside it, never in its place.
  const displayVerdict: "PASS"|"FLAG"|"REJECT" = (sub?.verdict_override as any) || algorithmicVerdict;
  const isOverridden = !!sub?.verdict_override && sub.verdict_override !== algorithmicVerdict;

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
        <button onClick={()=>navigate(-1)}
          style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,background:"white",border:"1px solid #E2E8F0",cursor:"pointer",fontSize:13,fontWeight:600,color:"#374151",fontFamily:"Inter,sans-serif"}}>
          <ArrowLeft size={14}/> Submissions
        </button>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <code style={{fontSize:12,color:"#9CA3AF",background:"#F8FAFF",padding:"4px 10px",borderRadius:6,border:"1px solid #E8EDF5"}}>
            {sub.submission_id?.slice(0,24)}…
          </code>
          <span style={{fontSize:13,fontWeight:800,color:clr(displayScore),letterSpacing:-.5}}>{displayScore}</span>
          <span style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:vclr(displayVerdict)+"15",color:vclr(displayVerdict)}}>
            {displayVerdict}
          </span>
          <span style={{fontSize:12,color:"#9CA3AF"}}>{(sub as any).enumerator_name||sub.enumerator_id}</span>
          <span style={{fontSize:11,color:"#CBD5E1"}}>{sub.scored_at?new Date(sub.scored_at).toLocaleString():""}</span>
        </div>
        <button onClick={()=>{setRescoreOpen(true);setRescoreResult(null);setRescoreError("");}}
          title="Re-evaluate this submission under current scoring rules — scores are frozen at the time they were first computed and don't update automatically when detection logic improves"
          style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,background:"white",border:"1px solid #E2E8F0",cursor:"pointer",fontSize:13,fontWeight:600,color:"#374151",fontFamily:"Inter,sans-serif"}}>
          <Cpu size={14}/> Rescore
        </button>
      </div>

      {/* Rescore modal */}
      {rescoreOpen&&(
        <div onClick={()=>!rescoring&&setRescoreOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(8,13,26,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"white",borderRadius:16,padding:24,width:420,maxWidth:"100%",boxShadow:"0 20px 60px rgba(8,13,26,.35)"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#080D1A",marginBottom:4}}>Rescore this submission?</div>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:16,lineHeight:1.5}}>
              Scores are frozen the moment a submission arrives. If detection logic has improved since, the stored verdict may be out of date.
            </div>

            {!rescoreResult&&(
              <>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                  <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:9,border:`1px solid ${rescoreLevel==="recompute"?BLUE:"#E2E8F0"}`,background:rescoreLevel==="recompute"?"#F8FAFF":"white",cursor:"pointer"}}>
                    <input type="radio" checked={rescoreLevel==="recompute"} onChange={()=>setRescoreLevel("recompute")} style={{marginTop:3}}/>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:700,color:"#080D1A"}}>Quick recompute</div>
                      <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>Apply current scoring rules to the evidence already collected. Instant, no cost.</div>
                    </div>
                  </label>
                  <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:9,border:`1px solid ${rescoreLevel==="full"?BLUE:"#E2E8F0"}`,background:rescoreLevel==="full"?"#F8FAFF":"white",cursor:"pointer"}}>
                    <input type="radio" checked={rescoreLevel==="full"} onChange={()=>setRescoreLevel("full")} style={{marginTop:3}}/>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:700,color:"#080D1A"}}>Full rescore</div>
                      <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>Re-run every AI check from the original submission. Takes ~30 seconds; only available if this submission was ingested recently enough to have a stored raw payload.</div>
                    </div>
                  </label>
                </div>
                {rescoreError&&(
                  <div style={{fontSize:12,color:RED,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",marginBottom:14}}>{rescoreError}</div>
                )}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button onClick={()=>setRescoreOpen(false)} disabled={rescoring}
                    style={{padding:"8px 16px",borderRadius:8,border:"1px solid #E2E8F0",background:"white",cursor:rescoring?"default":"pointer",fontSize:12.5,fontWeight:600,color:"#6B7280",fontFamily:"Inter,sans-serif"}}>Cancel</button>
                  <button onClick={runRescore} disabled={rescoring}
                    style={{padding:"8px 18px",borderRadius:8,border:"none",background:BLUE,cursor:rescoring?"default":"pointer",fontSize:12.5,fontWeight:700,color:"white",fontFamily:"Inter,sans-serif",opacity:rescoring?.7:1}}>
                    {rescoring?"Rescoring…":"Rescore"}
                  </button>
                </div>
              </>
            )}

            {rescoreResult&&(
              <div>
                <div style={{fontSize:13,fontWeight:800,color:"#080D1A",marginBottom:12}}>Rescore complete</div>
                {rescoreResult.changed?(
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                      <span style={{color:"#9CA3AF"}}>Trust Index:</span>
                      <strong style={{fontFamily:"monospace"}}>{rescoreResult.previous.score}</strong>
                      <span style={{color:"#9CA3AF"}}>→</span>
                      <strong style={{fontFamily:"monospace",color:clr(rescoreResult.current.score)}}>{rescoreResult.current.score}</strong>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                      <span style={{color:"#9CA3AF"}}>Verdict:</span>
                      <strong>{rescoreResult.previous.verdict}</strong>
                      <span style={{color:"#9CA3AF"}}>→</span>
                      <strong style={{color:vclr(rescoreResult.current.verdict)}}>{rescoreResult.current.verdict}</strong>
                    </div>
                    {rescoreResult.current.flags?.filter((f:string)=>!rescoreResult.previous.flags?.includes(f)).map((f:string)=>(
                      <div key={f} style={{fontSize:12,color:RED,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:7,padding:"5px 10px",width:"fit-content"}}>New flag: {f}</div>
                    ))}
                  </div>
                ):(
                  <div style={{fontSize:13,color:"#6B7280",marginBottom:16}}>No change — this submission was already scored correctly under current logic.</div>
                )}
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <button onClick={()=>window.location.reload()}
                    style={{padding:"8px 18px",borderRadius:8,border:"none",background:BLUE,cursor:"pointer",fontSize:12.5,fontWeight:700,color:"white",fontFamily:"Inter,sans-serif"}}>
                    Done — refresh page
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ada Briefing */}
      <div style={{background:"linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)",borderRadius:16,padding:"24px 28px",border:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(255,255,255,.2)",flexShrink:0}}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Ada · Assessment</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.85)",lineHeight:1.7}}>{adaBriefing(sub, displayVerdict, trust)}</div>
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
              {(()=>{
                const gpsFlag=flags.find((f:string)=>["GPS_PARSE_ERROR","NO_GPS","GPS_OUTSIDE_NIGERIA","LOW_GPS_ACCURACY","GPS_POOR_ACCURACY","OUTSIDE_ASSIGNED_ZONE"].includes(f));
                if(gpsFlag)return(
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:RED+"15",color:RED,display:"flex",alignItems:"center",gap:4}}>
                    <AlertTriangle size={10}/>{gpsFlag.replace(/_/g," ")}
                  </span>
                );
                return(
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,
                    background:checks.gps?.status==="PASS"?GREEN+"15":AMBER+"15",
                    color:checks.gps?.status==="PASS"?GREEN:AMBER}}>
                    {checks.gps?.status==="PASS"?"Verified":"Review"}
                  </span>
                );
              })()}
            </div>
            {canShowMap?(
              <>
                <div style={{height:200}}>
                  <MapContainer center={[lat!,lon!]} zoom={14} style={{height:"100%",width:"100%"}} scrollWheelZoom={false}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <CircleMarker center={[lat!,lon!]} radius={10} pathOptions={{color:"white",weight:2,fillColor:BLUE,fillOpacity:1}}/>
                  </MapContainer>
                </div>
                <div style={{padding:"14px 20px",display:"flex",gap:20,flexWrap:"wrap"}}>
                  <div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Coordinates</div>
                    <div style={{fontSize:12.5,fontFamily:"monospace",color:"#374151"}}>{lat!.toFixed(6)}, {lon!.toFixed(6)}</div></div>
                  {gps.address&&<div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Address</div>
                    <div style={{fontSize:12.5,color:"#374151"}}>{gps.address}</div></div>}
                  {gps.accuracy_m&&<div><div style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Accuracy</div>
                    <div style={{fontSize:12.5,color:Number(gps.accuracy_m)>100?AMBER:GREEN,fontWeight:600}}>{gps.accuracy_m}m</div></div>}
                </div>
                {/* Assigned-zone verification (Bible §6.7) */}
                {trust.zoneCheck?(
                  <div style={{margin:"0 20px 14px",padding:"10px 14px",borderRadius:10,
                    background:trust.zoneCheck.withinZone?"#F0FDF4":"#FFF5F5",
                    border:`1px solid ${trust.zoneCheck.withinZone?"#BBF7D0":"#FECACA"}`,
                    display:"flex",alignItems:"center",gap:8}}>
                    {trust.zoneCheck.withinZone?<CheckCircle size={14} color={GREEN}/>:<XCircle size={14} color={RED}/>}
                    <div style={{fontSize:12,color:trust.zoneCheck.withinZone?"#166534":"#991B1B",lineHeight:1.5}}>
                      {trust.zoneCheck.withinZone
                        ?<>Enumeration happened <strong>{trust.zoneCheck.distanceM.toLocaleString()} m</strong> from the assigned location{trust.zoneCheck.label?<> (<strong>{trust.zoneCheck.label}</strong>)</>:null} — within the {trust.zoneCheck.radiusM.toLocaleString()} m radius. Presence verified.</>
                        :<>Enumeration happened <strong>{trust.zoneCheck.distanceM.toLocaleString()} m</strong> from the assigned location{trust.zoneCheck.label?<> (<strong>{trust.zoneCheck.label}</strong>)</>:null} — outside the {trust.zoneCheck.radiusM.toLocaleString()} m radius. This is treated as a critical violation.</>}
                    </div>
                  </div>
                ):(
                  <div style={{margin:"0 20px 14px",padding:"8px 14px",borderRadius:10,background:"#F8FAFF",border:"1px solid #EEF2F8",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>
                    No assigned location configured for this project — showing where enumeration happened. Set an expected location in <span style={{color:BLUE,cursor:"pointer",textDecoration:"underline"}} onClick={()=>navigate("/settings",{state:{section:"engine"}})}>Engine Settings</span> to verify enumerator presence automatically.
                  </div>
                )}
              </>
            ):(
              <div style={{padding:"28px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,background:"#FEF2F2"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:RED+"15",display:"grid",placeItems:"center"}}>
                  <MapPin size={20} color={RED}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:700,color:RED,marginBottom:4}}>
                    {flags.includes("NO_GPS")?"No GPS Data Recorded":"GPS Data Unreadable"}
                  </div>
                  <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.6,maxWidth:260}}>
                    {flags.includes("NO_GPS")
                      ?"This submission has no location data. The map cannot be displayed."
                      :"The GPS coordinates in this submission could not be parsed. Displaying a map would show a misleading location."}
                  </div>
                </div>
                {(gps.lat||gps.lon)&&(
                  <div style={{fontSize:11,fontFamily:"monospace",color:"#9CA3AF",background:"#F8FAFF",padding:"4px 10px",borderRadius:6,border:"1px solid #E8EDF5"}}>
                    Raw value: {String(gps.lat)}, {String(gps.lon)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Image */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:8}}>
              <Camera size={15} color={PURPLE}/><span style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Image Evidence</span>
            </div>
            {sub.image_url&&!imageError?(
              <div style={{position:"relative",cursor:"zoom-in"}} onClick={()=>setLightbox(true)}>
                <img
                  src={sub.image_url}
                  alt="submission"
                  style={{width:"100%",maxHeight:280,objectFit:"cover",display:"block"}}
                  onError={()=>setImageError(true)}
                />
                <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,.6)",color:"white",fontSize:11,padding:"4px 8px",borderRadius:6}}>
                  Click to expand
                </div>
              </div>
            ):sub.image_url&&imageError?(
              <div style={{padding:"24px 20px",background:"#FEF2F2",display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center"}}>
                <Camera size={24} color={RED} style={{opacity:.5}}/>
                <div style={{fontSize:13,fontWeight:600,color:RED}}>Image could not be loaded</div>
                <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.6,maxWidth:300}}>
                  The image URL requires authentication or is no longer accessible. This is common with KoboToolbox attachments that need a valid session cookie to serve.
                </div>
                <a href={sub.image_url} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:11,color:BLUE,textDecoration:"underline",wordBreak:"break-all",maxWidth:300}}>
                  Try opening directly ↗
                </a>
              </div>
            ):(
              <div style={{height:140,display:"grid",placeItems:"center",background:"#F8FAFF",color:"#9CA3AF",fontSize:13}}>
                No image submitted
              </div>
            )}
            {checks.image&&(
              <div style={{padding:"14px 20px",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px",background:"#F8FAFF",borderRadius:10,border:"1px solid #E8EDF5"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Image quality assessment</div>
                    <div style={{fontSize:12.5,color:"#374151",lineHeight:1.65}}>{checks.image.finding||"No assessment available"}</div>
                  </div>
                </div>
                {checks.image.status&&checks.image.status!=="NOT_AVAILABLE"&&(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"#9CA3AF"}}>Quality:</span>
                    <span style={{fontSize:12,fontWeight:700,color:clr(checks.image.score||0),fontFamily:"monospace"}}>{checks.image.score}/100</span>
                    <div style={{flex:1,height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${checks.image.score||0}%`,height:"100%",background:PURPLE,borderRadius:2}}/>
                    </div>
                  </div>
                )}
                <div style={{fontSize:11,color:"#9CA3AF",padding:"6px 10px",background:"#F8FAFF",borderRadius:7,border:"1px solid #E8EDF5"}}>
                  ⓘ This score measures image <strong>quality</strong> (clarity, blur, exposure) — not whether the image is AI-generated. See "AI Authenticity" below for fraud detection.
                </div>
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
                <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:"#92400E",marginBottom:4}}>Audio not found in this submission</div>
                  <div style={{fontSize:11.5,color:"#78350F",lineHeight:1.6}}>
                    If you recorded audio using KoboToolbox's Record button, it is stored as an attachment. The scoring engine may not have received it. Check that your KoboToolbox form sends all attachments via the webhook (Settings → REST Services → check "Send all attachments").
                  </div>
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

          {/* Trust card — the one number, fully explainable (Bible §10) */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",border:`1px solid ${trust.status==="INELIGIBLE"?"#FECACA":"#E8EDF5"}`,boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            {/* Top: trust index + verdict + risk */}
            <div style={{padding:"24px 20px 16px",textAlign:"center",borderBottom:"1px solid #F1F5F9"}}>
              <ScoreRing score={displayScore} size={100}/>
              <div style={{fontSize:44,fontWeight:800,color:clr(displayScore),letterSpacing:-3,marginTop:10,lineHeight:1}}>{displayScore}</div>
              <div style={{fontSize:11,color:"#9CA3AF",marginBottom:12,letterSpacing:.3}}>TRUST INDEX</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700,padding:"5px 16px",borderRadius:20,background:vclr(displayVerdict)+"18",color:vclr(displayVerdict)}}>{displayVerdict}</span>
                <span style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:20,background:riskClr(trust.risk)+"15",color:riskClr(trust.risk)}}>
                  {trust.risk.replace("_"," ")} RISK · {trust.recommendation}
                </span>
              </div>
              {sub.duration_mins&&<div style={{fontSize:11.5,color:"#9CA3AF",marginTop:10,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><Clock size={12}/>{sub.duration_mins} min interview</div>}
            </div>

            {/* Ineligible banner */}
            {trust.status==="INELIGIBLE"&&(
              <div style={{margin:"14px 20px 0",padding:"12px 14px",background:"#FFF5F5",border:"1px solid #FECACA",borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:RED,display:"flex",alignItems:"center",gap:6,marginBottom:4}}><XCircle size={13}/>Not eligible for scoring</div>
                {trust.ineligibleReasons.map((r,i)=>(<div key={i} style={{fontSize:11.5,color:"#991B1B",lineHeight:1.6}}>{r}</div>))}
              </div>
            )}
            {trust.status==="UNVERIFIED"&&(
              <div style={{margin:"14px 20px 0",padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FEF3C7",borderRadius:10,fontSize:11.5,color:"#92400E",lineHeight:1.6}}>
                Scored by an earlier pipeline — per-engine evidence detail is unavailable, so the backend score is shown unchanged at low confidence.
              </div>
            )}

            {/* Evidence completeness + confidence */}
            {trust.status!=="UNVERIFIED"&&(
              <div style={{display:"flex",gap:10,padding:"14px 20px 0"}}>
                {[{label:"Evidence completeness",val:trust.completeness},{label:"Measurement confidence",val:trust.confidence}].map(m=>(
                  <div key={m.label} style={{flex:1,padding:"10px 12px",background:"#F8FAFF",borderRadius:10,border:"1px solid #EEF2F8"}}>
                    <div style={{fontSize:9.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>{m.label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:5,background:"#EEF2F8",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${Math.round(m.val*100)}%`,height:"100%",background:m.val>=.9?GREEN:m.val>=.6?AMBER:RED,borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:"#374151",fontVariantNumeric:"tabular-nums"}}>{Math.round(m.val*100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Evidence breakdown — every point traceable */}
            <div style={{padding:"14px 20px"}}>
              <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>How this trust index was calculated</div>
              {(()=>{
                const COLORS:Record<string,string>={gps:BLUE,duration:AMBER,image:PURPLE,audio:GREEN,duplicate:CYAN,text_ai:ROSE};
                const ICONS:Record<string,React.ReactElement>={
                  gps:<MapPin size={11}/>,duration:<Clock size={11}/>,image:<Camera size={11}/>,
                  audio:<Mic size={11}/>,duplicate:<Shield size={11}/>,text_ai:<Cpu size={11}/>,
                };
                const included=trust.breakdown.filter(b=>b.included);
                const excluded=trust.breakdown.filter(b=>!b.included&&b.requirement!=="DISABLED");
                return(
                  <>
                    {included.map(b=>{
                      const missing=b.presence==="ABSENT"&&b.effectiveScore===0&&!b.flagOverride;
                      const col=b.flagOverride||missing?RED:COLORS[b.key]||BLUE;
                      const maxPts=Math.round(b.weight*100);
                      const earnedPts=Math.round(b.contribution);
                      return(
                        <div key={b.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <div style={{width:22,height:22,borderRadius:6,background:col+"15",display:"grid",placeItems:"center",color:col,flexShrink:0}}>
                            {ICONS[b.key]}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>
                                {b.label}
                                {(b.requirement==="REQUIRED"||b.requirement==="HARD_REQUIRED")&&(
                                  <span style={{fontSize:8.5,fontWeight:700,color:"#9CA3AF",marginLeft:5,padding:"1px 5px",background:"#F1F5F9",borderRadius:4,verticalAlign:"middle"}}>
                                    {b.requirement==="HARD_REQUIRED"?"HARD REQ":"REQUIRED"}
                                  </span>
                                )}
                              </span>
                              <span style={{fontSize:11,fontWeight:700,color:col,fontVariantNumeric:"tabular-nums"}}>
                                {earnedPts}<span style={{fontSize:9,color:"#9CA3AF",fontWeight:400}}> / {maxPts} pts</span>
                              </span>
                            </div>
                            <div style={{height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
                              <div style={{width:`${b.shrunkScore??0}%`,height:"100%",background:col,borderRadius:2}}/>
                            </div>
                            {b.flagOverride&&(
                              <div style={{fontSize:10.5,color:RED,marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                                <AlertTriangle size={9}/>{FLAG_LABELS[b.flagOverride]?.label||b.flagOverride}
                              </div>
                            )}
                            {missing&&(
                              <div style={{fontSize:10.5,color:RED,marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                                <XCircle size={9}/>Required evidence missing — scored 0, weight NOT redistributed
                              </div>
                            )}
                            {b.confidence<1&&!b.flagOverride&&(
                              <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>Derived measurement ({Math.round(b.confidence*100)}% confidence) — shrunk toward neutral</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {excluded.length>0&&(
                      <div style={{fontSize:10.5,color:"#9CA3AF",padding:"8px 10px",background:"#F8FAFF",borderRadius:7,marginTop:4,lineHeight:1.7}}>
                        {excluded.map(b=>(<div key={b.key}><strong style={{color:"#6B7280"}}>{b.label}:</strong> {b.notes[0]||"Not counted."}</div>))}
                      </div>
                    )}

                    {/* Consistency findings */}
                    {trust.consistency.length>0&&(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Cross-evidence reasoning</div>
                        {trust.consistency.map(c=>(
                          <div key={c.rule} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 10px",background:c.delta>0?"#F0FDF4":"#FFF5F5",border:`1px solid ${c.delta>0?"#BBF7D0":"#FECACA"}`,borderRadius:8,marginBottom:6}}>
                            <span style={{fontSize:11,fontWeight:800,color:c.delta>0?GREEN:RED,fontVariantNumeric:"tabular-nums",flexShrink:0}}>{c.delta>0?"+":""}{c.delta}</span>
                            <span style={{fontSize:11,color:"#374151",lineHeight:1.5}}>{c.reading}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formula footnote + backend reconciliation */}
                    <div style={{marginTop:10,padding:"8px 10px",background:"#F8FAFF",borderRadius:8,border:"1px solid #E8EDF5"}}>
                      {(() => {
                        // Show the actual POINTS each engine contributed (what
                        // the bars above display), not weight percentages —
                        // percentages don't sum to a score (32+29+26+13=100,
                        // not 69), and Image here contributed 0 despite a 26%
                        // weight, which a percentage-only equation hides entirely.
                        const consistencyPts = trust.consistency.reduce((a,c)=>a+c.delta,0);
                        const parts = included.map(b => ({ label: b.label, pts: Math.round(b.contribution) }));
                        const partsSum = parts.reduce((a,p)=>a+p.pts,0) + Math.round(consistencyPts);
                        const roundingDiff = displayScore - partsSum;
                        return (
                          <div style={{fontSize:10,color:"#9CA3AF",lineHeight:1.7}}>
                            <strong style={{color:"#6B7280"}}>Trust Index:</strong> {parts.map(p=>`${p.label} (${p.pts}pt${p.pts===1?"":"s"})`).join(" + ")}{trust.consistency.length>0?` + cross-evidence reasoning (${consistencyPts>0?"+":""}${Math.round(consistencyPts)}pts)`:""} = <strong style={{color:clr(displayScore)}}>{partsSum}</strong>{roundingDiff!==0 && <span> (rounds to <strong style={{color:clr(displayScore)}}>{displayScore}</strong>)</span>}
                          </div>
                        );
                      })()}
                      {trust.backendScore!=null&&trust.delta!=null&&trust.delta!==0&&(
                        <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>
                          Backend raw score: <strong>{trust.backendScore}</strong> (Δ {trust.delta>0?"+":""}{trust.delta} — see reasoning above)
                        </div>
                      )}
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>
                        Pass threshold: <strong>{engineCfg.passScoreThreshold}</strong> · Policy set in <span style={{color:BLUE,cursor:"pointer",textDecoration:"underline"}} onClick={()=>navigate("/settings",{state:{section:"engine"}})}>Engine Settings</span> · Method: <span style={{color:BLUE}}>Trust Intelligence Bible</span>
                      </div>
                    </div>

                    {/* Audit trail — full chain of reasoning */}
                    {trust.audit.length>0&&(
                      <details style={{marginTop:8}}>
                        <summary style={{fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",padding:"4px 0"}}>Full audit trail ({trust.audit.length} steps)</summary>
                        <div style={{marginTop:6,padding:"8px 10px",background:"#0F172A",borderRadius:8,maxHeight:200,overflowY:"auto"}}>
                          {trust.audit.map((a,i)=>(
                            <div key={i} style={{fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,.75)",lineHeight:1.8}}>{i+1}. {a}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* AI Authenticity — always auto-runs on load */}
          <div style={{background:"white",borderRadius:16,padding:20,border:`1px solid ${aiScan.status==="done"&&(aiScan.image?.status==="FAIL"||aiScan.metadata?.status==="FAIL")?"#FECACA":"#E8EDF5"}`,boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Sparkles size={14} color={ROSE}/>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7}}>AI Fraud Detection</div>
              <div style={{marginLeft:"auto"}}>
                {aiScan.status==="loading"&&(
                  <span style={{fontSize:11,color:ROSE,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:ROSE}}/>Scanning…
                  </span>
                )}
                {(aiScan.status==="done"||aiScan.status==="error")&&(
                  <button onClick={runAiScan}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:"#F8FAFF",border:"1px solid #E8EDF5",cursor:"pointer",fontSize:11,color:"#6B7280",fontFamily:"Inter,sans-serif"}}>
                    <Cpu size={11}/> Re-scan
                  </button>
                )}
              </div>
            </div>
            {aiScan.status==="loading"&&(
              <div style={{display:"flex",flexDirection:"column",gap:6,padding:"4px 0"}}>
                {[
                  ["Metadata","Scanning EXIF / C2PA watermarks…"],
                  ["AI Visual","GPT-4o AI generation detection…"],
                  ["Download","Stock photo & internet source check…"],
                  ["Audio","Analysing speech authenticity…"],
                ].map(([lbl,msg])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F8FAFF",borderRadius:9,border:"1px solid #E8EDF5"}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:ROSE,flexShrink:0}}/>
                    <span style={{fontSize:12,color:"#374151",fontWeight:600,width:72}}>{lbl}</span>
                    <span style={{fontSize:11,color:"#9CA3AF"}}>{msg}</span>
                  </div>
                ))}
              </div>
            )}
            {aiScan.status==="done"&&(
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {aiScan.metadata&&(
                  <EngineBar label="Metadata / C2PA Watermark" score={aiScan.metadata.score} status={aiScan.metadata.status} finding={aiScan.metadata.finding} weight={0} color={ROSE} icon={<Shield size={13} color={ROSE}/>}/>
                )}
                {aiScan.image&&(
                  <EngineBar label="AI Generation (GPT-4o)" score={aiScan.image.score} status={aiScan.image.status} finding={aiScan.image.finding} weight={0} color={ROSE} icon={<Sparkles size={13} color={ROSE}/>}/>
                )}
                {aiScan.download&&(
                  <EngineBar label="Downloaded / Stock Photo" score={aiScan.download.score} status={aiScan.download.status} finding={aiScan.download.finding} weight={0} color={ROSE} icon={<Camera size={13} color={ROSE}/>}/>
                )}
                {aiScan.audio&&(
                  <EngineBar label="Audio / Speech Authenticity" score={aiScan.audio.score} status={aiScan.audio.status} finding={aiScan.audio.finding} weight={0} color={ROSE} icon={<Mic size={13} color={ROSE}/>}/>
                )}
                {aiScan.text&&(
                  <EngineBar label="Transcript Patterns" score={aiScan.text.score} status={aiScan.text.status} finding={aiScan.text.finding} weight={0} color={ROSE} icon={<Cpu size={13} color={ROSE}/>}/>
                )}
                {!aiScan.image&&!aiScan.metadata&&!aiScan.download&&!aiScan.audio&&!aiScan.text&&(
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

          {/* Verdict Override — a supervisor's own call, separate from the algorithm's */}
          <div style={{background:"white",borderRadius:16,padding:20,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Verdict Override</div>
            <div style={{fontSize:11.5,color:"#9CA3AF",marginBottom:12,lineHeight:1.5}}>
              The Trust Index computed <strong style={{color:vclr(algorithmicVerdict)}}>{algorithmicVerdict}</strong>. If you know something the engine doesn't — a field visit confirmed it, or a false GPS/image flag — you can override the verdict shown across the dashboard. The algorithm's own call is never erased; both stay on record.
            </div>
            {isOverridden ? (
              <div style={{padding:"12px 14px",borderRadius:10,background:"#F5F3FF",border:"1px solid #E9D5FF",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#7C3AED"}}>Overridden to {sub.verdict_override}</span>
                  <span style={{fontSize:10.5,color:"#9CA3AF"}}>(algorithm said {algorithmicVerdict})</span>
                </div>
                <div style={{fontSize:11.5,color:"#374151",marginBottom:4}}>"{sub.override_reason}"</div>
                <div style={{fontSize:10.5,color:"#9CA3AF"}}>
                  — {sub.override_by}{sub.override_at ? `, ${new Date(sub.override_at).toLocaleString()}` : ""}
                </div>
                <button disabled={acting!==""} onClick={async()=>{
                    setActing("clear_override");
                    try{ await dashboardApi.clearOverride(id!); setSub((s:any)=>s?{...s,verdict_override:null,override_reason:null}:s); showToast("Override cleared"); }
                    catch{ showToast("Could not clear override"); }
                    finally{ setActing(""); }
                  }}
                  style={{marginTop:8,fontSize:11,fontWeight:600,color:"#7C3AED",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0}}>
                  Clear override — revert to algorithm's verdict
                </button>
              </div>
            ) : (
              <div>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {(["PASS","FLAG","REJECT"] as const).filter(v=>v!==algorithmicVerdict).map(v=>(
                    <button key={v} onClick={()=>setOverrideTarget(overrideTarget===v?"":v)}
                      style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${overrideTarget===v?vclr(v):"#E2E8F0"}`,background:overrideTarget===v?vclr(v)+"12":"white",color:overrideTarget===v?vclr(v):"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      Override to {v}
                    </button>
                  ))}
                </div>
                {overrideTarget && (
                  <div>
                    <textarea value={overrideReason} onChange={e=>setOverrideReason(e.target.value)}
                      placeholder="Required: why does this deserve a different verdict? (e.g. &quot;Confirmed by field visit — GPS_PARSE_ERROR was a device bug, location is correct&quot;)"
                      style={{width:"100%",minHeight:60,padding:"8px 10px",borderRadius:8,border:"1px solid #E2E8F0",fontSize:12,fontFamily:"Inter,sans-serif",resize:"vertical" as const,boxSizing:"border-box" as const,marginBottom:8}}/>
                    <button disabled={acting!==""||overrideReason.trim().length<10}
                      onClick={async()=>{
                        setActing("override");
                        try{
                          await dashboardApi.overrideVerdict(id!, overrideTarget as any, overrideReason.trim());
                          setSub((s:any)=>s?{...s,verdict_override:overrideTarget,override_reason:overrideReason.trim(),override_by:"you",override_at:new Date().toISOString()}:s);
                          showToast(`Overridden to ${overrideTarget}`);
                          setOverrideTarget(""); setOverrideReason("");
                        }catch{ showToast("Could not save override"); }
                        finally{ setActing(""); }
                      }}
                      style={{width:"100%",padding:"9px",borderRadius:8,background:overrideReason.trim().length>=10?vclr(overrideTarget):"#E2E8F0",border:"none",color:"white",fontSize:12.5,fontWeight:700,cursor:overrideReason.trim().length>=10?"pointer":"not-allowed",fontFamily:"Inter,sans-serif"}}>
                      {acting==="override"?"Saving…":`Confirm override to ${overrideTarget}`}
                    </button>
                    <div style={{fontSize:10.5,color:"#9CA3AF",marginTop:4}}>{overrideReason.trim().length}/10 characters minimum</div>
                  </div>
                )}
              </div>
            )}
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