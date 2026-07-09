import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useAda, parseAdaCommand, AdaCommand } from "../../ada/AdaContext";
import { adaApi, dashboardApi } from "../../services/api";
import { X, Send, Mic, BarChart2, Map, FileText, Users, Zap, MessageSquare, Volume2, VolumeX } from "lucide-react";
import { Submission } from "../../types";

const BLUE = "#2463EB";
const GREEN = "#059669";

// Page-aware suggested prompts
const PAGE_PROMPTS: Record<string, { icon: React.ElementType; text: string }[]> = {
  overview: [
    { icon: BarChart2, text: "What does today's data tell us?" },
    { icon: Zap,       text: "Which submissions need my attention?" },
    { icon: Users,     text: "How are my enumerators performing?" },
  ],
  submissions: [
    { icon: Zap,       text: "Summarise the flagged submissions" },
    { icon: Users,     text: "Which enumerator has the most flags?" },
    { icon: BarChart2, text: "What's the average quality score?" },
  ],
  enumerators: [
    { icon: Users,     text: "Who is my top performer?" },
    { icon: Zap,       text: "Any enumerators I should be concerned about?" },
    { icon: BarChart2, text: "Compare performance across the team" },
  ],
  map: [
    { icon: Map,       text: "Are there any GPS anomalies?" },
    { icon: Zap,       text: "Which areas have the lowest scores?" },
    { icon: BarChart2, text: "Is coverage even across locations?" },
  ],
  insights: [
    { icon: MessageSquare, text: "What are the key themes in my data?" },
    { icon: BarChart2,     text: "Which questions performed poorly?" },
    { icon: Zap,           text: "What does the signal fidelity tell us?" },
  ],
  reports: [
    { icon: FileText,  text: "Generate an executive summary" },
    { icon: BarChart2, text: "What should I highlight for my client?" },
    { icon: Zap,       text: "Any red flags before I deliver?" },
  ],
};

// Simple markdown-to-JSX: bold, bullet lists, line breaks
function RichText({ content }: { content: string }) {
  const clean = DOMPurify.sanitize(content);
  const lines = clean.split("\n");
  return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
      {lines.map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line.trim());
        const text = isBullet ? line.trim().replace(/^[-•*]\s/, "") : line;
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j} style={{ color: "#111827" }}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        );
        if (isBullet) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ color: BLUE, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
              <span>{rendered}</span>
            </div>
          );
        }
        return line.trim() === "" ? <div key={i} style={{ height: 6 }} /> : <div key={i} style={{ marginBottom: 2 }}>{rendered}</div>;
      })}
    </div>
  );
}

function nearestEdge(x: number, y: number): { edge: string; along: number } {
  const d = { left: x, right: 1 - x, top: y, bottom: 1 - y };
  const edge = (Object.entries(d) as [string, number][]).reduce((a, b) => a[1] < b[1] ? a : b)[0];
  const along = edge === "left" || edge === "right" ? y : x;
  return { edge, along };
}

function dockStyle(x: number, y: number): React.CSSProperties {
  return { position: "fixed", left: `${x * 100}vw`, top: `${y * 100}vh`, transform: "translate(-50%, -50%)", zIndex: 1000 };
}

function edgeTarget(edge: string, along: number): { x: string; y: string } {
  switch (edge) {
    case "left":   return { x: "-120px",              y: `${along * 100}vh` };
    case "right":  return { x: "calc(100vw + 120px)", y: `${along * 100}vh` };
    case "top":    return { x: `${along * 100}vw`,    y: "-120px" };
    case "bottom": return { x: `${along * 100}vw`,    y: "calc(100vh + 120px)" };
    default:       return { x: "calc(100vw + 120px)", y: "90vh" };
  }
}

// Speak text via browser TTS, returning true if supported
function speak(text: string, voiceOn: boolean): void {
  if (!voiceOn) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  // Strip markdown before speaking
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-•*]\s/gm, "")
    .replace(/\n+/g, ". ");
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1.05;
  utt.pitch = 1.05;
  // Prefer a female English voice
  const voices = synth.getVoices();
  const preferred = voices.find(v =>
    /female|woman|girl|samantha|victoria|karen|zira|aria|nova|siri/i.test(v.name) &&
    /en/i.test(v.lang)
  ) || voices.find(v => /en/i.test(v.lang));
  if (preferred) utt.voice = preferred;
  synth.speak(utt);
}

export default function AdaDock() {
  const { store, setState, addMessage, setMessages, setOpen, markMemoryLoaded, navigatePage, dispatchCommand } = useAda();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [subs, setSubs] = useState<Submission[]>([]);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);

  // Grab live submissions so Ada can answer date/count questions accurately
  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 200 })
      .then(r => setSubs(r.data?.submissions || []))
      .catch(() => {});
  }, []);

  // Build a rich data summary Ada can reference
  const dataContext = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySubs = subs.filter(s => (s.scored_at || s.submission_date || "").slice(0, 10) === today);
    const passed = subs.filter(s => s.verdict === "PASS");
    const flagged = subs.filter(s => s.verdict === "FLAG");
    const rejected = subs.filter(s => s.verdict === "REJECT");
    const avgScore = subs.length ? Math.round(subs.reduce((a, s) => a + s.overall_score, 0) / subs.length) : 0;
    const enumeratorMap: Record<string, { total: number; flags: number; avgScore: number }> = {};
    subs.forEach(s => {
      if (!enumeratorMap[s.enumerator_id]) enumeratorMap[s.enumerator_id] = { total: 0, flags: 0, avgScore: 0 };
      enumeratorMap[s.enumerator_id].total++;
      if (s.verdict === "FLAG" || s.verdict === "REJECT") enumeratorMap[s.enumerator_id].flags++;
      enumeratorMap[s.enumerator_id].avgScore += s.overall_score;
    });
    Object.values(enumeratorMap).forEach(e => { e.avgScore = Math.round(e.avgScore / e.total); });
    return {
      today,
      total_submissions: subs.length,
      submissions_today: todaySubs.length,
      pass_count: passed.length,
      flag_count: flagged.length,
      reject_count: rejected.length,
      avg_score: avgScore,
      pass_rate: subs.length ? Math.round((passed.length / subs.length) * 100) : 0,
      enumerators: Object.entries(enumeratorMap)
        .map(([id, e]) => ({ id, ...e }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      recent: subs.slice(0, 5).map(s => ({
        id: s.submission_id,
        enumerator: s.enumerator_id,
        verdict: s.verdict,
        score: s.overall_score,
        date: (s.scored_at || s.submission_date || "").slice(0, 10),
      })),
    };
  }, [subs]);

  // Load conversation memory once
  useEffect(() => {
    if (store.memoryLoaded) return;
    markMemoryLoaded();
    adaApi.getMemory()
      .then(res => {
        const msgs = res.data?.messages;
        if (Array.isArray(msgs) && msgs.length > 0) setMessages(msgs.slice(-12));
      })
      .catch(() => undefined);
  }, [store.memoryLoaded, markMemoryLoaded, setMessages]);

  // Page-transition animation
  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;
    navigatePage(location.pathname.replace("/", "") || "overview");
    setTransitioning(true);
    setVisible(false);
    const t = setTimeout(() => { setVisible(true); setTransitioning(false); }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Auto-scroll
  useEffect(() => {
    if (store.isOpen) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [store.messages, store.isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (store.isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [store.isOpen]);

  const applyCommand = useCallback((cmd: AdaCommand) => {
    dispatchCommand(cmd);
    if (cmd.type === "NAVIGATE_TO") {
      navigatePage(cmd.path.replace("/", ""));
      setTimeout(() => navigate(cmd.path), 350);
    }
  }, [dispatchCommand, navigatePage, navigate]);

  const currentPage = useMemo(() => {
    const p = location.pathname.replace("/", "").split("/")[0];
    return p || "overview";
  }, [location.pathname]);

  const prompts = PAGE_PROMPTS[currentPage] || PAGE_PROMPTS.overview;

  const send = useCallback(async (override?: string) => {
    const msg = (override ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setState("thinking");
    addMessage({ id: Date.now().toString(), role: "user", content: msg, timestamp: new Date().toISOString() });
    const localCmd = parseAdaCommand(msg);
    if (localCmd) applyCommand(localCmd);
    try {
      const res = await adaApi.chat(msg, currentPage, {
        data: dataContext,
        history: store.messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });
      const reply: string = res.data?.reply || res.data?.message || "I'm having trouble connecting right now. Try again in a moment.";
      const aiCmd: AdaCommand | null = res.data?.command || null;
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date().toISOString() });
      setState("speaking");
      // Speak the reply after voices load
      if (window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => { speak(reply, voiceOn); };
      } else {
        speak(reply, voiceOn);
      }
      setTimeout(() => setState("idle"), 3000);
      if (aiCmd && !localCmd) applyCommand(aiCmd);
    } catch {
      const errMsg = "I lost connection to the server. Please check your network and try again.";
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: errMsg, timestamp: new Date().toISOString() });
      speak(errMsg, voiceOn);
      setState("idle");
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [input, sending, setState, addMessage, applyCommand, currentPage, dataContext, store.messages, voiceOn]);

  const startVoice = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setInput("Voice input isn't supported in this browser"); return; }
    if (listening) { recognitionRef.current?.stop?.(); return; }
    const rec = new SR();
    rec.lang = "en-NG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setState("listening"); setOpen(true); };
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      if (transcript) { setInput(transcript); setTimeout(() => send(transcript), 150); }
    };
    rec.onerror = () => { setListening(false); setState("idle"); };
    rec.onend = () => { setListening(false); };
    recognitionRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  };

  const { x, y } = store.position;
  const { edge, along } = nearestEdge(x, y);
  const offscreen = edgeTarget(edge, along);
  const avatarSize = transitioning ? 42 : store.isOpen ? 48 : 64;
  const borderColor = store.state === "warning" ? "#DC2626" : "rgba(255,255,255,.2)";
  const shadowColor = store.state === "warning" ? "rgba(220,38,38,.4)" : "rgba(37,99,235,.4)";

  return (
    <>
      {/* Floating avatar */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="ada-dock"
            style={{ ...dockStyle(x, y), cursor: "pointer" }}
            initial={{ x: offscreen.x, y: offscreen.y, scale: 0.3, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{ x: offscreen.x, y: offscreen.y, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(!store.isOpen)}
          >
            <motion.div animate={{ scale: [1, 1.02, 1], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}>
              <motion.div animate={
                store.state === "thinking"
                  ? { y: [0, -8, 0, -5, 0], scale: [1, 1.08, 0.97, 1.02, 1], transition: { duration: 0.8, repeat: Infinity, type: "spring", stiffness: 300, damping: 10 } }
                  : { y: [0, -14, 3, -6, 0], scale: [1, 1.08, 0.97, 1.02, 1], transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4.5 } }
              }>
                <div style={{ position: "relative", width: avatarSize, height: avatarSize, flexShrink: 0, transition: "width .3s, height .3s" }}>
                  <motion.div
                    animate={{ scale: [0.95, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", repeatDelay: 1.5 }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(96,165,250,0.8)", pointerEvents: "none", zIndex: 0 }}
                  />
                  <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: `3px solid ${borderColor}`, boxShadow: `0 8px 32px ${shadowColor}` }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                </div>
              </motion.div>
            </motion.div>
            {!store.isOpen && (
              <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: "white", padding: "2px 8px", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.1)", border: "1px solid #E2E8F0", textAlign: "center", marginTop: 6, whiteSpace: "nowrap" }}>
                {store.state === "thinking" ? "Thinking…" : "Ada · AI"}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {store.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", bottom: 108, right: 24, zIndex: 999,
              width: 420, height: 560,
              background: "white", borderRadius: 20,
              boxShadow: "0 16px 64px rgba(8,13,26,.22), 0 2px 8px rgba(8,13,26,.08)",
              border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg, #0C1128, #1A1F3E)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.25)", boxShadow: "0 0 16px rgba(37,99,235,.4)" }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: GREEN, border: "2px solid #0C1128" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "white", letterSpacing: -0.2 }}>Ada</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", marginTop: 1 }}>
                  {store.state === "thinking" ? "Thinking…" : store.state === "speaking" ? "Responding…" : store.state === "listening" ? "Listening…" : "AI Research Analyst · Online"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setVoiceOn(v => { if (v) window.speechSynthesis?.cancel(); return !v; }); }}
                  title={voiceOn ? "Mute Ada" : "Unmute Ada"}
                  style={{ width: 28, height: 28, borderRadius: 8, background: voiceOn ? "rgba(37,99,235,.35)" : "rgba(255,255,255,.08)", border: `1px solid ${voiceOn ? "rgba(37,99,235,.5)" : "rgba(255,255,255,.1)"}`, cursor: "pointer", display: "grid", placeItems: "center", color: voiceOn ? "#93C5FD" : "rgba(255,255,255,.5)", transition: "all .15s" }}
                >
                  {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
                <button
                  onClick={() => { window.speechSynthesis?.cancel(); setOpen(false); }}
                  style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", display: "grid", placeItems: "center", color: "rgba(255,255,255,.5)" }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
              {store.messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                  <div style={{ background: "#F8FAFF", border: "1px solid #E8EDF5", borderRadius: "4px 16px 16px 16px", padding: "12px 14px", maxWidth: 300 }}>
                    <RichText content={"Hello! I'm Ada, your AI research analyst. I have access to your live data and can help you **understand patterns, investigate submissions, or prepare insights**.\n\nWhat would you like to explore?"} />
                  </div>
                </motion.div>
              )}

              {store.messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.15) }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}
                >
                  {msg.role === "assistant" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                    </div>
                  )}
                  <div style={{
                    background: msg.role === "user" ? "linear-gradient(135deg, #2463EB, #1D4ED8)" : "#F8FAFF",
                    border: msg.role === "user" ? "none" : "1px solid #E8EDF5",
                    borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    padding: "11px 14px",
                    maxWidth: 300,
                    boxShadow: msg.role === "user" ? "0 2px 8px rgba(37,99,235,.25)" : "none",
                  }}>
                    {msg.role === "user"
                      ? <div style={{ fontSize: 13, color: "white", lineHeight: 1.55 }}>{msg.content}</div>
                      : <RichText content={msg.content} />
                    }
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                  <div style={{ background: "#F8FAFF", border: "1px solid #E8EDF5", borderRadius: "4px 16px 16px 16px", padding: "14px 18px", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE }}
                        animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>

            {/* Suggested prompts — only when no messages or few messages */}
            {store.messages.length < 2 && !sending && (
              <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2 }}>Suggested</div>
                {prompts.map(({ icon: Icon, text }) => (
                  <motion.button
                    key={text}
                    whileHover={{ background: "#EFF6FF", borderColor: `${BLUE}44` }}
                    onClick={() => { setInput(text); send(text); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#F8FAFF", border: "1px solid #E8EDF5", borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "Inter,sans-serif", transition: "all .12s" }}
                  >
                    <Icon size={12} color={BLUE} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{text}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#F8FAFF", border: `1.5px solid ${listening ? BLUE : "#E2E8F0"}`,
                borderRadius: 12, padding: "6px 8px 6px 14px",
                transition: "border-color .15s",
                boxShadow: listening ? `0 0 0 3px ${BLUE}18` : "none",
              }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = BLUE; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${BLUE}18`; }}
                onBlurCapture={e => { if (!listening) { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={listening ? "Listening…" : "Ask Ada anything about your research…"}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, fontFamily: "Inter,sans-serif", color: "#111827", outline: "none" }}
                />
                <button
                  onClick={startVoice}
                  title={listening ? "Stop" : "Speak to Ada"}
                  style={{ width: 32, height: 32, borderRadius: 8, background: listening ? "#FEF2F2" : "transparent", border: listening ? "1px solid #FECACA" : "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <Mic size={14} color={listening ? "#DC2626" : "#9CA3AF"} />
                </button>
                <motion.button
                  whileHover={input.trim() ? { scale: 1.05 } : {}}
                  whileTap={input.trim() ? { scale: 0.95 } : {}}
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? BLUE : "#E2E8F0", border: "none", cursor: input.trim() ? "pointer" : "default", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .15s" }}
                >
                  <Send size={13} color={input.trim() ? "white" : "#9CA3AF"} />
                </motion.button>
              </div>
              <div style={{ fontSize: 10, color: "#CBD5E1", textAlign: "center", marginTop: 7 }}>
                Ada has access to your live data · Conversations are private
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
