// FieldScore Public Interactive Demo — /demo
// "Experience FieldScore — a real fieldwork day in 3 minutes"
// Medows-style guided tour: no signup, no auth, no API calls. The visitor
// plays through one scripted day of fieldwork ("Lagos Consumer Pulse"),
// advanced by clicking the actual UI. The investigation sequences are the
// REAL InvestigationPlayer component — the same one the product uses —
// running over the scripted dataset in demoData.ts.

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import InvestigationPlayer from "../investigation/InvestigationPlayer";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  DEMO_PROJECT, DEMO_ENUMERATORS, DEMO_SUBMISSIONS, DEMO_KPIS, DEMO_THEMES,
  DEMO_SHOWCASE, DEMO_FRAUD, SHELF_PHOTOS,
} from "./demoData";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626";
const MONO = "'SF Mono','Roboto Mono',Consolas,monospace";
const INK = "#0A0F1F";

type Phase = "opening" | "ch1" | "ch2-intro" | "ch2-play" | "ch3-intro" | "ch3-play" | "ch4" | "ch5" | "ch6" | "ch7" | "closing";

const CHAPTER_CLOCK: Record<Phase, string> = {
  opening: "08:00", ch1: "08:00", "ch2-intro": "09:14", "ch2-play": "09:14",
  "ch3-intro": "11:32", "ch3-play": "11:32", ch4: "11:35", ch5: "14:00", ch6: "15:30", ch7: "16:00", closing: "17:00",
};
const CHAPTER_DOT: Record<Phase, number> = {
  opening: -1, ch1: 0, "ch2-intro": 1, "ch2-play": 1, "ch3-intro": 2, "ch3-play": 2, ch4: 3, ch5: 4, ch6: 5, ch7: 6, closing: 7,
};

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: .4, color: light ? "white" : "#080D1A" }}>
      FIELD<span style={{ color: "#60A5FA" }}>SCORE</span>
    </span>
  );
}

function TypeOn({ text, speed = 22, style }: { text: string; speed?: number; style?: React.CSSProperties }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const iv: ReturnType<typeof setInterval> = setInterval(() => {
      setN(p => {
        if (p >= text.length) { clearInterval(iv); return p; }
        return p + 2;
      });
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span style={style}>{text.slice(0, n)}{n < text.length && <span style={{ opacity: .6 }}>▊</span>}</span>;
}

function CountUp({ to, duration = 1400, suffix = "" }: { to: number; duration?: number; suffix?: string }) {
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
  return <>{v.toLocaleString()}{suffix}</>;
}

// The Medows-style caption card + pulsing advance target
function Caption({ text, cta, onNext }: { text: string; cta: string; onNext: () => void }) {
  return (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .6 }}
      style={{ position: "fixed", bottom: "clamp(64px, 10vh, 90px)", left: 0, right: 0, margin: "0 auto", zIndex: 400, width: "min(92vw, 520px)" }}>
      <div style={{ background: "rgba(10,15,31,.92)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: "16px 20px", boxShadow: "0 20px 60px rgba(0,0,0,.55)", backdropFilter: "blur(12px)" }}>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.85)", lineHeight: 1.65, marginBottom: 12 }}>{text}</div>
        <motion.button onClick={onNext} whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
          animate={{ boxShadow: [`0 0 0 0 ${BLUE}66`, `0 0 0 12px ${BLUE}00`] }} transition={{ duration: 1.6, repeat: Infinity }}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: BLUE, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
          {cta}
        </motion.button>
      </div>
    </motion.div>
  );
}

function DemoChrome({ phase, onSkip, onRestart, children }: { phase: Phase; onSkip: () => void; onRestart: () => void; children: React.ReactNode }) {
  const dot = CHAPTER_DOT[phase];
  const isMobile = useIsMobile(560);
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 0%, #131C36, ${INK} 65%)`, fontFamily: "Inter,sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
      {/* top chrome */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px clamp(14px,3vw,26px)", background: "linear-gradient(rgba(10,15,31,.85), transparent)" }}>
        <Wordmark light />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.75)", letterSpacing: 2, whiteSpace: "nowrap" }}>
          <motion.span key={CHAPTER_CLOCK[phase]} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {CHAPTER_CLOCK[phase]}
          </motion.span>
          {!isMobile && (
            <>
              <span style={{ color: "rgba(255,255,255,.3)" }}>·</span>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)" }}>LAGOS · FIELD DAY</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onRestart} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "rgba(255,255,255,.55)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Restart</button>
          <button onClick={onSkip} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "rgba(255,255,255,.55)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Skip tour</button>
        </div>
      </div>
      {children}
      {/* progress dots */}
      {dot >= 0 && dot < 7 && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 500, display: "flex", gap: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ width: i === dot ? 22 : 7, height: 7, borderRadius: 4, background: i === dot ? BLUE : i < dot ? "rgba(96,165,250,.55)" : "rgba(255,255,255,.18)", transition: "all .4s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArrivalToast({ text, tone }: { text: string; tone: "blue" | "amber" }) {
  const c = tone === "amber" ? AMBER : "#60A5FA";
  return (
    <motion.div initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{ position: "fixed", top: 64, left: 0, right: 0, margin: "0 auto", width: "fit-content", zIndex: 450, padding: "13px 22px", borderRadius: 13, background: "#0F172A", border: `1px solid ${c}77`, color: "white", fontSize: 13.5, fontWeight: 700, boxShadow: `0 16px 48px rgba(0,0,0,.55), 0 0 32px ${c}22`, display: "flex", alignItems: "center", gap: 10, maxWidth: "92vw" }}>
      <motion.span animate={{ opacity: [1, .3, 1] }} transition={{ duration: .8, repeat: Infinity }}
        style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
      {text}
    </motion.div>
  );
}

// ─── The Page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>("opening");

  useEffect(() => {
    document.title = "Experience FieldScore — a real fieldwork day in 3 minutes";
  }, []);

  const restart = () => setPhase("opening");
  const skip = () => setPhase("closing");

  // Auto-advance the two intro beats into their investigations
  useEffect(() => {
    if (phase === "ch2-intro") { const t = setTimeout(() => setPhase("ch2-play"), 2600); return () => clearTimeout(t); }
    if (phase === "ch3-intro") { const t = setTimeout(() => setPhase("ch3-play"), 2600); return () => clearTimeout(t); }
  }, [phase]);

  // ── Opening ──────────────────────────────────────────────────────────────
  if (phase === "opening") {
    return (
      <div onClick={() => setPhase("ch1")}
        style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 35%, #16203E, ${INK} 75%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "Inter,sans-serif", padding: 24, textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}>
          <div style={{ fontSize: "clamp(26px, 6vw, 40px)", fontWeight: 900, color: "white", letterSpacing: .5, marginBottom: 14 }}>
            FIELD<span style={{ color: "#60A5FA" }}>SCORE</span>
          </div>
          <div style={{ fontSize: "clamp(15px, 3.2vw, 19px)", color: "rgba(255,255,255,.75)", fontWeight: 500, marginBottom: 42 }}>
            Every field submission, investigated by AI
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .9, duration: .8 }}
          style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: "rgba(255,255,255,.55)", marginBottom: 18 }}>
          08:00 · LAGOS · FIELD DAY
        </motion.div>
        <motion.div animate={{ opacity: [.45, 1, .45] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 13, color: "rgba(255,255,255,.55)" }}>
          Press anywhere to begin your day
        </motion.div>
      </div>
    );
  }

  // ── Closing ──────────────────────────────────────────────────────────────
  if (phase === "closing") {
    return (
      <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 35%, #16203E, ${INK} 75%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif", padding: 24, textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
          <div style={{ fontSize: "clamp(20px, 4.5vw, 30px)", fontWeight: 900, color: "white", marginBottom: 20, letterSpacing: -.4 }}>
            That was one day with FieldScore.
          </div>
          <div style={{ fontSize: "clamp(13px, 2.8vw, 15.5px)", color: "rgba(255,255,255,.65)", lineHeight: 1.8, marginBottom: 40, maxWidth: 560 }}>
            {DEMO_KPIS.total} store visits verified · 1 fraud caught before the client saw it ·<br />
            analysis and report delivered — automatically.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 30 }}>
            <motion.a whileHover={{ scale: 1.03 }} href="mailto:bibilade@intelligencyai.com.ng?subject=FieldScore%20pilot"
              style={{ padding: "13px 28px", borderRadius: 11, background: BLUE, color: "white", fontSize: 14.5, fontWeight: 800, textDecoration: "none", boxShadow: `0 8px 32px ${BLUE}55` }}>
              Book a guided pilot →
            </motion.a>
          </div>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 12.5 }}>
            <button onClick={restart} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", textDecoration: "underline", fontFamily: "Inter,sans-serif", fontSize: 12.5 }}>Replay the day</button>
            <a href="https://intelligencyai.com.ng" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.5)", textDecoration: "underline" }}>intelligencyai.com.ng</a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <DemoChrome phase={phase} onSkip={skip} onRestart={restart}>
      <div style={{ paddingTop: 74, paddingBottom: 70, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>

        {/* ── Chapter 1: Morning briefing ── */}
        {phase === "ch1" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ width: "min(94vw, 760px)", marginTop: "4vh" }}>
            <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.11)", borderRadius: 18, padding: "clamp(18px,3vw,28px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: "clamp(16px,3.4vw,21px)", fontWeight: 900, color: "white", letterSpacing: -.3 }}>{DEMO_PROJECT.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 3 }}>{DEMO_PROJECT.industry} · Target: {DEMO_PROJECT.target} store visits · {DEMO_ENUMERATORS.length} field reps</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 14, background: `${GREEN}22`, color: GREEN }}>COLLECTING</span>
              </div>
              {/* Ada briefing */}
              <div style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14, background: "rgba(36,99,235,.09)", border: "1px solid rgba(96,165,250,.25)", marginBottom: 20 }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,.2)" }}
                  onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: "#93C5FD", marginBottom: 6 }}>ADA · FIELDSCORE'S AI ANALYST</div>
                  <TypeOn text={`Good morning. Your ${DEMO_ENUMERATORS.length} field reps are deploying across Lagos today for the Consumer Pulse retail audit. Target: ${DEMO_PROJECT.target} store visits. I'll investigate every submission as it arrives.`}
                    style={{ fontSize: 13.5, color: "rgba(255,255,255,.85)", lineHeight: 1.7 }} />
                </div>
              </div>
              {/* lifecycle stages */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                {["Design", "Collect", "Verify", "Analyse", "Report"].map((s, i) => (
                  <motion.div key={s}
                    onClick={s === "Verify" ? () => setPhase("ch2-intro") : undefined}
                    animate={s === "Verify" ? { boxShadow: [`0 0 0 0 ${BLUE}66`, `0 0 0 14px ${BLUE}00`] } : {}}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    whileHover={s === "Verify" ? { scale: 1.04 } : {}}
                    style={{ padding: "14px 12px", borderRadius: 12, textAlign: "center", cursor: s === "Verify" ? "pointer" : "default", background: s === "Verify" ? `${BLUE}22` : i < 2 ? "rgba(5,150,105,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${s === "Verify" ? BLUE : i < 2 ? "rgba(5,150,105,.3)" : "rgba(255,255,255,.09)"}` }}>
                    <div style={{ fontSize: 17, marginBottom: 5 }}>{["📝", "📡", "🔍", "🧠", "📄"][i]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s === "Verify" ? "#93C5FD" : i < 2 ? GREEN : "rgba(255,255,255,.5)" }}>{s}</div>
                  </motion.div>
                ))}
              </div>
            </div>
            <Caption text="This is Ada — she investigates every field submission automatically. Your reps are already out in Lagos." cta="Open the Verify stage →" onNext={() => setPhase("ch2-intro")} />
          </motion.div>
        )}

        {/* ── Chapter 2 intro: first submission arrives ── */}
        {phase === "ch2-intro" && (
          <ArrivalToast text="New Store Visit received — Adebayo O. · Shoprite Ikeja" tone="blue" />
        )}
        {phase === "ch2-play" && (
          <InvestigationPlayer
            sub={DEMO_SHOWCASE}
            onClose={() => setPhase("ch3-intro")}
            projectName={DEMO_PROJECT.name}
            imageContext={DEMO_PROJECT.imageContext}
            vocabulary={{ submission: "Store Visit" }}
          />
        )}

        {/* ── Chapter 3 intro: the fraud catch ── */}
        {phase === "ch3-intro" && (
          <ArrivalToast text="⚠ Ada flagged a submission — C. Eze · Justrite Surulere" tone="amber" />
        )}
        {phase === "ch3-play" && (
          <InvestigationPlayer
            sub={DEMO_FRAUD}
            onClose={() => setPhase("ch4")}
            projectName={DEMO_PROJECT.name}
            imageContext={DEMO_PROJECT.imageContext}
            duplicateOriginalImageUrl={SHELF_PHOTOS.duplicate}
            demoConsequence={{ reputationBefore: 71, reputationAfter: 64, bandBefore: "WATCH", bandAfter: "CONCERN", flagCount: 3 }}
            vocabulary={{ submission: "Store Visit" }}
          />
        )}

        {/* ── Chapter 4: reputation consequences ── */}
        {phase === "ch4" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: "min(94vw, 700px)", marginTop: "4vh" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,.4)", marginBottom: 14, textTransform: "uppercase" }}>Field Team · Reputation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DEMO_ENUMERATORS.map((e, i) => {
                const isEze = e.id === "c.eze";
                return (
                  <motion.div key={e.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .12 }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14, background: isEze ? "rgba(220,38,38,.08)" : "rgba(255,255,255,.045)", border: `1px solid ${isEze ? "rgba(220,38,38,.4)" : "rgba(255,255,255,.09)"}` }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${isEze ? RED : BLUE}, ${isEze ? "#7F1D1D" : "#1E3A8A"})`, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800, color: "white", flexShrink: 0 }}>
                      {e.name.split(" ").map(w => w[0]).join("")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "white" }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{e.visits} visits today</div>
                    </div>
                    {isEze ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 19, fontWeight: 900, fontFamily: MONO, color: RED }}>
                          71 → <CountUp to={64} duration={1600} />
                        </div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                          style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: RED }}>
                          WATCH → CONCERN
                        </motion.div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 19, fontWeight: 800, fontFamily: MONO, color: "white" }}>{e.reputation}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: GREEN }}>{e.band}</div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <Caption text="Fraud follows the person, not just the submission. Chinedu's reputation just dropped — and every future submission of his gets extra scrutiny." cta="See the field day live →" onNext={() => setPhase("ch5")} />
          </motion.div>
        )}

        {/* ── Chapter 5: the day, live ── */}
        {phase === "ch5" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: "min(94vw, 860px)", marginTop: "2vh" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Store visits", value: DEMO_KPIS.total, color: "white" },
                { label: "Pass rate", value: DEMO_KPIS.passRate, color: GREEN, suffix: "%" },
                { label: "Avg trust score", value: DEMO_KPIS.avgScore, color: "#93C5FD" },
                { label: "Fraud caught", value: DEMO_KPIS.reject, color: RED },
              ].map(k => (
                <div key={k.label} style={{ padding: "14px 16px", borderRadius: 13, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, fontFamily: MONO, color: k.color }}><CountUp to={k.value} suffix={k.suffix || ""} /></div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .8, color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
              <MapContainer center={[6.52, 3.43]} zoom={11} style={{ height: "min(42vh, 360px)", width: "100%" }} scrollWheelZoom={false} zoomControl={false} attributionControl={false} dragging={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                {DEMO_SUBMISSIONS.map(s => (
                  <CircleMarker key={s.submission_id} center={[s.gps.lat, s.gps.lon]} radius={s.verdict === "PASS" ? 5 : 8}
                    pathOptions={{ color: s.verdict === "PASS" ? GREEN : s.verdict === "FLAG" ? AMBER : RED, fillOpacity: .8, weight: s.verdict === "PASS" ? 1 : 2 }} />
                ))}
              </MapContainer>
            </div>
            <Caption text="Managers watch quality live — not in a spreadsheet next week. Every dot is a verified visit; the red one never reached the client." cta="From data to insight →" onNext={() => setPhase("ch6")} />
          </motion.div>
        )}

        {/* ── Chapter 6: analysis ── */}
        {phase === "ch6" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: "min(94vw, 700px)", marginTop: "4vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🧠</span>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,.4)", textTransform: "uppercase" }}>Analyse · themes from {DEMO_KPIS.pass} verified visits</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {DEMO_THEMES.map((t, i) => (
                <motion.div key={t.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 + i * .45 }}
                  style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: "white" }}>{t.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 12, background: "rgba(96,165,250,.15)", color: "#93C5FD" }}>{t.evidence} visits</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", fontStyle: "italic", lineHeight: 1.6, borderLeft: `3px solid ${BLUE}66`, paddingLeft: 12 }}>
                    "{t.quote}"
                  </div>
                </motion.div>
              ))}
            </div>
            <Caption text="Verified data flows straight into AI analysis — no export, no analyst backlog. Fraud never contaminates the findings." cta="Generate the client report →" onNext={() => setPhase("ch7")} />
          </motion.div>
        )}

        {/* ── Chapter 7: the report ── */}
        {phase === "ch7" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: "5vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <motion.div initial={{ y: 28, opacity: 0, rotateX: 14 }} animate={{ y: 0, opacity: 1, rotateX: 0 }} transition={{ duration: .9, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: "min(84vw, 340px)", aspectRatio: "0.72", borderRadius: 10, background: "linear-gradient(160deg, #FFFFFF, #F0F4FB)", boxShadow: "0 30px 80px rgba(0,0,0,.6)", padding: "30px 26px", display: "flex", flexDirection: "column" }}>
              <Wordmark />
              <div style={{ marginTop: "auto" }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: BLUE, marginBottom: 10 }}>FIELD RESEARCH REPORT</div>
                <div style={{ fontSize: 19, fontWeight: 900, color: "#080D1A", lineHeight: 1.3, letterSpacing: -.3, marginBottom: 14 }}>
                  Lagos Consumer Pulse<br />Retail Audit
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.7 }}>
                  Prepared 13 July 2026<br />
                  {DEMO_KPIS.pass} verified store visits · trust-weighted findings<br />
                  Quality assured by FieldScore
                </div>
              </div>
            </motion.div>
            <Caption text="One day: collected, verified, analysed, reported. Your client never sees fraudulent data — and you never spend a weekend cleaning it." cta="Finish the day →" onNext={() => setPhase("closing")} />
          </motion.div>
        )}
      </div>
    </DemoChrome>
  );
}
