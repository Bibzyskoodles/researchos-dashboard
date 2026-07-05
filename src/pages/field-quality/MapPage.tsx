import React, { useEffect, useState } from "react";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";

const GREEN="#059669",AMBER="#D97706",RED="#DC2626",BLUE="#2463EB";
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

// World map dots — simplified outline as dot grid
const WORLD_DOTS:Array<[number,number]>=[];
// Generate dot grid
for(let lat=75;lat>=-60;lat-=4){
  for(let lon=-170;lon<=180;lon+=4){
    // Rough world outline mask
    const onLand=(
      // North America
      (lat>15&&lat<75&&lon>-170&&lon<-50)||
      // South America
      (lat>-55&&lat<15&&lon>-80&&lon<-35)||
      // Europe
      (lat>35&&lat<70&&lon>-10&&lon<40)||
      // Africa
      (lat>-35&&lat<37&&lon>-20&&lon<52)||
      // Asia
      (lat>-10&&lat<75&&lon>40&&lon<145)||
      // Australia
      (lat>-45&&lat<-10&&lon>113&&lon<155)||
      // UK/Ireland
      (lat>50&&lat<60&&lon>-10&&lon<2)
    );
    if(onLand) WORLD_DOTS.push([lon,lat]);
  }
}

function lonLatToPercent(lon:number,lat:number):[number,number]{
  const x=((lon+180)/360)*100;
  const y=((90-lat)/150)*100;
  return[x,y];
}

export default function MapPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [_loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("ALL");
  const [hovered,setHovered]=useState<Submission|null>(null);
  useAdaGreeting({page:"map"});

  useEffect(()=>{
    dashboardApi.getSubmissions({limit:100})
      .then(r=>setSubs(r.data.submissions||[]))
      .finally(()=>setLoading(false));
  },[]);

  const filtered=subs.filter(s=>filter==="ALL"||s.verdict===filter);
  const withGps=filtered.filter(s=>s.gps?.lat&&s.gps?.lon);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Coverage Map</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>Global submission coverage · {withGps.length} submissions mapped</p>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["ALL","PASS","FLAG","REJECT"].map(v=>(
            <button key={v} onClick={()=>setFilter(v)}
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid",fontSize:11.5,fontWeight:600,cursor:"pointer",transition:"all .15s",
                borderColor:filter===v?BLUE:"#E2E8F0",background:filter===v?BLUE:"white",color:filter===v?"white":"#6B7280"}}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{background:"#0B1120",borderRadius:20,overflow:"hidden",border:"1px solid #1E2A44",boxShadow:"0 8px 40px rgba(8,13,26,.3)",position:"relative",height:440}}>

        {/* Dotted world map */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 100 70" preserveAspectRatio="none">
          {WORLD_DOTS.map(([lon,lat],i)=>{
            const[x,y]=lonLatToPercent(lon,lat);
            return <circle key={i} cx={x} cy={y} r="0.18" fill="rgba(255,255,255,.12)"/>;
          })}
        </svg>

        {/* Submission dots */}
        {withGps.map(sub=>{
          const lat=Number(sub.gps.lat);
          const lon=Number(sub.gps.lon);
          const[x,y]=lonLatToPercent(lon,lat);
          const color=clr(sub.overall_score);
          const isHovered=hovered?.submission_id===sub.submission_id;
          return(
            <div key={sub.submission_id}
              onMouseEnter={()=>setHovered(sub)}
              onMouseLeave={()=>setHovered(null)}
              style={{position:"absolute",left:`${x}%`,top:`${y}%`,transform:"translate(-50%,-50%)",zIndex:3,cursor:"pointer"}}>
              {/* Pulse ring */}
              <div style={{position:"absolute",inset:-6,borderRadius:"50%",background:color,opacity:.15,animation:"pulse 2s infinite"}}/>
              {/* Dot */}
              <div style={{width:isHovered?14:sub.verdict==="FLAG"?10:8,height:isHovered?14:sub.verdict==="FLAG"?10:8,
                borderRadius:"50%",background:color,
                border:`1.5px solid rgba(255,255,255,${isHovered?0.9:0.5})`,
                boxShadow:`0 0 ${isHovered?16:sub.verdict==="FLAG"?12:6}px ${color}`,
                transition:"all .2s"}}/>
              {/* Tooltip */}
              {isHovered&&(
                <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"rgba(15,25,45,.95)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",whiteSpace:"nowrap",zIndex:10,minWidth:160}}>
                  <div style={{fontSize:11,fontWeight:700,color:"white",marginBottom:2}}>{sub.enumerator_id}</div>
                  <div style={{fontSize:10.5,color:"rgba(255,255,255,.5)",marginBottom:4}}>{sub.gps.address?.split(",").slice(0,2).join(",")}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:sub.verdict==="PASS"?"#ECFDF5":sub.verdict==="FLAG"?"#FFFBEB":"#FEF2F2",color:clr(sub.overall_score)}}>{sub.verdict}</span>
                    <span style={{fontSize:11,fontWeight:800,color,fontFamily:"monospace"}}>{sub.overall_score}/100</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Country labels */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 100 70">
          <text x="18" y="35" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">North America</text>
          <text x="28" y="52" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">South America</text>
          <text x="46" y="28" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">Europe</text>
          <text x="49" y="42" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">Africa</text>
          <text x="65" y="30" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">Asia</text>
          <text x="75" y="55" fontSize="1.8" fill="rgba(255,255,255,.15)" fontFamily="Inter">Australia</text>
        </svg>

        {/* Legend */}
        <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:12,background:"rgba(11,17,32,.9)",backdropFilter:"blur(8px)",borderRadius:10,padding:"8px 14px",border:"1px solid rgba(255,255,255,.06)"}}>
          {[{c:GREEN,l:"High quality"},{c:AMBER,l:"Needs review"},{c:RED,l:"Flagged"}].map(({c,l})=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,color:"rgba(255,255,255,.6)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
              {l}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8}}>
          <div style={{background:"rgba(11,17,32,.9)",backdropFilter:"blur(8px)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,.06)",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:"white",letterSpacing:-1,lineHeight:1}}>{withGps.length}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>Mapped</div>
          </div>
          <div style={{background:"rgba(11,17,32,.9)",backdropFilter:"blur(8px)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,.06)",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:GREEN,letterSpacing:-1,lineHeight:1}}>{withGps.filter(s=>s.overall_score>=70).length}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>High quality</div>
          </div>
          {withGps.filter(s=>s.verdict==="FLAG").length>0&&(
            <div style={{background:"rgba(11,17,32,.9)",backdropFilter:"blur(8px)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,.06)",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:800,color:AMBER,letterSpacing:-1,lineHeight:1}}>{withGps.filter(s=>s.verdict==="FLAG").length}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>Flagged</div>
            </div>
          )}
        </div>

        {/* Real-time label */}
        <div style={{position:"absolute",top:16,left:16,display:"flex",alignItems:"center",gap:6,background:"rgba(11,17,32,.9)",borderRadius:8,padding:"6px 10px",border:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:GREEN,boxShadow:`0 0 6px ${GREEN}`}}/>
          <span style={{fontSize:10.5,fontWeight:600,color:"rgba(255,255,255,.6)"}}>Real-time report</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {[
          {label:"Total Mapped",value:withGps.length,color:"#080D1A"},
          {label:"High Quality",value:withGps.filter(s=>s.overall_score>=70).length,color:GREEN},
          {label:"Needs Review",value:withGps.filter(s=>s.overall_score>=45&&s.overall_score<70).length,color:AMBER},
          {label:"Flagged",value:withGps.filter(s=>s.verdict==="FLAG").length,color:RED},
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