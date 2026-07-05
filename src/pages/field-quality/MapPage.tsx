import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";

const GREEN="#059669",AMBER="#D97706",RED="#DC2626",BLUE="#2463EB";
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

export default function MapPage(){
  const [subs,setSubs]=useState<Submission[]>([]);
  const [filter,setFilter]=useState("ALL");
  useAdaGreeting({page:"map"});

  useEffect(()=>{
    dashboardApi.getSubmissions({limit:100}).then(r=>setSubs(r.data.submissions||[]));
  },[]);

  const filtered=subs.filter(s=>filter==="ALL"||s.verdict===filter);
  const withGps=filtered.filter(s=>s.gps?.lat&&s.gps?.lon&&Math.abs(Number(s.gps.lat))>0.001&&Math.abs(Number(s.gps.lon))>0.001);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>Coverage Map</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>{withGps.length} submissions mapped</p>
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

      <div style={{borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 4px 24px rgba(10,15,28,.1)",height:460}}>
        <MapContainer
          center={[9, 8]}
          zoom={6}
          style={{height:"100%",width:"100%"}}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution=""
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {withGps.map(sub=>{
            const lat=Number(sub.gps.lat);
            const lon=Number(sub.gps.lon);
            const color=clr(sub.overall_score);
            const size=sub.verdict==="FLAG"?18:13;
            const icon=L.divIcon({
              className:"",
              html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 ${sub.verdict==="FLAG"?16:10}px ${color},0 0 ${sub.verdict==="FLAG"?32:20}px ${color}44;"></div>`,
              iconSize:[size,size],
              iconAnchor:[size/2,size/2],
            });
            return(
              <Marker
                key={sub.submission_id}
                position={[lat,lon]}
                icon={icon}
              >
                <Popup>
                  <div style={{fontFamily:"Inter,sans-serif",minWidth:160}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{sub.enumerator_id}</div>
                    <div style={{fontSize:11,color:"#6B7280",marginBottom:6}}>{sub.gps?.address?.split(",").slice(0,2).join(",")}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,
                        background:sub.verdict==="PASS"?"#ECFDF5":"#FFFBEB",
                        color:color}}>{sub.verdict}</span>
                      <span style={{fontSize:13,fontWeight:800,color,fontFamily:"monospace"}}>{sub.overall_score}/100</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

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