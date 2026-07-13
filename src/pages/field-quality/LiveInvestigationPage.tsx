// FieldScore Live Mode — /projects/:projectId/live
// Mission-control screen that watches a project for new submissions and
// plays the Live Investigation automatically when one arrives. Poll-based
// (5s): the moment a submission id we haven't seen appears at the top of
// the list, the notification fires and the investigation takes over.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { dashboardApi, projectsApi } from "../../services/api";
import InvestigationPlayer from "../../investigation/InvestigationPlayer";

const GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626";
const MONO = "'SF Mono','Roboto Mono',Consolas,monospace";

export default function LiveInvestigationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [imageContext, setImageContext] = useState<string | undefined>(undefined);
  const [recent, setRecent] = useState<any[]>([]);
  const [playing, setPlaying] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const seenIds = useRef<Set<string> | null>(null); // null until the baseline poll
  const playingRef = useRef<any>(null);
  playingRef.current = playing;

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then(r => setProjectName(r.data?.project?.name || "")).catch(() => {});
    dashboardApi.getScoringConfig(projectId)
      .then(r => { const c = r.data?.config || r.data; if (c?.image_context) setImageContext(String(c.image_context)); })
      .catch(() => {});
  }, [projectId]);

  const poll = useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await dashboardApi.getSubmissions({ project_id: projectId, limit: 15 });
      const subs: any[] = r.data?.submissions || [];
      setPollError(false);
      setRecent(subs.slice(0, 8));
      if (seenIds.current === null) {
        // Baseline: everything already present is "old" — only NEW arrivals play
        seenIds.current = new Set(subs.map(s => s.submission_id));
        return;
      }
      const fresh = subs.filter(s => !seenIds.current!.has(s.submission_id));
      if (fresh.length) {
        fresh.forEach(s => seenIds.current!.add(s.submission_id));
        // newest first in the API — play in arrival order
        const ordered = [...fresh].reverse();
        setNotification(`New submission received — ${ordered[0].enumerator_id || "unknown enumerator"}`);
        setTimeout(() => setNotification(null), 3500);
        if (!playingRef.current) {
          setPlaying(ordered[0]);
          if (ordered.length > 1) setQueue(q => [...q, ...ordered.slice(1)]);
        } else {
          setQueue(q => [...q, ...ordered]);
        }
      }
    } catch {
      setPollError(true);
    }
  }, [projectId]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [poll]);

  const onInvestigationClose = () => {
    setPlaying(null);
    setQueue(q => {
      if (q.length) { setTimeout(() => setPlaying(q[0]), 800); return q.slice(1); }
      return q;
    });
  };

  const vclr = (v: string) => (v === "PASS" ? GREEN : v === "FLAG" ? AMBER : RED);

  return (
    <div style={{ minHeight: "calc(100vh - 40px)", background: "radial-gradient(ellipse at 50% 0%, #131C36, #0F172A 60%)", borderRadius: 18, padding: "clamp(18px,3vw,34px)", fontFamily: "Inter,sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.span animate={{ opacity: [1, .35, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
              style={{ width: 9, height: 9, borderRadius: "50%", background: pollError ? AMBER : "#60A5FA" }} />
            <span style={{ fontSize: 19, fontWeight: 900, color: "white", letterSpacing: -.3 }}>Live Investigation</span>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.45)", marginTop: 4 }}>
            {projectName || "Project"} · watching for new submissions{pollError ? " · reconnecting…" : ""}
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.8)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
          ← Back
        </button>
      </div>

      {/* waiting state / recent feed */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6vh 0 4vh" }}>
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}
          style={{ width: 120, height: 120, borderRadius: "50%", border: "1px solid rgba(96,165,250,.3)", display: "grid", placeItems: "center", position: "relative", marginBottom: 22 }}>
          <motion.div animate={{ scale: [1, 1.6], opacity: [.5, 0] }} transition={{ duration: 2.4, repeat: Infinity }}
            style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(96,165,250,.5)" }} />
          <span style={{ fontSize: 40 }}>📡</span>
        </motion.div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 6 }}>Listening for field submissions…</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.45)", maxWidth: 420, textAlign: "center", lineHeight: 1.65 }}>
          Submit from KoboToolbox and watch the investigation begin within seconds. Each new arrival is examined live — GPS, timing, duplicates, image, audio — before a verdict is stamped.
        </div>
      </div>

      {/* recent submissions strip */}
      {recent.length > 0 && (
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 10 }}>Recent verdicts</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {recent.map(s => (
              <motion.div key={s.submission_id} layout initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => setPlaying(s)}
                style={{ flexShrink: 0, minWidth: 190, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontFamily: MONO }}>{String(s.submission_id).slice(0, 8)}…</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: vclr(s.verdict), padding: "2px 8px", borderRadius: 10, background: `${vclr(s.verdict)}1c` }}>{s.verdict}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{s.enumerator_id}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)", marginTop: 3 }}>
                  {s.scored_at ? new Date(s.scored_at).toLocaleTimeString() : ""} · replay ▶
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* arrival notification */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            style={{ position: "fixed", top: 18, left: 0, right: 0, margin: "0 auto", width: "fit-content", zIndex: 9500, padding: "12px 22px", borderRadius: 12, background: "#0F172A", border: "1px solid rgba(96,165,250,.5)", color: "white", fontSize: 13, fontWeight: 700, boxShadow: "0 12px 40px rgba(0,0,0,.5)", display: "flex", alignItems: "center", gap: 10 }}>
            <motion.span animate={{ opacity: [1, .3, 1] }} transition={{ duration: .8, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: "50%", background: "#60A5FA" }} />
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* the investigation takeover */}
      <AnimatePresence>
        {playing && (
          <InvestigationPlayer
            sub={playing}
            onClose={onInvestigationClose}
            projectName={projectName}
            imageContext={imageContext}
          />
        )}
      </AnimatePresence>

      {queue.length > 0 && !playing && (
        <div style={{ marginTop: 14, fontSize: 11.5, color: "rgba(255,255,255,.4)" }}>{queue.length} more queued for investigation…</div>
      )}
    </div>
  );
}
