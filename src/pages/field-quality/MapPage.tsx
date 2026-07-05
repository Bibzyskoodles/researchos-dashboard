import React, { useEffect, useState } from "react";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";

const GREEN="#059669",AMBER="#D97706",RED="#DC2626",BLUE="#2463EB";
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

// Convert lon/lat to SVG percentage coordinates
// SVG viewBox: 0 0 1000 500
// lon: -180 to 180 -> 0 to 1000
// lat: 90 to -90 -> 0 to 500
function toSVG(lon:number,lat:number):[number,number]{
  const x=((lon+180)/360)*1000;
  const y=((90-lat)/180)*500;
  return[x,y];
}

// World land masses as dot positions [lon, lat]
const DOTS:[number,number][]=[];
const LAND=[
  // North America
  {lon:[-165,-60],lat:[15,75]},
  // South America  
  {lon:[-80,-35],lat:[-55,15]},
  // Europe
  {lon:[-10,40],lat:[35,70]},
  // Africa
  {lon:[-18,52],lat:[-35,37]},
  // Asia (west)
  {lon:[40,90],lat:[10,75]},
  // Asia (east)
  {lon:[90,145],lat:[-10,75]},
  // Australia
  {lon:[113,155],lat:[-45,-10]},
  // UK
  {lon:[-8,2],lat:[50,59]},
  // Japan
  {lon:[130,145],lat:[30,45]},
  // Indonesia
  {lon:[95,141],lat:[-8,5]},
];

for(const region of LAND){
  for(let lon=region.lon[0];lon<=region.lon[1];lon+=3.5){
    for(let lat=region.lat[0];lat<=region.lat[1];lat+=3.5){
      DOTS.push([lon,lat]);
    }
  }
}

export default function MapPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [filter,setFilter]=useState("ALL");
  const [hovered,setHovered]=useState<Submission|null>(null);
  useAdaGreeting({page:"map"});

  useEffect(()=>{
    dashboardApi.getSubmissions({limit:100}).then(r=>setSubs(r.data.submissions||[]));
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
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid",fontSize:11.5,fontWeight:600,cursor:"pointer",
                borderColor:filter===v?BLUE:"#E2E8F0",background:filter===v?BLUE:"white",color:filter===v?"white":"#6B7280"}}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{background:"#080E1F",borderRadius:20,overflow:"hidden",border:"1px solid #1A2744",boxShadow:"0 8px 40px rgba(8,13,26,.4)",position:"relative",height:460}}>
        <svg width="100%" height="100%" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" style={{position:"absolute",inset:0}}>
          {/* World dots */}
          {DOTS.map(([lon,lat],i)=>{
            const[x,y]=toSVG(lon,lat);
            return <circle key={i} cx={x} cy={y} r="2.2" fill="rgba(255,255,255,.15)"/>;
          })}

          {/* Continent labels */}
          <text x="200" y="200" fontSize="14" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">North America</text>
          <text x="280" y="330" fontSize="12" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">South America</text>
          <text x="490" y="170" fontSize="12" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">Europe</text>
          <text x="500" y="270" fontSize="14" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">Africa</text>
          <text x="700" y="160" fontSize="14" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">Asia</text>
          <text x="820" y="370" fontSize="12" fill="rgba(255,255,255,.2)" fontFamily="Inter" textAnchor="middle">Australia</text>

          {/* Submission dots */}
          {withGps.map(sub=>{
            const[x,y]=toSVG(Number(sub.gps.lon),Number(sub.gps.lat));
            const color=clr(sub.overall_score);
            const isH=hovered?.submission_id===sub.submission_id;
            return(
              <g key={sub.submission_id}
                onMouseEnter={()=>setHovered(sub)}
                onMouseLeave={()=>setHovered(null)}
                style={{cursor:"pointer"}}>
                {/* Glow */}
                <circle cx={x} cy={y} r={isH?18:12} fill={color} opacity="0.15"/>
                {/* Dot */}
                <circle cx={x} cy={y} r={isH?8:sub.verdict==="FLAG"?6:5}
                  fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered&&(
          <div style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",
            background:"rgba(8,14,31,.95)",backdropFilter:"blur(8px)",
            border:"1px solid rgba(255,255,255,.1)",borderRadius:10,
            padding:"10px 16px",zIndex:10,minWidth:200,textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:700,color:"white",marginBottom:2}}>{hovered.enumerator_id}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:6}}>{hovered.gps?.address?.split(",").slice(0,2).join(",")}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,
                background:hovered.verdict==="PASS"?"#ECFDF5":"#FFFBEB",
                color:clr(hovered.overall_score)}}>{hovered.verdict}</span>
              <span style={{fontSize:13,fontWeight:800,color:clr(hovered.overall_score),fontFamily:"monospace"}}>{hovered.overall_score}/100</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:12,
          background:"rgba(8,14,31,.85)",backdropFilter:"blur(8px)",
          borderRadius:10,padding:"8px 14px",border:"1px solid rgba(255,255,255,.06)"}}>
          {[{c:GREEN,l:"High quality"},{c:AMBER,l:"Needs review"},{c:RED,l:"Flagged"}].map(({c,l})=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,color:"rgba(255,255,255,.6)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
              {l}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8}}>
          {[
            {v:withGps.length,l:"Mapped",c:"white"},
            {v:withGps.filter(s=>s.overall_score>=70).length,l:"Quality",c:GREEN},
            {v:withGps.filter(s=>s.verdict==="FLAG").length,l:"Flagged",c:AMBER},
          ].map(({v,l,c})=>(
            <div key={l} style={{background:"rgba(8,14,31,.85)",backdropFilter:"blur(8px)",borderRadius:10,padding:"8px 12px",border:"1px solid rgba(255,255,255,.06)",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:c,letterSpacing:-1,lineHeight:1}}>{v}</div>
              <div style={{fontSize:9.5,color:"rgba(255,255,255,.4)",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Real-time */}
        <div style={{position:"absolute",top:16,left:16,display:"flex",alignItems:"center",gap:6,
          background:"rgba(8,14,31,.85)",borderRadius:8,padding:"6px 10px",
          border:"1px solid rgba(255,255,255,.06)"}}>
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
          <div key={label} style={{background:"white",borderRadius:12,padding:"16px 18px",border:"1px solid #E8EDF5"}}>
            <div style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>{label}</div>
            <div style={{fontSize:28,fontWeight:800,color,letterSpacing:-1.5,lineHeight:1}}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}