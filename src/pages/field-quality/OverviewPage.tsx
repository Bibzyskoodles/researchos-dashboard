import React, { useEffect, useState } from "react";
import { dashboardApi } from "../../services/api";
import { DashboardData } from "../../types";
import { useAuth } from "../../store/AuthContext";
import { useAda } from "../../ada/AdaContext";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Users, Activity } from "lucide-react";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";

function clr(s: number) { return s >= 70 ? GREEN : s >= 45 ? AMBER : RED; }

function KpiCard({ label, value, sub, trend, color = BLUE }: {
  label: string; value: string | number; sub?: string;
  trend?: number; color?: string;
}) {
  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "18px 20px",
      border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(10,15,28,.04)",
      flex: 1, minWidth: 0, position: "relative", overflow: "hidden",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color, letterSpacing: -1.5, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          {trend >= 0
            ? <TrendingUp size={12} color={GREEN} />
            : <TrendingDown size={12} color={RED} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? GREEN : RED }}>
            {Math.abs(trend)}pts this week
          </span>
        </div>
      )}
    </div>
  );
}

function TrustGauge({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const fill = c * (score / 100);
  const color = clr(score);
  const engines = [
    { k: "GPS", v: 92, c: BLUE },
    { k: "Image", v: 78, c: PURPLE },
    { k: "Audio", v: 91, c: GREEN },
    { k: "Duration", v: 85, c: AMBER },
    { k: "Duplicate", v: 98, c: "#06B6D4" },
  ];
  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
        <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
          <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={60} cy={60} r={r} fill="none" stroke="#EEF2F8" strokeWidth={8} />
            <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={8}
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - fill} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -2, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>Trust</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {engines.map(e => (
            <div key={e.k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: e.c, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#374151", width: 60, flexShrink: 0 }}>{e.k}</div>
              <div style={{ flex: 1, height: 3, background: "#EEF2F8", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${e.v}%`, height: "100%", background: e.c, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", width: 22, textAlign: "right" }}>{e.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { setState } = useAda();

  useEffect(() => {
    dashboardApi.getDashboard()
      .then(res => { setData(res.data); setState("idle"); })
      .catch(() => setState("warning"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "#9CA3AF", fontSize: 14 }}>
      Ada is reviewing your data...
    </div>
  );

  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: RED, fontSize: 14 }}>
      Could not load dashboard data
    </div>
  );

  const s = data.stats;
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Ada Hero Briefing */}
      <div style={{
        background: "linear-gradient(135deg,#EFF6FF 0%,#F8FAFF 55%,#F0F7FF 100%)",
        border: "1px solid #E2E8F0", borderRadius: 16, padding: "24px 28px",
        display: "flex", alignItems: "flex-start", gap: 20,
      }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid #EEF2FF", boxShadow: "0 2px 12px rgba(37,99,235,.2)" }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: .5, background: "#EEF4FF", padding: "2px 8px", borderRadius: 10 }}>ADA · AI</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: BLUE, background: "rgba(37,99,235,.1)", padding: "3px 8px", borderRadius: 4 }}>AI Briefing</span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.5, color: "#080D1A", marginBottom: 4 }}>{greet}, {user?.name?.split(" ")[0]}!</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 16 }}>{"Here\'s what happened while you were away."}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#374151" }}>
              <CheckCircle size={14} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>{s.total_submissions} submissions processed</strong> — data quality is {s.avg_score >= 80 ? "excellent" : "good"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#374151" }}>
              {s.score_trend >= 0 ? <TrendingUp size={14} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} /> : <TrendingDown size={14} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>Average trust score <strong style={{ color: s.score_trend >= 0 ? GREEN : RED }}>{s.score_trend >= 0 ? "↑" : "↓"} {Math.abs(s.score_trend)}pts this week</strong> to <strong>{s.avg_score}/100</strong></span>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#374151" }}>
              <Activity size={14} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>GPS compliance is strong</strong> — 100% of submissions verified within Nigeria</span>
            </div>
            {s.flag_count > 0 && (
              <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#374151" }}>
                <AlertTriangle size={14} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
                <span><strong style={{ color: AMBER }}>{s.flag_count} submission{s.flag_count > 1 ? "s" : ""} require attention</strong> — review before approving</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, minWidth: 200, background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: .7, marginBottom: 10 }}>Recommended Actions</div>
          {[
            s.flag_count > 0 ? `Review ${s.flag_count} flagged submission${s.flag_count > 1 ? "s" : ""}` : null,
            `Analyse ${s.pass_count} verified responses`,
            "Generate interim client report",
          ].filter(Boolean).map((action, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
              border: "1px solid #E2E8F0", borderRadius: 8, marginBottom: 6,
              cursor: "pointer", background: "#FAFBFF", fontSize: 11.5, fontWeight: 600, color: "#0A0F1C",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: "#EEF4FF", color: BLUE, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              {action}
              <span style={{ marginLeft: "auto", color: "#9CA3AF", fontSize: 10 }}>→</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 14 }}>
        <KpiCard label="Total Submissions" value={s.total_submissions} sub="Lagos Retail Audit" trend={s.score_trend} color="#080D1A" />
        <KpiCard label="Avg Trust Score" value={`${s.avg_score}/100`} sub={s.avg_score >= 80 ? "Excellent" : "Good"} color={GREEN} />
        <KpiCard label="Pass Rate" value={`${s.pass_rate}%`} sub={`${s.pass_count} of ${s.total_submissions}`} color={BLUE} />
        <KpiCard label="Active Enumerators" value={s.active_enumerators} sub="All performing" color={PURPLE} />
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* Submission Feed */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>Submission Activity</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Real-time intelligence feed</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, cursor: "pointer" }}>View all →</span>
          </div>
          {data.recent_submissions.slice(0, 6).map((sub, i) => (
            <div key={sub.submission_id} style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px",
              borderBottom: i < 5 ? "1px solid #F8FAFF" : "none",
              cursor: "pointer", transition: "background .1s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#FAFBFF")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
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
                <div style={{ fontSize: 12, fontWeight: 600, color: "#080D1A", marginBottom: 2 }}>
                  {sub.verdict === "PASS" ? "Submission verified" : "Review required"}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{sub.enumerator_id} {sub.gps?.address ? `· ${sub.gps.address.split(",").slice(0, 2).join(",")}` : ""}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", background: sub.verdict === "PASS" ? "#ECFDF5" : sub.verdict === "FLAG" ? "#FFFBEB" : "#FEF2F2", color: sub.verdict === "PASS" ? GREEN : sub.verdict === "FLAG" ? AMBER : RED }}>{sub.verdict}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", background: "#EFF6FF", color: BLUE }}>{sub.overall_score}/100</span>
                  {sub.flags && sub.flags.split(",").filter(Boolean).map(f => (
                    <span key={f} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", background: "#F1F5F9", color: "#6B7280" }}>{f.trim().replace(/_/g, " ")}</span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: clr(sub.overall_score), flexShrink: 0 }}>{sub.overall_score}</div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Trust Score */}
          <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>Trust Score</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Weighted across all engines</div>
            </div>
            <TrustGauge score={s.avg_score} />
          </div>

          {/* Alerts */}
          {s.flag_count > 0 && (
            <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>⚠ Alerts</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, cursor: "pointer" }}>View all</span>
              </div>
              {data.alerts.slice(0, 3).map(a => (
                <div key={a.submission_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #F8FAFF", cursor: "pointer" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#FEF2F2", display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>🚩</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#080D1A" }}>{a.verdict} — {(a.flags || "").split(",")[0] || "Review needed"}</div>
                    <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{a.enumerator_id} · {new Date(a.scored_at).toLocaleDateString("en-GB")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Enumerator leaderboard */}
          <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>Enumerators</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, cursor: "pointer" }}>View all →</span>
            </div>
            {data.enumerators.slice(0, 4).map((e, i) => {
              const colors = [BLUE, PURPLE, GREEN, AMBER, RED];
              const col = colors[i % colors.length];
              return (
                <div key={e.enumerator_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #F8FAFF", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: i < 3 ? AMBER : "#9CA3AF", width: 16, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: col, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {e.enumerator_id.slice(-2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#080D1A" }}>{e.enumerator_id}</div>
                    <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{e.total_subs} interviews</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: clr(e.avg_score) }}>{e.avg_score}</div>
                  <div style={{ fontSize: 11 }}>{e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}