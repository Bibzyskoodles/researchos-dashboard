import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { dashboardApi } from "../../services/api";
import { Enumerator, Submission } from "../../types";
import { AlertTriangle, Users, Award, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAdaAttention } from "../../hooks/useAdaAttention";
import { usePlatform } from "../../platform/PlatformProvider";
import ScorecardPage from "./ScorecardPage";
import OrgLeaderboardTab from "./OrgLeaderboardTab";
import { useProject } from "../../context/ProjectContext";
import { useAuth } from "../../store/AuthContext";
import { loadEngineConfig } from "../../services/engineConfig";
import { computeTrustIndex } from "../../services/trustEngine";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",RED="#DC2626",PURPLE="#7C3AED";
const COLORS=[BLUE,PURPLE,GREEN,AMBER,RED];
const clr=(s:number)=>s>=70?GREEN:s>=45?AMBER:RED;

// ── Inline reputation estimate from enumerator aggregates ─────────────────────
// Full Trust-Index-based Bayesian reputation requires per-submission data;
// this quick estimate uses the aggregate fields already fetched.

type RiskBand = "TRUSTED" | "WATCH" | "CONCERN" | "CRITICAL";

interface QuickReputation {
  score: number;      // 0–100 Bayesian estimate
  riskBand: RiskBand;
  riskColor: string;
  riskLabel: string;
}

const PRIOR_MEAN = 70;
const PRIOR_STRENGTH = 5;

function quickReputation(e: Enumerator): QuickReputation {
  const n     = e.total_submissions ?? e.total_subs ?? 1;
  const avg   = e.avg_score ?? 50;
  const score = Math.round((PRIOR_MEAN * PRIOR_STRENGTH + avg * n) / (PRIOR_STRENGTH + n));
  const rejectRate = n > 0
    ? 1 - ((e.pass_rate ?? 0) / 100) - ((e.flag_count ?? e.flags ?? 0) / n)
    : 0;

  const riskBand: RiskBand =
    score >= 80 && rejectRate < 0.10 ? "TRUSTED"  :
    score >= 65 && rejectRate < 0.30 ? "WATCH"    :
    score >= 50                       ? "CONCERN"  : "CRITICAL";

  const riskColor =
    riskBand === "TRUSTED"  ? GREEN  :
    riskBand === "WATCH"    ? BLUE   :
    riskBand === "CONCERN"  ? AMBER  : RED;

  const riskLabel =
    riskBand === "TRUSTED"  ? "Trusted researcher"          :
    riskBand === "WATCH"    ? "Acceptable — keep watching"  :
    riskBand === "CONCERN"  ? "Patterns need review"        :
                              "Consistent quality issues";

  return { score, riskBand, riskColor, riskLabel };
}

type Tab = "team" | "scorecard" | "leaderboard";

export default function EnumeratorsPage(){
  const [enums,setEnums]=useState<Enumerator[]>([]);
  // Capped, per-engine detail rows from /api/enumerators (see api.py's
  // enumerators() route comment) — used below to recompute each
  // enumerator's pass/flag/reject counts live from the *current* engine
  // config, the same way every individual submission row already does
  // (SubmissionsPage.tsx's effectiveVerdict / OverviewPage.tsx's liveStats).
  // Without this, `enums` alone carries only the backend's raw, frozen
  // Verdict tally, which can silently disagree with what clicking into an
  // enumerator's own submissions shows.
  const [enumSubs,setEnumSubs]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Enumerator|null>(null);
  const [activeTab,setActiveTab]=useState<Tab>("team");
  const [highlightedId,setHighlightedId]=useState<string|null>(null);
  const { t }=usePlatform();
  const { activeProject } = useProject();
  const { user } = useAuth();
  // Org-wide leaderboard is enumerator-identifying data, blocked server-side
  // for the client role (api.py's _reject_client_role) — hide the tab
  // entirely for that role rather than showing a tab that always 403s.
  const canSeeLeaderboard = user?.role !== "client";
  const termPlural=t("enumerators","enumerators");
  const Term=termPlural.replace(/\b\w/g,c=>c.toUpperCase());
  useAdaGreeting({ page: "enumerators" });
  useAdaAttention({ x: 0.85, y: 0.45 }, { delay: 2000, returnAfterMs: 5000 });

  useEffect(()=>{
    const handler=(e:Event)=>{ const {id}=(e as CustomEvent).detail; setHighlightedId(id||null); };
    window.addEventListener("ada:highlight_enumerator",handler);
    return ()=>window.removeEventListener("ada:highlight_enumerator",handler);
  },[]);

  useEffect(()=>{
    // Active project scopes the list; none = explicit "All projects" view.
    dashboardApi.getEnumerators(activeProject?.id ? { project_id: activeProject.id } : undefined)
      .then(r=>{ setEnums(r.data.enumerators||[]); setEnumSubs(r.data.enumerator_submissions||[]); })
      .catch(()=>{ setEnums([]); setEnumSubs([]); })
      .finally(()=>setLoading(false));
  },[activeProject?.id]);

  // Per-enumerator live pass/flag/reject counts, grouped from the capped
  // detail rows above. `pendingFlagged` additionally excludes anything
  // already reviewed (review_status APPROVED/REJECTED via
  // /api/submissions/<sid>/action), mirroring OverviewPage.tsx's
  // liveStats/pendingFlagged so a "needs review" style number here clears
  // once a supervisor has actually acted on it.
  const liveEnumStats = useMemo(() => {
    const map: Record<string, { pass:number; flag:number; reject:number; pendingFlagged:number; total:number }> = {};
    if (!enumSubs.length) return map;
    const cfg = loadEngineConfig();
    const isResolved = (sub: any) => sub.review_status === "APPROVED" || sub.review_status === "REJECTED";
    for (const sub of enumSubs) {
      const eid = sub.enumerator_id;
      if (!eid) continue;
      const bucket = map[eid] || (map[eid] = { pass:0, flag:0, reject:0, pendingFlagged:0, total:0 });
      const v = ((sub as any).verdict_override || computeTrustIndex(sub as any, cfg).verdict || sub.verdict || "FLAG") as "PASS"|"FLAG"|"REJECT";
      bucket.total++;
      if (v === "PASS") bucket.pass++;
      else if (v === "REJECT") bucket.reject++;
      else bucket.flag++;
      if (v === "FLAG" && !isResolved(sub)) bucket.pendingFlagged++;
    }
    return map;
  }, [enumSubs]);

  // Live-recomputed view of one enumerator — falls back to the raw
  // pass_count/flag_count/pass_rate this enumerator's submissions weren't
  // covered by the capped detail set (or before it's loaded), same
  // graceful-degrade pattern as OverviewPage.tsx's liveStats fallback.
  const withLiveCounts = (e: Enumerator): Enumerator & { pendingFlagged?: number } => {
    const live = liveEnumStats[e.enumerator_id];
    if (!live) return e;
    return {
      ...e,
      total_submissions: live.total,
      pass_count: live.pass,
      flag_count: live.flag,
      flags: live.flag,
      pass_rate: live.total ? Math.round((live.pass / live.total) * 1000) / 10 : e.pass_rate,
      pendingFlagged: live.pendingFlagged,
    };
  };

  if(loading) return <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Loading {termPlural}...</div>;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "team", label: `${Term} Overview`, icon: Users },
    { id: "scorecard", label: "Scorecard & Profiles", icon: Award },
    ...(canSeeLeaderboard ? [{ id: "leaderboard" as Tab, label: "Leaderboard", icon: Trophy }] : []),
  ];

  return(
    <div data-ada-target="enumerators-list" style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>{Term}</h1>
        <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>{enums.length} active this project</p>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,background:"#F1F5F9",borderRadius:10,padding:4,alignSelf:"flex-start"}}>
        {tabs.map(tab=>{
          const Icon=tab.icon;
          const active=activeTab===tab.id;
          return(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12.5,fontWeight:active?700:500,
                background:active?"white":"transparent",color:active?BLUE:"#6B7280",
                boxShadow:active?"0 1px 4px rgba(10,15,28,.08)":"none",transition:"all .15s"}}>
              <Icon size={13}/>{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab==="scorecard" && <ScorecardPage />}

      {activeTab==="leaderboard" && canSeeLeaderboard && <OrgLeaderboardTab />}

      {activeTab==="team" && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {enums.slice(0,3).map((e,i)=>{
              const medals=["🥇","🥈","🥉"];
              const col=COLORS[i];
              const eff = withLiveCounts(e);
              const displayName = e.name || e.enumerator_id;
              const totalSubs = eff.total_submissions ?? eff.total_subs ?? 0;
              const flagCount = eff.flags ?? eff.flag_count ?? 0;
              const passCount = eff.pass_count ?? Math.round((eff.pass_rate ?? 0) * totalSubs / 100);
              const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
              const rep = quickReputation(eff);
              return(
                <motion.div key={e.enumerator_id} whileHover={{y:-4, boxShadow: "0 8px 24px rgba(0,61,165,0.12)"}}
                  style={{background:"white",borderRadius:16,padding:"20px",border:highlightedId===e.enumerator_id?"2px solid #2463EB":"1px solid #E8EDF5",boxShadow:highlightedId===e.enumerator_id?"0 0 0 3px #2463EB33, 0 2px 12px rgba(10,15,28,.06)":"0 2px 12px rgba(10,15,28,.06)",cursor:"pointer",position:"relative",overflow:"hidden"}}
                  onClick={()=>setSelected(selected?.enumerator_id===e.enumerator_id?null:e)}>
                  <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"0 0 0 80px",background:col+"12"}}/>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:col,display:"grid",placeItems:"center",fontSize:14,fontWeight:800,color:"white"}}>{initials}</div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <span style={{fontSize:22}}>{medals[i]}</span>
                      <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:5,background:`${rep.riskColor}18`,color:rep.riskColor}}>
                        {rep.riskBand}
                      </span>
                    </div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:"#080D1A",marginBottom:2}}>{displayName}</div>
                  <div style={{fontSize:11,color:"#9CA3AF",marginBottom:12}}>{totalSubs} interviews</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
                    <div style={{fontSize:32,fontWeight:800,color:col,letterSpacing:-2,lineHeight:1}}>{e.avg_score}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>avg · rep <span style={{fontWeight:700,color:rep.riskColor}}>{rep.score}</span></div>
                  </div>
                  <div style={{height:3,background:"#EEF2F8",borderRadius:2,overflow:"hidden",marginBottom:10}}>
                    <motion.div style={{height:"100%",background:col,borderRadius:2}}
                      initial={{width:0}} animate={{width:`${e.avg_score}%`}} transition={{duration:1,ease:"easeOut"}}/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,textAlign:"center",padding:"6px",background:"#F8FAFF",borderRadius:8}}>
                      <div style={{fontSize:14,fontWeight:800,color:GREEN}}>{passCount}</div>
                      <div style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>Passed</div>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:"6px",background:"#F8FAFF",borderRadius:8}}>
                      <div style={{fontSize:14,fontWeight:800,color:flagCount>0?AMBER:"#9CA3AF"}}>{flagCount}</div>
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
                <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Ranked by average trust score · Reputation band from Bayesian model</div>
              </div>
              {enums.map((e,i)=>{
                const col=COLORS[i%COLORS.length];
                const eff = withLiveCounts(e);
                const dName = e.name || e.enumerator_id;
                const tSubs = eff.total_submissions ?? eff.total_subs ?? 0;
                const fCnt  = eff.flags ?? eff.flag_count ?? 0;
                const pCnt  = eff.pass_count ?? Math.round((eff.pass_rate ?? 0) * tSubs / 100);
                const ini   = dName.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                const rep   = quickReputation(eff);
                return(
                  <motion.div key={e.enumerator_id} whileHover={{background:"#F8FAFF"}}
                    onClick={()=>setSelected(selected?.enumerator_id===e.enumerator_id?null:e)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<enums.length-1?"1px solid #F8FAFF":"none",cursor:"pointer",
                      background:selected?.enumerator_id===e.enumerator_id?"#F0F7FF":"white",
                      borderLeft:selected?.enumerator_id===e.enumerator_id?`3px solid ${BLUE}`:"3px solid transparent"}}>
                    <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color:i<3?AMBER:"#9CA3AF",width:20}}>{i+1}</div>
                    <div style={{width:36,height:36,borderRadius:"50%",background:col,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"white",flexShrink:0}}>{ini}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontSize:13,fontWeight:600,color:"#080D1A"}}>{dName}</span>
                        <span style={{fontSize:9.5,fontWeight:700,padding:"1px 6px",borderRadius:4,background:`${rep.riskColor}15`,color:rep.riskColor}}>{rep.riskBand}</span>
                      </div>
                      <div style={{fontSize:11,color:"#9CA3AF"}}>{tSubs} interviews · {pCnt} passed · {fCnt} flagged</div>
                    </div>
                    <div style={{width:110}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:10,color:"#9CA3AF"}}>
                        <span>Score</span>
                        <span>
                          <span style={{fontWeight:700,color:clr(e.avg_score)}}>{e.avg_score}</span>
                          <span style={{color:"#CBD5E1"}}> · rep </span>
                          <span style={{fontWeight:700,color:rep.riskColor}}>{rep.score}</span>
                        </span>
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

            {selected&&(()=>{
              const selEff = withLiveCounts(selected);
              const rep = quickReputation(selEff);
              const TrendIcon = rep.score >= 70 ? TrendingUp : rep.score >= 50 ? Minus : TrendingDown;
              const trendColor = rep.score >= 70 ? GREEN : rep.score >= 50 ? AMBER : RED;
              // "Flagged for review" banner is a "needs attention" style
              // number — gate it on the unreviewed count (review_status not
              // APPROVED/REJECTED) so it clears once a supervisor has
              // actually acted, same as OverviewPage.tsx's pendingFlagged.
              // Falls back to the total flagged count when the live detail
              // set doesn't cover this enumerator (pendingFlagged undefined).
              const pendingFlagged = selEff.pendingFlagged ?? (selected.flags??selected.flag_count??0);
              return (
              <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}
                style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #E8EDF5",boxShadow:"0 4px 24px rgba(10,15,28,.1)",position:"sticky",top:16}}>
                <div style={{padding:"20px",borderBottom:"1px solid #F1F5F9",background:"linear-gradient(135deg,#F8FAFF,white)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:BLUE,display:"grid",placeItems:"center",fontSize:14,fontWeight:800,color:"white"}}>{(selected.name||selected.enumerator_id).split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#080D1A"}}>{selected.name||selected.enumerator_id}</div>
                      <div style={{fontSize:11,color:"#9CA3AF"}}>{selEff.total_submissions??selEff.total_subs??0} interviews · Grade {selected.grade}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:28,fontWeight:800,color:clr(selected.avg_score),letterSpacing:-1,lineHeight:1}}>{selected.avg_score}</div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>avg score</div>
                    </div>
                  </div>
                </div>
                <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>

                  {/* Reputation card */}
                  <div style={{padding:"14px 16px",borderRadius:12,background:`${rep.riskColor}08`,border:`1px solid ${rep.riskColor}22`}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Enumerator Reputation</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:36,fontWeight:800,color:rep.riskColor,letterSpacing:-2,lineHeight:1}}>{rep.score}</div>
                        <div style={{fontSize:9,color:"#9CA3AF",marginTop:2,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>REP SCORE</div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:12.5,fontWeight:700,padding:"3px 10px",borderRadius:6,background:`${rep.riskColor}15`,color:rep.riskColor}}>{rep.riskBand}</span>
                          <TrendIcon size={14} color={trendColor}/>
                        </div>
                        <div style={{fontSize:11.5,color:"#6B7280",lineHeight:1.4}}>{rep.riskLabel}</div>
                        <div style={{fontSize:10.5,color:"#9CA3AF",marginTop:4}}>Bayesian estimate · prior 70 @ 5 virtual subs</div>
                      </div>
                    </div>
                    <div style={{height:4,background:"#EEF2F8",borderRadius:2,overflow:"hidden",marginTop:10}}>
                      <div style={{width:`${rep.score}%`,height:"100%",background:rep.riskColor,borderRadius:2,transition:"width .6s ease"}}/>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      ["Submissions", selEff.total_submissions??selEff.total_subs??0],
                      ["Avg Score",   selected.avg_score+"/100"],
                      ["Passed",      selEff.pass_count??Math.round((selEff.pass_rate??0)*(selEff.total_submissions??selEff.total_subs??1)/100)],
                      ["Flagged",     selEff.flags??selEff.flag_count??0],
                    ].map(([k,v])=>(
                      <div key={k} style={{padding:"12px",background:"#F8FAFF",borderRadius:10,textAlign:"center"}}>
                        <div style={{fontSize:18,fontWeight:800,color:"#080D1A",letterSpacing:-1}}>{v}</div>
                        <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginTop:2}}>{k}</div>
                      </div>
                    ))}
                  </div>
                  {pendingFlagged>0&&(
                    <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",background:"#FFFBEB",borderRadius:10,border:"1px solid #FDE68A"}}>
                      <AlertTriangle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
                      <div style={{fontSize:12,color:"#92400E"}}>{pendingFlagged} submission{pendingFlagged>1?"s":""} flagged for review.</div>
                    </div>
                  )}
                  <div style={{padding:"10px 12px",background:"#F0F9FF",borderRadius:10,border:"1px solid #BAE6FD"}}>
                    <div style={{fontSize:11,color:"#0369A1",lineHeight:1.5}}>
                      <strong>About reputation:</strong> The score starts at 70 (assumed average) and shifts toward actual performance as more submissions come in. A new researcher's score changes quickly; an established one's score requires consistent evidence to move.
                    </div>
                  </div>
                  <button onClick={()=>setActiveTab("scorecard")}
                    style={{padding:"9px",borderRadius:9,background:"#F8FAFF",border:"1px solid #E8EDF5",cursor:"pointer",fontSize:12.5,fontWeight:600,color:BLUE,fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <Award size={13}/> View Full Scorecard Profile
                  </button>
                </div>
              </motion.div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
