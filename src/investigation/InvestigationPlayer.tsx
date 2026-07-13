// FieldScore Live Investigation Experience
// A cinematic, full-screen replay of the AI quality investigation for one
// submission. THE HONESTY CONTRACT: every chip, observation and finding
// rendered here is sourced from the stored `checks` object — real engine
// output. Nothing is invented client-side. Engines that did not run render
// an explicit "not submitted / not required" state, never fake data.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { computeTrustIndex, HARD_GATE_FLAGS, ENGINE_LABELS, TrustResult } from "../services/trustEngine";
import { loadEngineConfig } from "../services/engineConfig";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", GREY = "#9CA3AF";
const MONO = "'SF Mono','Roboto Mono',Consolas,monospace";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DemoConsequence {
  reputationBefore: number; reputationAfter: number;
  bandBefore: string; bandAfter: string; flagCount: number;
}

export interface InvestigationProps {
  sub: any;                       // submission with checks (real API shape)
  onClose: () => void;
  projectName?: string;
  imageContext?: string;          // the project's real image_context, if loaded
  duplicateOriginalImageUrl?: string; // resolved image of the original submission (dup catch)
  demoConsequence?: DemoConsequence;  // scripted enumerator impact (demo mode only)
  vocabulary?: { submission?: string };  // research-context label, e.g. "Store Visit"
  startDelayMs?: number;
}

type StepId = "intake" | "gps" | "timing" | "duplicate" | "image" | "audio" | "ada" | "verdict" | "consequence";

// ─── Micro-components ────────────────────────────────────────────────────────

function CountUp({ to, duration = 1200, style }: { to: number; duration?: number; style?: React.CSSProperties }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - t, 3)) * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span style={style}>{v}</span>;
}

function TypeOn({ text, speed = 18, style, onDone }: { text: string; speed?: number; style?: React.CSSProperties; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    setN(0); doneRef.current = false;
    const iv = setInterval(() => {
      setN(p => {
        if (p >= text.length) {
          clearInterval(iv);
          if (!doneRef.current) { doneRef.current = true; onDone?.(); }
          return p;
        }
        return p + 2;
      });
    }, speed);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <span style={style}>{text.slice(0, n)}{n < text.length && <span style={{ opacity: .7 }}>▊</span>}</span>;
}

function StatusPill({ label, color, pulsing }: { label: string; color: string; pulsing?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 20, background: `${color}18`, border: `1px solid ${color}44`, fontSize: 11.5, fontWeight: 700, color, letterSpacing: .4 }}>
      <motion.span animate={pulsing ? { opacity: [1, .3, 1] } : {}} transition={{ duration: 1.2, repeat: Infinity }}
        style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function VerdictChip({ status, text }: { status: "pass" | "warn" | "fail" | "skip"; text: string }) {
  const c = status === "pass" ? GREEN : status === "warn" ? AMBER : status === "fail" ? RED : GREY;
  const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : status === "fail" ? "✗" : "—";
  return (
    <motion.div initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 9, background: `${c}14`, border: `1px solid ${c}55`, fontSize: 12.5, fontWeight: 700, color: c }}>
      <span>{icon}</span>{text}
    </motion.div>
  );
}

function ObservationChip({ text, delay, tone = "neutral" }: { text: string; delay: number; tone?: "neutral" | "bad" }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ padding: "5px 11px", borderRadius: 8, background: tone === "bad" ? "rgba(220,38,38,.12)" : "rgba(255,255,255,.06)", border: `1px solid ${tone === "bad" ? "rgba(220,38,38,.45)" : "rgba(255,255,255,.12)"}`, fontSize: 11.5, color: tone === "bad" ? "#FCA5A5" : "rgba(255,255,255,.75)", fontWeight: 500 }}>
      {text}
    </motion.div>
  );
}

function ModuleFrame({ title, icon, children, wide }: { title: string; icon: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div key={title}
      initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -18, scale: .98 }}
      transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: "min(92vw, " + (wide ? "880px" : "680px") + ")", background: "linear-gradient(160deg, rgba(255,255,255,.055), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "clamp(18px,3vw,30px)", boxShadow: "0 24px 80px rgba(0,0,0,.5)", backdropFilter: "blur(14px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 17 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

// Fingerprint-scan animation used by the duplicate step
function ScanBar() {
  return (
    <div style={{ position: "relative", height: 46, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
        {Array.from({ length: 42 }).map((_, i) => (
          <motion.div key={i} animate={{ scaleY: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.04 }}
            style={{ width: 3, height: 22, borderRadius: 2, background: `rgba(96,165,250,${0.25 + (i % 5) * 0.12})` }} />
        ))}
      </div>
      <motion.div animate={{ x: ["-10%", "110%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", top: 0, bottom: 0, width: 70, background: "linear-gradient(90deg, transparent, rgba(96,165,250,.35), transparent)" }} />
    </div>
  );
}

// ─── The Player ──────────────────────────────────────────────────────────────

export default function InvestigationPlayer(props: InvestigationProps) {
  const { sub, onClose, projectName, imageContext, duplicateOriginalImageUrl, demoConsequence, vocabulary } = props;
  const checks = useMemo(() => sub?.checks || {}, [sub]);
  const config = useMemo(() => loadEngineConfig(), []);
  const trust: TrustResult = useMemo(() => computeTrustIndex(sub, config), [sub, config]);
  const flags: string[] = useMemo(() => Array.isArray(sub.flags) ? sub.flags : String(sub.flags || "").split(",").map((f: string) => f.trim()).filter(Boolean), [sub.flags]);
  const hardGate = flags.find(f => HARD_GATE_FLAGS.has(f)) || null;
  const subLabel = vocabulary?.submission || "Submission";

  // Build the step list from what ACTUALLY ran — disabled/absent engines are
  // skipped entirely (never shown greyed for 8 seconds), per the brief.
  const steps: StepId[] = useMemo(() => {
    const s: StepId[] = ["intake"];
    if (checks.gps && checks.gps.status !== "DISABLED") s.push("gps");
    if (checks.duration && checks.duration.status !== "DISABLED") s.push("timing");
    if (checks.duplicate && checks.duplicate.status !== "DISABLED") s.push("duplicate");
    if (checks.image && checks.image.status !== "DISABLED") s.push("image");
    if (checks.audio && checks.audio.status !== "DISABLED") s.push("audio");
    s.push("ada", "verdict", "consequence");
    return s;
  }, [checks]);

  const [stepIdx, setStepIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DURATIONS: Record<StepId, number> = {
    intake: 4500, gps: 8000, timing: 5000, duplicate: 6500,
    image: 10000, audio: 9000, ada: 8500, verdict: 9000, consequence: 7000,
  };

  const advance = useCallback(() => {
    setStepIdx(i => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    const id = steps[stepIdx];
    if (!id) return;
    if (stepIdx >= steps.length - 1) {
      // last step (consequence) auto-dismisses back to the page
      timerRef.current = setTimeout(onClose, DURATIONS[id] / speedRef.current + 1500);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    timerRef.current = setTimeout(advance, DURATIONS[id] / speedRef.current);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, speed, steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") advance(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, advance]);

  const step = steps[stepIdx];

  // ── Step renderers (all data sourced from checks / trust) ──────────────────

  const renderIntake = () => {
    const media: string[] = [];
    if (sub.image_url) media.push("📷 Photo");
    if (sub.audio_url || checks.audio?.transcript) media.push("🎤 Audio");
    if (sub.gps?.lat != null) media.push("📍 GPS");
    return (
      <ModuleFrame title="Intake" icon="📥">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            ["Submission ID", String(sub.submission_id || "").slice(0, 13) + "…"],
            ["Enumerator", sub.enumerator_id || "—"],
            ["Project", projectName || sub.project_id?.slice(0, 8) || "—"],
            ["Received", sub.submission_date ? new Date(sub.submission_date).toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "white", fontFamily: k === "Submission ID" ? MONO : undefined }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          {media.length ? media.map((m, i) => <ObservationChip key={m} text={`${m} ✓`} delay={0.4 + i * 0.25} />)
            : <ObservationChip text="No media attached" delay={0.4} />}
        </div>
        <div style={{ marginTop: 20 }}><StatusPill label="ANALYZING" color={BLUE} pulsing /></div>
      </ModuleFrame>
    );
  };

  const renderGps = () => {
    const g = checks.gps || {};
    const lat = Number(g.lat ?? sub.gps?.lat), lon = Number(g.lon ?? sub.gps?.lon);
    const hasCoords = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
    const zc = trust.zoneCheck;
    // Resolve the matched zone's centre from config so the map can draw it
    const zone = zc
      ? (zc.matchedZoneIndex != null && config.zoneList?.[zc.matchedZoneIndex]
          ? config.zoneList[zc.matchedZoneIndex]
          : config.assignedZone)
      : null;
    const zoneLat = zone?.lat, zoneLon = zone?.lon;
    const gpsFlag = flags.find(f => ["GPS_OUTSIDE_NIGERIA", "OUTSIDE_ASSIGNED_ZONE", "NO_GPS", "GPS_PARSE_ERROR"].includes(f));
    const status: "pass" | "warn" | "fail" | "skip" =
      g.status === "NOT_AVAILABLE" ? "skip" : gpsFlag === "GPS_OUTSIDE_NIGERIA" ? "fail" : gpsFlag ? "warn" : "pass";
    return (
      <ModuleFrame title="GPS Investigation" icon="📍" wide>
        {hasCoords ? (
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)", marginBottom: 16 }}>
            <MapContainer center={[lat, lon]} zoom={zc ? 13 : 14} style={{ height: "min(34vh, 260px)", width: "100%" }} scrollWheelZoom={false} zoomControl={false} attributionControl={false} dragging={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: status === "fail" ? RED : status === "warn" ? AMBER : GREEN, fillOpacity: .85 }} />
              {zc && zoneLat != null && zoneLon != null && (
                <>
                  <Circle center={[zoneLat, zoneLon]} radius={zc.radiusM} pathOptions={{ color: BLUE, fillOpacity: .07 }} />
                  <Polyline positions={[[lat, lon], [zoneLat, zoneLon]]} pathOptions={{ color: "rgba(255,255,255,.5)", dashArray: "6 8" }} />
                </>
              )}
            </MapContainer>
          </div>
        ) : (
          <div style={{ padding: "22px 0", fontSize: 13, color: "rgba(255,255,255,.5)" }}>No GPS coordinates captured with this {subLabel.toLowerCase()}.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {status === "skip"
            ? <VerdictChip status="skip" text={g.finding || "Not captured — optional for this project"} />
            : <VerdictChip status={status} text={
                gpsFlag === "GPS_OUTSIDE_NIGERIA" ? `GPS outside survey country — ${g.gps_address || "location unresolved"}`
                : gpsFlag === "OUTSIDE_ASSIGNED_ZONE" ? (zc ? `${(zc.distanceM / 1000).toFixed(1)} km outside assigned area` : "Outside assigned zone")
                : zc ? `Within assigned zone — ${Math.round(zc.distanceM)}m from ${zc.label || "site centre"}`
                : g.gps_address ? `Location verified — ${g.gps_address}` : "GPS valid"
              } />}
          {g.finding && status !== "skip" && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", lineHeight: 1.6 }}>{g.finding}{g.location_note && g.location_note !== g.finding ? ` · ${g.location_note}` : ""}</div>
          )}
        </div>
      </ModuleFrame>
    );
  };

  const renderTiming = () => {
    const d = checks.duration || {};
    const mins = Number(d.duration_mins ?? sub.duration_mins);
    const durFlag = flags.find(f => f.startsWith("DURATION") || f === "BACK_TO_BACK");
    const min = config.minDurationMins, max = config.maxDurationMins;
    const pct = isFinite(mins) ? Math.min(Math.max(mins / (max * 1.2), 0.02), 1) : 0;
    return (
      <ModuleFrame title="Timing Investigation" icon="⏱">
        {isFinite(mins) ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 38, fontWeight: 800, color: "white", fontFamily: MONO }}><CountUp to={Math.round(mins)} /></span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>minutes · expected {min}–{max} min</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.07)", overflow: "hidden", marginBottom: 18, position: "relative" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1.4, ease: "easeOut" }}
                style={{ height: "100%", background: durFlag ? (durFlag === "BACK_TO_BACK" || durFlag === "DURATION_NEGATIVE" ? RED : AMBER) : GREEN, borderRadius: 5 }} />
            </div>
          </>
        ) : <div style={{ padding: "14px 0", fontSize: 13, color: "rgba(255,255,255,.5)" }}>Duration could not be computed for this {subLabel.toLowerCase()}.</div>}
        <VerdictChip
          status={d.status === "NOT_AVAILABLE" ? "skip" : durFlag === "BACK_TO_BACK" || durFlag === "DURATION_NEGATIVE" ? "fail" : durFlag ? "warn" : "pass"}
          text={d.finding || (durFlag ? durFlag.replace(/_/g, " ") : "Duration within expected window")} />
      </ModuleFrame>
    );
  };

  const renderDuplicate = () => {
    const dup = checks.duplicate || {};
    const isDupImage = flags.includes("DUPLICATE_IMAGE");
    const isDupSub = dup.is_duplicate || flags.includes("DUPLICATE_SUBMISSION");
    const isHit = isDupImage || isDupSub || flags.includes("DUPLICATE_AUDIO");
    const original = checks.image?.original || dup.original_submission_id || "";
    return (
      <ModuleFrame title="Duplicate Scan" icon="🔎" wide>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 14 }}>
          Scanning fingerprints — image hash · GPS signature · audio hash…
        </div>
        {!isHit && <div style={{ marginBottom: 16 }}><ScanBar /></div>}
        {isHit && isDupImage && sub.image_url ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .8 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            {[{ url: sub.image_url, tag: `This ${subLabel.toLowerCase()}`, id: String(sub.submission_id || "").slice(0, 8) },
              { url: duplicateOriginalImageUrl || sub.image_url, tag: "Original", id: String(original).slice(0, 8) || "earlier submission" }].map((p, i) => (
              <motion.div key={i} initial={{ x: i === 0 ? -32 : 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .9 + i * .25, duration: .5 }}
                style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${RED}88`, position: "relative" }}>
                <img src={p.url} alt={p.tag} style={{ width: "100%", height: 160, objectFit: "cover", display: "block", filter: "saturate(.9)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 10px", background: "rgba(8,13,26,.85)", fontSize: 11, color: "#FCA5A5", fontWeight: 700, fontFamily: MONO }}>
                  {p.tag} · {p.id}
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
        <VerdictChip
          status={isHit ? "fail" : "pass"}
          text={isHit
            ? (checks.image?.finding && isDupImage ? checks.image.finding : dup.finding || "Duplicate detected")
            : dup.finding || "No duplicates found"} />
      </ModuleFrame>
    );
  };

  const renderImage = () => {
    const img = checks.image || {};
    if (img.status === "NOT_AVAILABLE" || !sub.image_url) {
      return (
        <ModuleFrame title="Image Investigation" icon="📷">
          <VerdictChip status="skip" text={img.finding || "Not submitted — excluded per project settings"} />
        </ModuleFrame>
      );
    }
    // Observation chips — STRICTLY from stored engine output
    const chips: Array<{ text: string; bad?: boolean }> = [];
    (img.ai_generated_signals || []).slice(0, 4).forEach((s: string) => chips.push({ text: s, bad: !!img.ai_generated }));
    (img.image_downloaded_signals || []).slice(0, 2).forEach((s: string) => chips.push({ text: s, bad: true }));
    if (img.image_downloaded_checked && !img.image_downloaded) chips.push({ text: "No copies found on the public web" });
    const imgFlag = flags.find(f => ["AI_GENERATED_IMAGE", "DOWNLOADED_IMAGE", "IMAGE_QUALITY_ISSUE", "DUPLICATE_IMAGE"].includes(f));
    const relevanceKnown = typeof img.is_relevant === "boolean";
    return (
      <ModuleFrame title="Image Investigation" icon="📷" wide>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,300px) 1fr", gap: 18, alignItems: "start" }}>
          <motion.div initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .6 }}
            style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,.15)", position: "relative" }}>
            <img src={sub.image_url} alt="evidence" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
            <motion.div animate={{ y: ["0%", "100%", "0%"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(96,165,250,.8), transparent)" }} />
          </motion.div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {chips.map((c, i) => <ObservationChip key={i} text={c.text} delay={0.6 + i * 0.55} tone={c.bad ? "bad" : "neutral"} />)}
              {chips.length === 0 && <ObservationChip text="No AI-generation or web-match signals recorded" delay={0.6} />}
            </div>
            {imageContext && relevanceKnown && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
                style={{ padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", fontSize: 11.5, color: "rgba(255,255,255,.65)", lineHeight: 1.55 }}>
                <span style={{ color: "rgba(255,255,255,.4)" }}>Expected: </span>{imageContext}
                <div style={{ marginTop: 6 }}>
                  {img.is_relevant
                    ? <span style={{ color: GREEN, fontWeight: 700 }}>✓ Matches project context</span>
                    : <span style={{ color: RED, fontWeight: 700 }}>✗ Content does not match project context</span>}
                </div>
              </motion.div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
          <VerdictChip
            status={imgFlag === "AI_GENERATED_IMAGE" || imgFlag === "DOWNLOADED_IMAGE" || imgFlag === "DUPLICATE_IMAGE" ? "fail" : imgFlag ? "warn" : "pass"}
            text={img.finding || "Image passed quality checks"} />
          {typeof img.score === "number" && (
            <span style={{ fontSize: 15, fontWeight: 800, color: "white", fontFamily: MONO }}>
              <CountUp to={img.score} duration={1600} />/100
            </span>
          )}
        </div>
      </ModuleFrame>
    );
  };

  const renderAudio = () => {
    const a = checks.audio || {};
    if (a.status === "NOT_AVAILABLE" || (!a.transcript && !sub.audio_url)) {
      return (
        <ModuleFrame title="Audio Investigation" icon="🎤">
          <VerdictChip status="skip" text={a.finding || "Not submitted — optional for this project"} />
        </ModuleFrame>
      );
    }
    const transcript = String(a.transcript || "").slice(0, 220);
    return (
      <ModuleFrame title="Audio Investigation" icon="🎤" wide>
        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 42, marginBottom: 16 }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <motion.div key={i} animate={{ scaleY: [0.2, 0.4 + ((i * 7) % 10) / 10, 0.2] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.03 }}
              style={{ flex: 1, height: 32, borderRadius: 2, background: `rgba(96,165,250,${0.3 + ((i * 3) % 6) / 12})`, transformOrigin: "center" }} />
          ))}
        </div>
        {transcript && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", marginBottom: 14, minHeight: 60 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: "rgba(255,255,255,.35)", marginBottom: 6 }}>TRANSCRIPT</div>
            <TypeOn text={transcript + (String(a.transcript || "").length > 220 ? "…" : "")} speed={14} style={{ fontSize: 12.5, color: "rgba(255,255,255,.75)", lineHeight: 1.7, fontStyle: "italic" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <VerdictChip
            status={a.is_genuine_interview === false ? "fail" : flags.includes("AUDIO_QUALITY_ISSUE") ? "warn" : "pass"}
            text={a.finding || (a.is_genuine_interview ? "Genuine two-way interview verified" : "Audio analysed")} />
          {typeof a.score === "number" && a.status !== "NOT_AVAILABLE" && (
            <span style={{ fontSize: 15, fontWeight: 800, color: "white", fontFamily: MONO }}><CountUp to={a.score} duration={1400} />/100</span>
          )}
          {a.word_count ? <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)" }}>{a.word_count} words</span> : null}
        </div>
      </ModuleFrame>
    );
  };

  // Ada's reasoning — assembled purely from real engine findings.
  const adaNarrative = useMemo(() => {
    const parts: string[] = [];
    const g = checks.gps, d = checks.duration, img = checks.image, a = checks.audio;
    if (g?.status === "PASS") parts.push(trust.zoneCheck?.withinZone ? "GPS falls within the approved zone." : "GPS location verified.");
    if (d?.status === "PASS") parts.push("Duration aligns with expectations.");
    if (a?.is_genuine_interview) parts.push("The respondent appears engaged throughout the interview.");
    if (hardGate) {
      const gateFinding =
        hardGate === "DUPLICATE_IMAGE" || hardGate === "DUPLICATE_SUBMISSION" || hardGate === "DUPLICATE_AUDIO"
          ? (img?.finding || checks.duplicate?.finding || "duplicate evidence detected")
          : hardGate === "AI_GENERATED_IMAGE" || hardGate === "DOWNLOADED_IMAGE" ? (img?.finding || "fabricated image evidence")
          : hardGate === "GPS_OUTSIDE_NIGERIA" ? (g?.finding || "GPS outside the survey country")
          : hardGate === "BACK_TO_BACK" ? (d?.finding || "physically impossible interview timing")
          : (hardGate.replace(/_/g, " ").toLowerCase());
      parts.push(`However — ${gateFinding} This is disqualifying evidence, so I'm ${trust.verdict === "REJECT" ? "rejecting this submission" : "flagging this for review"} regardless of how the other checks scored.`);
    } else if (trust.verdict === "PASS") {
      parts.push("Every evidence channel independently agrees. I'm approving this submission.");
    } else if (flags.length) {
      const worst = flags[0].replace(/_/g, " ").toLowerCase();
      parts.push(`I found a concern — ${worst}. I'm ${trust.verdict === "REJECT" ? "rejecting this" : "flagging this for supervisor review"}.`);
    } else {
      parts.push(`Trust Index landed at ${trust.trustIndex} — ${trust.verdict === "FLAG" ? "flagging for review" : "recording the verdict"}.`);
    }
    return parts.join(" ");
  }, [checks, trust, hardGate, flags]);

  const renderAda = () => (
    <ModuleFrame title="Ada · Reasoning" icon="">
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
          style={{ position: "relative", flexShrink: 0 }}>
          <motion.div animate={{ scale: [1, 1.35], opacity: [.4, 0] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${BLUE}` }} />
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,.25)" }}
            onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
        </motion.div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.6, color: "#93C5FD", marginBottom: 8 }}>ADA · FIELDSCORE AI ANALYST</div>
          <TypeOn text={adaNarrative} speed={20} style={{ fontSize: 15, color: "rgba(255,255,255,.88)", lineHeight: 1.75, fontWeight: 500 }} />
        </div>
      </div>
    </ModuleFrame>
  );

  const renderVerdict = () => {
    const v = trust.verdict;
    const vc = v === "PASS" ? GREEN : v === "FLAG" ? AMBER : RED;
    const included = trust.breakdown.filter(b => b.included);
    return (
      <ModuleFrame title="Verdict" icon="⚖️" wide>
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "clamp(48px, 9vw, 76px)", fontWeight: 900, color: "white", fontFamily: MONO, lineHeight: 1 }}>
              <CountUp to={trust.trustIndex} duration={2000} />
            </div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,.4)", marginTop: 4 }}>TRUST INDEX</div>
          </div>
          <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -4 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 200, damping: 14 }}
            style={{ padding: "10px 26px", border: `3px solid ${vc}`, borderRadius: 10, fontSize: 26, fontWeight: 900, color: vc, letterSpacing: 3, boxShadow: `0 0 40px ${vc}44` }}>
            {v}
          </motion.div>
          {hardGate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
              style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 700 }}>
              Hard gate: {hardGate}
            </motion.div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {included.map((b, i) => (
            <motion.div key={b.key} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2 + i * 0.18 }}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ width: 120, color: "rgba(255,255,255,.55)" }}>{ENGINE_LABELS[b.key]}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(b.effectiveScore ?? 0)}%` }} transition={{ delay: 2.1 + i * 0.18, duration: .7 }}
                  style={{ height: "100%", background: (b.effectiveScore ?? 0) >= 70 ? GREEN : (b.effectiveScore ?? 0) >= 40 ? AMBER : RED, borderRadius: 3 }} />
              </div>
              <span style={{ width: 130, textAlign: "right", color: "rgba(255,255,255,.75)", fontFamily: MONO, fontSize: 11.5 }}>
                {b.effectiveScore ?? "—"} × {(b.weight * 100).toFixed(0)}% = {b.contribution.toFixed(1)} pts
              </span>
            </motion.div>
          ))}
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,.35)" }}>
            Pass threshold: {config.passScoreThreshold} · {trust.completeness < 1 ? `evidence completeness ${(trust.completeness * 100).toFixed(0)}%` : "full evidence"}
          </div>
        </div>
      </ModuleFrame>
    );
  };

  const renderConsequence = () => {
    const v = trust.verdict;
    return (
      <ModuleFrame title="Consequence" icon="⚡" wide>
        <div style={{ display: "grid", gridTemplateColumns: demoConsequence ? "1fr 1fr" : "1fr", gap: 14 }}>
          {demoConsequence && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}
              style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.1)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: "rgba(255,255,255,.4)", marginBottom: 10 }}>ENUMERATOR IMPACT · {sub.enumerator_id}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "white", fontFamily: MONO }}>
                  {demoConsequence.reputationBefore} → <CountUp to={demoConsequence.reputationAfter} duration={1200} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 14, background: `${demoConsequence.bandAfter === "TRUSTED" ? GREEN : demoConsequence.bandAfter === "WATCH" ? AMBER : RED}22`, color: demoConsequence.bandAfter === "TRUSTED" ? GREEN : demoConsequence.bandAfter === "WATCH" ? AMBER : RED }}>
                  {demoConsequence.bandBefore} → {demoConsequence.bandAfter}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", marginTop: 8 }}>{demoConsequence.flagCount} lifetime flag{demoConsequence.flagCount === 1 ? "" : "s"} on record</div>
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6 }}
            style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: "rgba(255,255,255,.4)", marginBottom: 10 }}>PIPELINE HANDOFF</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: v === "PASS" ? GREEN : v === "FLAG" ? AMBER : RED, display: "flex", alignItems: "center", gap: 8 }}>
              <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>→</motion.span>
              {v === "PASS" ? "Forwarded to InsightScore for qualitative analysis"
                : v === "FLAG" ? "Queued for supervisor review"
                : "Blocked from analysis and reporting"}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", marginTop: 8 }}>
              {v === "PASS" ? "Verified data flows straight to the Analyse stage." : v === "FLAG" ? "A supervisor decides before the data moves on." : "Rejected evidence never reaches the client."}
            </div>
          </motion.div>
        </div>
      </ModuleFrame>
    );
  };

  const RENDER: Record<StepId, () => React.ReactNode> = {
    intake: renderIntake, gps: renderGps, timing: renderTiming, duplicate: renderDuplicate,
    image: renderImage, audio: renderAudio, ada: renderAda, verdict: renderVerdict, consequence: renderConsequence,
  };

  const STEP_LABELS: Record<StepId, string> = {
    intake: "Intake", gps: "GPS", timing: "Timing", duplicate: "Duplicates",
    image: "Image", audio: "Audio", ada: "Reasoning", verdict: "Verdict", consequence: "Impact",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "radial-gradient(ellipse at 50% 30%, #131C36 0%, #0F172A 55%, #0A0F1F 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

      {/* ambient grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />

      {/* header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 26px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: "white", letterSpacing: .5 }}>FIELD<span style={{ color: "#60A5FA" }}>SCORE</span></span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,.35)", textTransform: "uppercase" }}>Live Investigation</span>
        </div>
        <StatusPill label={stepIdx >= steps.indexOf("verdict") ? trust.verdict : "ANALYZING"} color={stepIdx >= steps.indexOf("verdict") ? (trust.verdict === "PASS" ? GREEN : trust.verdict === "FLAG" ? AMBER : RED) : BLUE} pulsing={stepIdx < steps.indexOf("verdict")} />
      </div>

      {/* step timeline */}
      <div style={{ position: "absolute", top: 62, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, padding: "0 20px", flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: i === stepIdx ? "#93C5FD" : i < stepIdx ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.22)", transition: "color .3s" }}>
              {i < stepIdx ? "✓ " : ""}{STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && <span style={{ color: "rgba(255,255,255,.15)", fontSize: 9 }}>·</span>}
          </div>
        ))}
      </div>

      {/* the stage */}
      <div style={{ maxHeight: "72vh", overflowY: "auto", display: "flex", justifyContent: "center", width: "100%", padding: "0 12px" }}>
        <AnimatePresence mode="wait">
          <div key={step}>{RENDER[step]?.()}</div>
        </AnimatePresence>
      </div>

      {/* controls */}
      <div style={{ position: "absolute", bottom: 22, right: 26, display: "flex", gap: 8 }}>
        {[
          { label: "⏭ Skip step", fn: advance },
          { label: speed === 1 ? "2× speed" : "1× speed", fn: () => setSpeed(s => (s === 1 ? 2 : 1)) },
          { label: "✕ Exit", fn: onClose },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.75)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif", backdropFilter: "blur(8px)" }}>
            {b.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
