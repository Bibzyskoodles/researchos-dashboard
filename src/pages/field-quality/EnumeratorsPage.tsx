import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { dashboardApi } from "../../services/api";
import { Enumerator } from "../../types";
import { AlertTriangle } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAdaAttention } from "../../hooks/useAdaAttention";
import { usePlatform } from "../../platform/PlatformProvider";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED";
const COLORS=[BLUE,PURPLE,GREEN,AMBER,RED];
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

export default function EnumeratorsPage(){
  const [enums,setEnums]=useState<Enumerator[]>([]);
  const [_loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Enumerator|null>(null);
  const { t }=usePlatform();
  const termPlural=t("enumerators","enumerators");            // industry term (lowercase)
  const Term=termPlural.replace(/\b\w/g,c=>c.toUpperCase());  // title-cased for headings
  useAdaGreeting({ page: "enumerators" });
  useAdaAttention({ x: 0.85, y: 0.45 }, { delay: 2000, returnAfterMs: 5000 });

  useEffect(()=>{
    dashboardApi.getEnumerators()
      .then(r=>{ setEnums(r.data.enumerators||[]); })
      .finally(()=>setLoading(false));
  },[]);

  const radarData=(e:Enumerator)=>[
    {subject:"GPS",value:92},{subject:"Image",value:78},
    {subject:"Audio",value:91},{subject:"Duration",value:85},{subject:"Duplicate",value:98},
  ];

  if(_loading) return <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Loading {termPlural}...</div>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>{Term}</h1>
        <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>{enums.length} active · Lagos Retail Audit</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {enums.slice(0,3).map((e,i)=>{
          const medals=["🥇","🥈","🥉"];
          const col=COLORS[i];
          return(
            <motion.div key={e.enumerator_id} whileHover={{y:-3}}
              style={{background:"white",borderRadius:16,padding:"20px",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)",cursor:"pointer",position:"relative",overflow:"hidden"}}
              onClick={()=>setSelected(selected?.enumerator_id===e.enumerator_id?null:e)}>
              <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"0 0 0 80px",background:col+"12"}}/>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:col,display:"grid",placeItems:"center",fontSize:14,fontWeight:800,color:"white"}}>{e.enumerator_id.slice(-2)}</div>
                <span style={{fontSize:22}}>{medals[i]}</span>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:"#080D1A",marginBottom:2}}>{e.enumerator_id}</div>
              <div style={{fontSize:11,color:"#9CA3AF",marginBottom:12}}>{e.total_subs} interviews</div>
              <div style={{fontSize:32,fontWeight:800,color:col,letterSpacing:-2,lineHeight:1,marginBottom:8}}>{e.avg_score}</div>
              <div style={{height:3,background:"#EEF2F8",borderRadius:2,overflow:"hidden",marginBottom:10}}>
                <motion.div style={{height:"100%",background:col,borderRadius:2}}
                  initial={{width:0}} animate={{width:`${e.avg_score}%`}} transition={{duration:1,ease:"easeOut"}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,textAlign:"center",padding:"6px",background:"#F8FAFF",borderRadius:8}}>
                  <div style={{fontSize:14,fontWeight:800,color:GREEN}}>{e.pass_count}</div>
                  <div style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>Passed</div>
                </div>
                <div style={{flex:1,textAlign:"center",padding:"6px",background:"#F8FAFF",borderRadius:8}}>
                  <div style={{fontSize:14,fontWeight:800,color:e.flag_count>0?AMBER:"#9CA3AF"}}>{e.flag_count}</div>
                  <div style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>Flagged</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 360px":"1fr",gap:16,alignItems:"start"}}>
        <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
          <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #F1F5F9"}}>
            <div style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Performance Leaderboard</div>
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Ranked by average trust score</div>
          </div>
          {enums.map((e,i)=>{
            const col=COLORS[i%COLORS.length];
            return(
              <motion.div key={e.enumerator_id} whileHover={{background:"#FAFBFF"}}
                onClick={()=>setSelected(selected?.enumerator_id===e.enumerator_id?null:e)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<enums.length-1?"1px solid #F8FAFF":"none",cursor:"pointer",
                  background:selected?.enumerator_id===e.enumerator_id?"#F0F7FF":"white",
                  borderLeft:selected?.enumerator_id===e.enumerator_id?`3px solid ${BLUE}`:"3px solid transparent"}}>
                <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color:i<3?AMBER:"#9CA3AF",width:20}}>{i+1}</div>
                <div style={{width:36,height:36,borderRadius:"50%",background:col,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"white",flexShrink:0}}>{e.enumerator_id.slice(-2)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#080D1A",marginBottom:2}}>{e.enumerator_id}</div>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>{e.total_subs} interviews · {e.pass_count} passed · {e.flag_count} flagged</div>
                </div>
                <div style={{width:100}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:10,color:"#9CA3AF"}}>
                    <span>Score</span><span style={{fontWeight:700,color:clr(e.avg_score)}}>{e.avg_score}</span>
                  </div>
                  <div style={{height:3,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${e.avg_score}%`,height:"100%",background:col,borderRadius:2}}/>
                  </div>
                </div>
                <div style={{fontSize:14,color:e.trend==="up"?GREEN:e.trend==="down"?RED:"#9CA3AF"}}>
                  {e.trend==="up"?"↑":e.trend==="down"?"↓":"—"}
                </div>
                <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,background:e.grade==="A"?"#ECFDF5":e.grade==="B"?"#EFF6FF":"#FEF3C7",color:e.grade==="A"?GREEN:e.grade==="B"?BLUE:AMBER}}>{e.grade}</span>
              </motion.div>
            );
          })}
        </div>

        {selected&&(
          <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}
            style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 4px 24px rgba(10,15,28,.1)",position:"sticky",top:16}}>
            <div style={{padding:"20px",borderBottom:"1px solid #F1F5F9",background:"linear-gradient(135deg,#F8FAFF,white)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:BLUE,display:"grid",placeItems:"center",fontSize:14,fontWeight:800,color:"white"}}>{selected.enumerator_id.slice(-2)}</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#080D1A"}}>{selected.enumerator_id}</div>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>{selected.total_subs} interviews · Grade {selected.grade}</div>
                </div>
                <div style={{marginLeft:"auto",fontSize:32,fontWeight:800,color:clr(selected.avg_score),letterSpacing:-2}}>{selected.avg_score}</div>
              </div>
            </div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Performance Radar</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {radarData(selected).map(d=>(
                  <div key={d.subject} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:64,fontSize:10.5,color:"#9CA3AF",flexShrink:0}}>{d.subject}</div>
                    <div style={{flex:1,height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${d.value}%`,height:"100%",background:BLUE,borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:10.5,fontWeight:700,color:BLUE,width:24,textAlign:"right"}}>{d.value}</div>
                  </div>
                ))}
              </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["Submissions",selected.total_subs],["Avg Score",selected.avg_score+"/100"],["Passed",selected.pass_count],["Flagged",selected.flag_count]].map(([k,v])=>(
                  <div key={k} style={{padding:"12px",background:"#F8FAFF",borderRadius:10,textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:800,color:"#080D1A",letterSpacing:-1}}>{v}</div>
                    <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginTop:2}}>{k}</div>
                  </div>
                ))}
              </div>
              {selected.flag_count>0&&(
                <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",background:"#FFFBEB",borderRadius:10,border:"1px solid #FDE68A"}}>
                  <AlertTriangle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
                  <div style={{fontSize:12,color:"#92400E"}}>{selected.flag_count} submission{selected.flag_count>1?"s":""} flagged for review. Check for duplicate media or GPS anomalies.</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
