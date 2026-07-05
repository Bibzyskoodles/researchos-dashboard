import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { dashboardApi } from "../../services/api";
import { DashboardData } from "../../types";
import { useAuth } from "../../store/AuthContext";
import { useAda } from "../../ada/AdaContext";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, ArrowRight } from "lucide-react";

const BLUE = "#2463EB"; const GREEN = "#059669"; const AMBER = "#D97706";
const RED = "#DC2626"; const PURPLE = "#7C3AED";
const clr = (s: number) => s >= 70 ? GREEN : s >= 45 ? AMBER : RED;

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={d}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ label, value, sub, trend, color, sparkData }: {
  label: string; value: string | number; sub?: string;
  trend?: number; color?: string; sparkData?: number[];
}) {
  const c = color || BLUE;
  return (
    <motion.div whileHover={{ y: -2 }} style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)", flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: c, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 6 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {trend >= 0 ? <TrendingUp size={11} color={GREEN} /> : <TrendingDown size={11} color={RED} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? GREEN : RED }}>{Math.abs(trend)}pts this week</span>
        </div>
      )}
      {sparkData && sparkData.length > 1 && (
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 100, opacity: 0.4 }}>
          <Sparkline data={sparkData} color={c} />
        </div>
      )}
    </motion.div>
  );
}

function TrustArc({ score }: { score: number }) {
  const engines = [
    { k: "GPS", v: 92, c: BLUE }, { k: "Image", v: 78, c: PURPLE },
    { k: "Audio", v: 91, c: GREEN }, { k: "Duration", v: 85, c: AMBER },
    { k: "Duplicate", v: 98, c: "#06B6D4" },
  ];
  const r = 48; const c2 = 2 * Math.PI * r;
  const color = clr(score);
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "16px 20px" }}>
      <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
        <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={55} cy={55} r={r} fill="none" stroke="#EEF2F8" strokeWidth={7} />
          <motion.circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeLinecap="round" strokeDasharray={c2}
            initial={{ strokeDashoffset: c2 }}
            animate={{ strokeDashoffset: c2 - c2 * (score / 100) }}
            transition={{ duration: 1.2, ease: "easeOut" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -2, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, letterSpacing: .5 }}>TRUST</div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {engines.map(e => (
          <div key={e.k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: e.c, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: "#374151", width: 64, flexShrink: 0 }}>{e.k}</div>
            <div style={{ flex: 1, height: 3, background: "#EEF2F8", borderRadius: 2, overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: e.c, borderRadius: 2 }}
                initial={{ width: 0 }} animate={{ width: `${e.v}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }} />
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", width: 22, textAlign: "right" }}>{e.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { setState } = useAda();
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || "there";

  useEffect(() => {
    dashboardApi.getDashboard()
      .then(res => { setData(res.data); setState("idle"); })
      .catch(() => setState("warning"))
      .finally(() => setLoading(false));
  }, [setState]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
        style={{ fontSize: 14, color: "#9CA3AF", fontFamily: "Inter,sans-serif" }}>
        Ada is reviewing your data...
      </motion.div>
    </div>
  );

  if (!data) return <div style={{ padding: 24, color: RED }}>Could not load data</div>;

  const s = data.stats;
  const chartScores = data.score_chart.map(c => c.score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Ada Hero — large, gradient, immersive */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: "linear-gradient(135deg, #1A1F3E 0%, #0F172A 40%, #1E1B4B 100%)",
          borderRadius: 20, padding: "0", overflow: "hidden",
          position: "relative", minHeight: 200,
          boxShadow: "0 8px 40px rgba(8,13,26,.2)",
        }}
      >
        {/* Background glow */}
        <div style={{ position: "absolute", top: -60, right: 200, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,.25),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: 100, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,.15),transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "stretch", position: "relative", zIndex: 1 }}>
          {/* Ada — large and prominent */}
          <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "20px 10px 0", position: "relative" }}>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 140, height: 140, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(255,255,255,.2)", boxShadow: "0 8px 32px rgba(37,99,235,.4)" }}
            >
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }} />
            </motion.div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 8, marginBottom: 16 }}>Ada · AI Analyst</div>
          </div>

          {/* Briefing content */}
          <div style={{ flex: 1, padding: "28px 24px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 12 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#93C5FD", letterSpacing: 1, textTransform: "uppercase" }}>AI Briefing · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: -.8, marginBottom: 6, lineHeight: 1.1 }}>{greet}, {firstName}!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", marginBottom: 20 }}>Here is what happened while you were away.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { icon: <CheckCircle size={13} color="#34D399" />, text: <><strong style={{ color: "white" }}>{s.total_submissions} submissions processed</strong> <span style={{ color: "rgba(255,255,255,.5)" }}>— data quality is {s.avg_score >= 80 ? "excellent" : "good"}</span></> },
                { icon: s.score_trend >= 0 ? <TrendingUp size={13} color="#34D399" /> : <TrendingDown size={13} color="#F87171" />, text: <><span style={{ color: "rgba(255,255,255,.5)" }}>Average trust score </span><strong style={{ color: s.score_trend >= 0 ? "#34D399" : "#F87171" }}>{s.score_trend >= 0 ? "↑" : "↓"} {Math.abs(s.score_trend)}pts this week</strong><span style={{ color: "rgba(255,255,255,.5)" }}> to </span><strong style={{ color: "white" }}>{s.avg_score}/100</strong></> },
                { icon: <Activity size={13} color="#34D399" />, text: <><strong style={{ color: "white" }}>GPS compliance is strong</strong><span style={{ color: "rgba(255,255,255,.5)" }}> — 100% verified within Nigeria</span></> },
                s.flag_count > 0 ? { icon: <AlertTriangle size={13} color="#FBBF24" />, text: <><strong style={{ color: "#FBBF24" }}>{s.flag_count} submission{s.flag_count > 1 ? "s" : ""} require attention</strong><span style={{ color: "rgba(255,255,255,.5)" }}> — review before approving</span></> } : null,
              ].filter(Boolean).map((item: any, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
                  <div>{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended actions */}
          <div style={{ width: 220, flexShrink: 0, padding: "28px 20px 28px 0", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>Recommended</div>
            {[
              s.flag_count > 0 ? `Review ${s.flag_count} flagged submission${s.flag_count > 1 ? "s" : ""}` : null,
              `Analyse ${s.pass_count} verified responses`,
              "Generate interim report",
            ].filter(Boolean).map((action: any, i) => (
              <motion.div key={i} whileHover={{ x: 3 }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(37,99,235,.4)", display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, color: "#93C5FD", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{action}</div>
                <ArrowRight size={12} color="rgba(255,255,255,.3)" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* KPI Cards with sparklines */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KpiCard label="Total Submissions" value={s.total_submissions} sub="Lagos Retail Audit" trend={s.score_trend} color="#080D1A" sparkData={chartScores} />
        <KpiCard label="Avg Trust Score" value={`${s.avg_score}`} sub={s.avg_score >= 80 ? "Excellent quality" : "Good quality"} color={GREEN} sparkData={chartScores} />
        <KpiCard label="Pass Rate" value={`${s.pass_rate}%`} sub={`${s.pass_count} of ${s.total_submissions} passed`} color={BLUE} sparkData={chartScores.map(v => v > 70 ? 1 : 0)} />
        <KpiCard label="Active Enumerators" value={s.active_enumerators} sub="All performing well" color={PURPLE} sparkData={[1,1,1,1,1,1,1]} />
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>

        {/* Submission feed */}
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>Submission Activity</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Real-time intelligence feed</div>
            </div>
            <motion.span whileHover={{ x: 2 }} style={{ fontSize: 11, fontWeight: 600, color: BLUE, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
              View all <ArrowRight size={11} />
            </motion.span>
          </div>
          {data.recent_submissions.slice(0, 6).map((sub, i) => (
            <motion.div key={sub.submission_id} whileHover={{ background: "#FAFBFF" }}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 20px", borderBottom: i < 5 ? "1px solid #F8FAFF" : "none", cursor: "pointer" }}>
              <div style={{ width: 42, flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#9CA3AF" }}>
                  {new Date(sub.scored_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div style={{ fontSize: 10, color: "#CBD5E1" }}>
                  {new Date(sub.scored_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: clr(sub.overall_score), marginTop: 4 }} />
                {i < 5 && <div style={{ flex: 1, width: 1, background: "#F1F5F9", marginTop: 3 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#080D1A", marginBottom: 2 }}>
                  {sub.verdict === "PASS" ? "Submission verified" : "Review required"}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {sub.enumerator_id}{sub.gps?.address ? ` · ${sub.gps.address.split(",").slice(0,2).join(",")}` : ""}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, fontFamily: "monospace", background: sub.verdict === "PASS" ? "#ECFDF5" : sub.verdict === "FLAG" ? "#FFFBEB" : "#FEF2F2", color: sub.verdict === "PASS" ? GREEN : sub.verdict === "FLAG" ? AMBER : RED }}>{sub.verdict}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, fontFamily: "monospace", background: "#EFF6FF", color: BLUE }}>{sub.overall_score}/100</span>
                  {sub.flags && sub.flags.split(",").filter(Boolean).slice(0,2).map(f => (
                    <span key={f} style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "#F1F5F9", color: "#6B7280" }}>{f.trim().replace(/_/g," ")}</span>
                  ))}
                </div>
              </div>
              <motion.div whileHover={{ scale: 1.1 }} style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: clr(sub.overall_score), flexShrink: 0, minWidth: 32, textAlign: "right" }}>
                {sub.overall_score}
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Trust Score */}
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>Trust Score</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Weighted across all engines</div>
            </div>
            <TrustArc score={s.avg_score} />
          </div>

          {/* Enumerator leaderboard */}
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A" }}>Enumerators</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, cursor: "pointer" }}>View all →</span>
            </div>
            {data.enumerators.slice(0, 4).map((e, i) => {
              const cols = [BLUE, PURPLE, GREEN, AMBER];
              const col = cols[i % cols.length];
              return (
                <motion.div key={e.enumerator_id} whileHover={{ background: "#FAFBFF" }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", borderBottom: i < 3 ? "1px solid #F8FAFF" : "none", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: i < 3 ? AMBER : "#9CA3AF", width: 16 }}>{i+1}</div>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: col, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {e.enumerator_id.slice(-2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#080D1A" }}>{e.enumerator_id}</div>
                    <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{e.total_subs} interviews</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: clr(e.avg_score) }}>{e.avg_score}</div>
                  <div style={{ fontSize: 12, color: e.trend === "up" ? GREEN : e.trend === "down" ? RED : "#9CA3AF" }}>
                    {e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : "—"}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Alerts */}
          {s.flag_count > 0 && (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #FED7AA", boxShadow: "0 2px 12px rgba(217,119,6,.08)" }}>
              <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #FEF3C7", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>⚠ Requires Attention</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: AMBER, cursor: "pointer" }}>View all</span>
              </div>
              {data.alerts.slice(0, 2).map(a => (
                <motion.div key={a.submission_id} whileHover={{ background: "#FFFBEB" }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid #FEF3C7", cursor: "pointer" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#FEF3C7", display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>🚩</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#92400E" }}>{(a.flags || "").split(",")[0]?.trim().replace(/_/g," ") || "Review needed"}</div>
                    <div style={{ fontSize: 10.5, color: "#B45309" }}>{a.enumerator_id} · Score: {a.overall_score}</div>
                  </div>
                  <ArrowRight size={12} color={AMBER} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}