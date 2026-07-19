import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, Award, Sparkles } from "lucide-react";
import { dashboardApi } from "../../services/api";
import { usePlatform } from "../../platform/PlatformProvider";
import { useProject } from "../../context/ProjectContext";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", GOLD = "#D97706";

interface LeaderboardEntry {
  rank: number;
  enumerator_id: string;
  total_submissions: number;
  pass_count: number;
  flag_count: number;
  reject_count: number;
  pass_rate: number;
  avg_score: number;
  trend: number;
  badges: string[];
}

const BADGE_META: Record<string, { label: string; color: string }> = {
  top_performer: { label: "Top performer", color: GOLD },
  most_improved: { label: "Most improved", color: BLUE },
  highly_reliable: { label: "Highly reliable", color: GREEN },
};

// Org-wide leaderboard — aggregated server-side (GET /api/enumerators/leaderboard)
// across every project in the org, not just the currently active one. This is
// the enumerator-facing "top performers" recognition surface: complements
// (rather than duplicates) ScorecardPage.tsx's individual risk-banded
// profiles, which stay scoped to one project's client-side submission fetch.
export default function OrgLeaderboardTab() {
  const { t } = usePlatform();
  const { activeProject } = useProject();
  const [scope, setScope] = useState<"org" | "project">("org");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [topPerformers, setTopPerformers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enumeratorsLabel = t("enumerators", "enumerators");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = scope === "project" && activeProject?.id ? { project_id: activeProject.id } : undefined;
    dashboardApi.getEnumeratorLeaderboard(params)
      .then(r => {
        setEntries(r.data.leaderboard || []);
        setTopPerformers(r.data.top_performers || []);
      })
      .catch((e) => {
        // A client-role account gets a 403 here by design (see api.py's
        // _reject_client_role) — enumerator-identifying data is out of
        // client scope. Any other failure just shows a generic message.
        if (e?.response?.status === 403) setError("Enumerator leaderboard data isn't available for your account role.");
        else setError("Could not load the leaderboard right now.");
        setEntries([]);
        setTopPerformers([]);
      })
      .finally(() => setLoading(false));
  }, [scope, activeProject?.id]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#6B7280" }}>
          {loading ? "Loading…" : `${entries.length} ${enumeratorsLabel} ranked${scope === "org" ? " across all projects" : " on this project"}`}
        </div>
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 9, padding: 3 }}>
          {(["org", "project"] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} disabled={s === "project" && !activeProject}
              style={{
                padding: "6px 12px", borderRadius: 6, border: "none",
                cursor: (s === "project" && !activeProject) ? "not-allowed" : "pointer",
                fontFamily: "Inter,sans-serif", fontSize: 11.5, fontWeight: scope === s ? 700 : 500,
                background: scope === s ? "white" : "transparent", color: scope === s ? BLUE : "#6B7280",
                boxShadow: scope === s ? "0 1px 4px rgba(10,15,28,.08)" : "none",
              }}>
              {s === "org" ? "All projects" : "This project"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 12.5, color: "#DC2626" }}>
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", background: "white", borderRadius: 14, border: "1px solid #E8EDF5" }}>
          <Trophy size={26} color="#E2E8F0" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>No ranked submissions yet</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>The leaderboard fills in once submissions are scored.</div>
        </div>
      )}

      {topPerformers.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles size={13} color={GOLD} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: .7 }}>Top Performers</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, topPerformers.length)}, 1fr)`, gap: 12 }}>
            {topPerformers.slice(0, 3).map((e, i) => (
              <motion.div key={e.enumerator_id} whileHover={{ y: -3 }}
                style={{ background: "white", borderRadius: 14, padding: 16, border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{medals[i] || "🏅"}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF" }}>#{e.rank}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A", marginBottom: 4 }}>{e.enumerator_id}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>{e.total_submissions} submissions · {e.pass_rate}% pass rate</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {e.badges.map(b => {
                    const meta = BADGE_META[b] || { label: b, color: "#6B7280" };
                    return (
                      <span key={b} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: meta.color + "15", color: meta.color, border: `1px solid ${meta.color}30` }}>
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 6 }}>
            <Award size={13} color="#9CA3AF" />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#080D1A" }}>Full Leaderboard</div>
          </div>
          {entries.map((e) => {
            const TrendIcon = e.trend > 2 ? TrendingUp : e.trend < -2 ? TrendingDown : Minus;
            const trendColor = e.trend > 2 ? GREEN : e.trend < -2 ? RED : "#9CA3AF";
            return (
              <div key={e.enumerator_id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: "1px solid #F8FAFF" }}>
                <div style={{ width: 22, fontSize: 11, fontWeight: 700, color: e.rank <= 3 ? GOLD : "#CBD5E1", textAlign: "center" }}>
                  {e.rank <= 3 ? "★" : e.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#080D1A" }}>{e.enumerator_id}</span>
                    {e.badges.slice(0, 2).map(b => {
                      const meta = BADGE_META[b] || { label: b, color: "#6B7280" };
                      return (
                        <span key={b} style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: meta.color + "15", color: meta.color }}>
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>
                    {e.total_submissions} submissions · {e.pass_count} passed · {e.flag_count} flagged · {e.reject_count} rejected
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 60 }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>Pass rate</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: e.pass_rate >= 80 ? GREEN : e.pass_rate >= 50 ? AMBER : RED }}>{e.pass_rate}%</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 50 }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>Avg score</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A", fontFamily: "monospace" }}>{e.avg_score}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 36, justifyContent: "flex-end" }}>
                  <TrendIcon size={13} color={trendColor} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: trendColor }}>{Math.abs(e.trend)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
