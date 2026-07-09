import React, { useState } from "react";
import { motion } from "framer-motion";
import { Download, Sparkles, Clock, CheckCircle } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { insightScoreApi } from "../../services/api";

const BLUE="#2463EB",GREEN="#059669",PURPLE="#7C3AED";

const REPORT_TYPES=[
  {id:"executive",title:"Executive Summary",desc:"High-level overview for stakeholders",icon:"📊",time:"~30 seconds"},
  {id:"technical",title:"Technical Quality Report",desc:"Full engine breakdown and fraud analysis",icon:"🔬",time:"~45 seconds"},
  {id:"enumerator",title:"Enumerator Performance",desc:"Individual and comparative performance",icon:"👤",time:"~20 seconds"},
  {id:"client",title:"Client Delivery Report",desc:"Branded report ready for client submission",icon:"📋",time:"~60 seconds"},
];

export default function ReportsPage(){
  const [generating,setGenerating]=useState<string|null>(null);
  const [generated,setGenerated]=useState<string[]>([]);
  const [toast,setToast]=useState("");
  useAdaGreeting({ page: "reports" });

  const showToast=(msg:string)=>{
    setToast(msg);
    setTimeout(()=>setToast(""),3000);
  };

  const generate=(id:string)=>{
    setGenerating(id);
    setTimeout(()=>{
      setGenerating(null);
      setGenerated(prev=>[...prev,id]);
      showToast("Report generated — ready to download");
    },3000);
  };

  const download=(r:{id:string;title:string})=>{
    const format = r.id==="executive"?"pptx":r.id==="technical"?"xlsx":"docx";
    const projectId="658464e5-09dc-4b99-a664-05690de9921a";
    insightScoreApi.downloadReport(projectId,format)
      .then(res=>{
        const url=URL.createObjectURL(new Blob([res.data]));
        const a=document.createElement("a");
        a.href=url; a.download=`${r.title.replace(/\s+/g,"-").toLowerCase()}.${format}`;
        a.click(); URL.revokeObjectURL(url);
      })
      .catch(()=>showToast("Download coming soon — report will be available once backend is configured"));
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Reports</h1>
        <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>Ada generates client-ready deliverables from your verified data</p>
      </div>

      <div style={{background:"linear-gradient(135deg,#1A1F3E,#0F172A)",borderRadius:16,padding:"24px 28px",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:20}}>
        <div style={{width:56,height:56,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(255,255,255,.2)",flexShrink:0}}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"white",marginBottom:4}}>Ada is ready to generate your reports</div>
          <div style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>I have reviewed 18 verified submissions. Select a report type and I will prepare it immediately.</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(37,99,235,.2)",border:"1px solid rgba(37,99,235,.3)",borderRadius:8,padding:"6px 12px"}}>
          <Sparkles size={12} color="#93C5FD"/>
          <span style={{fontSize:11.5,fontWeight:600,color:"#93C5FD"}}>Ada · AI</span>
        </div>
      </div>

      <div data-ada-target="reports-list" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
        {REPORT_TYPES.map(r=>{
          const isDone=generated.includes(r.id);
          const isGenerating=generating===r.id;
          return(
            <motion.div key={r.id} whileHover={{y:-2}}
              style={{background:"white",borderRadius:16,padding:"22px 24px",border:`1px solid ${isDone?"#BBDEFB":"#E8EDF5"}`,boxShadow:"0 2px 12px rgba(10,15,28,.06)",position:"relative",overflow:"hidden"}}>
              {isDone&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(to right,${BLUE},${PURPLE})`}}/>}
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                <div style={{fontSize:28}}>{r.icon}</div>
                {isDone&&<CheckCircle size={18} color={GREEN}/>}
              </div>
              <div style={{fontSize:14.5,fontWeight:700,color:"#080D1A",marginBottom:4}}>{r.title}</div>
              <div style={{fontSize:12.5,color:"#9CA3AF",marginBottom:16,lineHeight:1.5}}>{r.desc}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16,fontSize:11.5,color:"#9CA3AF"}}>
                <Clock size={11}/>{r.time}
              </div>
              <div style={{display:"flex",gap:8}}>
                {isDone?(
                  <>
                    <button onClick={()=>download(r)} style={{flex:1,padding:"9px",borderRadius:8,background:GREEN,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,color:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"Inter,sans-serif"}}>
                      <Download size={13}/> Download
                    </button>
                    <button onClick={()=>generate(r.id)}
                      style={{padding:"9px 14px",borderRadius:8,background:"white",border:"1px solid #E2E8F0",cursor:"pointer",fontSize:12.5,fontWeight:600,color:"#374151",fontFamily:"Inter,sans-serif"}}>
                      Regenerate
                    </button>
                  </>
                ):(
                  <button onClick={()=>generate(r.id)} disabled={!!generating}
                    style={{flex:1,padding:"9px",borderRadius:8,background:isGenerating?"#EFF6FF":BLUE,border:isGenerating?`1px solid ${BLUE}`:"none",cursor:generating?"not-allowed":"pointer",fontSize:12.5,fontWeight:600,color:isGenerating?BLUE:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"Inter,sans-serif",transition:"all .2s"}}>
                    {isGenerating?(
                      <>
                        <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}
                          style={{width:13,height:13,border:`2px solid ${BLUE}`,borderTopColor:"transparent",borderRadius:"50%"}}/>
                        Ada is generating...
                      </>
                    ):(
                      <><Sparkles size={13}/> Generate with Ada</>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {generated.length>0&&(
        <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9"}}>
            <div style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Generated Reports</div>
          </div>
          {generated.map(id=>{
            const r=REPORT_TYPES.find(t=>t.id===id);
            if(!r)return null;
            return(
              <div key={id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:"1px solid #F8FAFF"}}>
                <div style={{width:36,height:36,borderRadius:9,background:"#EFF6FF",display:"grid",placeItems:"center",fontSize:16,flexShrink:0}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#080D1A"}}>{r.title}</div>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>Generated just now · Lagos Retail Audit</div>
                </div>
                <button onClick={()=>download(r)} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:7,background:"#EFF6FF",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:BLUE,fontFamily:"Inter,sans-serif"}}>
                  <Download size={12}/> Download
                </button>
              </div>
            );
          })}
        </div>
      )}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#111827",color:"white",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,.3)",pointerEvents:"none"}}>
          {toast}
        </div>
      )}
    </div>
  );
}
