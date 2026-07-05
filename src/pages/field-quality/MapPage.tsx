import React, { useEffect, useState } from "react";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { MapPin, Layers, Filter } from "lucide-react";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626";
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

export default function MapPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("ALL");

  useEffect(()=>{
    dashboardApi.getSubmissions({limit:100})
      .then(r=>setSubs(r.data.submissions||[]))
      .finally(()=>setLoading(false));
  },[]);

  const filtered=subs.filter(s=>filter==="ALL"||s.verdict===filter);
  const withGps=filtered.filter(s=>s.gps?.lat&&s.gps?.lon);

  // Group by approximate location
  const clusters = withGps.reduce((acc:any,s)=>{
    const key=`${Math.round(Number(s.gps.lat)*10)/10},${Math.round(Number(s.gps.lon)*10)/10}`;
    if(!acc[key])acc[key]={lat:s.gps.lat,lon:s.gps.lon,subs:[],addr:s.gps.address||""};
    acc[key].subs.push(s);
    return acc;
  },{});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Coverage Map</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>{withGps.length} submissions with GPS data</p>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["ALL","PASS","FLAG","REJECT"].map(v=>(
            <button key={v} onClick={()=>setFilter(v)}
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid",fontSize:11.5,fontWeight:600,cursor:"pointer",
                borderColor:filter===v?BLUE:"#E2E8F0",background:filter===v?BLUE:"white",color:filter===v?"white":"#6B7280"}}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,alignItems:"start"}}>
        {/* Map */}
        <div style={{background:"#0B1929",borderRadius:16,overflow:"hidden",border:"1px solid #1E3A5F",boxShadow:"0 4px 24px rgba(8,13,26,.2)",position:"relative",height:480}}>
          {/* SVG road network */}
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.08}} viewBox="0 0 800 480">
            <path d="M0 240 Q200 200 400 240 Q600 280 800 240" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M0 160 Q150 140 300 180 Q500 220 700 180 Q750 160 800 160" stroke="white" strokeWidth="1" fill="none"/>
            <path d="M200 0 Q220 240 240 480" stroke="white" strokeWidth="1" fill="none"/>
            <path d="M450 0 Q470 240 490 480" stroke="white" strokeWidth="1" fill="none"/>
            <path d="M650 0 Q630 240 610 480" stroke="white" strokeWidth="1" fill="none"/>
            <path d="M0 350 Q300 320 600 360 Q700 370 800 350" stroke="white" strokeWidth="1" fill="none"/>
            <text x="120" y="200" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">Agege</text>
            <text x="280" y="160" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">Ikeja</text>
            <text x="250" y="310" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">Surulere</text>
            <text x="420" y="290" fill="rgba(255,255,255,.3)" fontSize="12" fontFamily="Inter">Lagos Island</text>
            <text x="560" y="320" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">Lekki</text>
            <text x="530" y="380" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">Ajah</text>
          </svg>

          {/* Submission dots */}
          {withGps.map((sub,i)=>{
            const x=20+((Number(sub.gps.lon)+3.75)/0.5)*60;
            const y=480-((Number(sub.gps.lat)-6.4)/0.35)*400;
            const color=clr(sub.overall_score);
            return(
              <div key={sub.submission_id} title={`${sub.enumerator_id} · ${sub.overall_score}/100`}
                style={{position:"absolute",left:`${Math.min(Math.max(x,2),96)}%`,top:`${Math.min(Math.max(y/480*100,2),96)}%`,
                  width:sub.verdict==="FLAG"?12:8,height:sub.verdict==="FLAG"?12:8,
                  borderRadius:"50%",background:color,border:"1.5px solid rgba(255,255,255,.6)",
                  boxShadow:`0 0 ${sub.verdict==="FLAG"?12:6}px ${color}`,
                  cursor:"pointer",transition:"transform .2s",transform:"translate(-50%,-50%)",zIndex:2}}
                onMouseEnter={e=>(e.currentTarget.style.transform="translate(-50%,-50%) scale(1.8)")}
                onMouseLeave={e=>(e.currentTarget.style.transform="translate(-50%,-50%) scale(1)")}/>
            );
          })}

          {/* Legend */}
          <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:12,background:"rgba(15,25,45,.85)",backdropFilter:"blur(8px)",borderRadius:10,padding:"8px 14px"}}>
            {[{c:GREEN,l:"High quality"},{c:AMBER,l:"Needs review"},{c:RED,l:"Flagged"}].map(({c,l})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,color:"rgba(255,255,255,.7)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
                {l}
              </div>
            ))}
          </div>

          {/* Stats overlay */}
          <div style={{position:"absolute",top:16,right:16,background:"rgba(15,25,45,.9)",backdropFilter:"blur(8px)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Coverage</div>
            <div style={{fontSize:22,fontWeight:800,color:"white",letterSpacing:-1,lineHeight:1}}>{withGps.length}</div>
            <div style={{fontSize:10.5,color:"rgba(255,255,255,.4)"}}>submissions mapped</div>
          </div>
        </div>

        {/* Submission list */}
        <div style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",maxHeight:480,overflowY:"auto"}}>
          <div style={{padding:"16px 16px 10px",borderBottom:"1px solid #F1F5F9",position:"sticky",top:0,background:"white",zIndex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#080D1A"}}>Submissions</div>
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{filtered.length} shown</div>
          </div>
          {loading?(
            <div style={{padding:24,textAlign:"center",color:"#9CA3AF"}}>Loading...</div>
          ):filtered.slice(0,20).map((sub,i)=>(
            <div key={sub.submission_id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"1px solid #F8FAFF",cursor:"pointer"}}
              onMouseEnter={e=>(e.currentTarget.style.background="#FAFBFF")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div style={{width:8,height:8,borderRadius:"50%",background:clr(sub.overall_score),flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11.5,fontWeight:600,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub.enumerator_id}</div>
                <div style={{fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub.gps?.address?.split(",").slice(0,2).join(",")}</div>
              </div>
              <span style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:clr(sub.overall_score),flexShrink:0}}>{sub.overall_score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {[
          {label:"Total Mapped",value:withGps.length,color:"#080D1A"},
          {label:"High Quality",value:withGps.filter(s=>s.overall_score>=70).length,color:GREEN},
          {label:"Needs Review",value:withGps.filter(s=>s.overall_score>=45&&s.overall_score<70).length,color:AMBER},
          {label:"Flagged",value:withGps.filter(s=>s.overall_score<45).length,color:RED},
        ].map(({label,value,color})=>(
          <div key={label} style={{background:"white",borderRadius:12,padding:"16px 18px",border:"1px solid #E8EDF5",boxShadow:"0 1px 4px rgba(10,15,28,.04)"}}>
            <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>{label}</div>
            <div style={{fontSize:28,fontWeight:800,color,letterSpacing:-1.5,lineHeight:1}}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}