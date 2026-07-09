import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useAda, parseAdaCommand, AdaCommand } from "../../ada/AdaContext";
import { useGuidedExperience } from "../../ada/GuidedExperienceContext";
import { adaApi, dashboardApi } from "../../services/api";
import { X, Send, Mic, BarChart2, Map, FileText, Users, Zap, MessageSquare, Volume2, VolumeX } from "lucide-react";
import { Submission } from "../../types";

const BLUE = "#2463EB";
const GREEN = "#059669";

const OAI_KEY = process.env.REACT_APP_OPENAI_KEY || "";
const XI_KEY = process.env.REACT_APP_ELEVENLABS_KEY || "";
const XI_VOICE_ID = process.env.REACT_APP_ELEVENLABS_VOICE_ID || "jBpfuIE2acCO8z3wKNLl"; // Nigerian English female

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-•*]\s/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

// TTS chain: ElevenLabs (Nigerian voice) → OpenAI → Web Speech
async function speak(
  text: string,
  voiceOn: boolean,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnd?: () => void
): Promise<void> {
  if (!voiceOn) { onEnd?.(); return; }
  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  const stopPrev = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };

  const playBlob = (blob: Blob): Promise<boolean> =>
    new Promise(resolve => {
      try {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); resolve(true); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(false); };
        audio.play().catch(() => resolve(false));
      } catch { resolve(false); }
    });

  // 1. ElevenLabs — Nigerian English voice
  if (XI_KEY) {
    try {
      stopPrev();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${XI_VOICE_ID}`, {
        method: "POST",
        headers: { "xi-api-key": XI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.3, use_speaker_boost: true },
        }),
      });
      if (res.ok && await playBlob(await res.blob())) return;
    } catch { /* fall through */ }
  }

  // 2. OpenAI TTS fallback
  if (OAI_KEY) {
    try {
      stopPrev();
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1-hd", input: clean, voice: "shimmer", speed: 1.0 }),
      });
      if (res.ok && await playBlob(await res.blob())) return;
    } catch { /* fall through */ }
  }

  // 3. Web Speech fallback
  const synth = window.speechSynthesis;
  if (!synth) { onEnd?.(); return; }
  synth.cancel();
  const doSpeak = () => {
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.0; utt.pitch = 1.0;
    const voices = synth.getVoices();
    const preferred =
      voices.find(v => /google.*female|google.*uk.*female/i.test(v.name)) ||
      voices.find(v => /google/i.test(v.name) && /en/i.test(v.lang)) ||
      voices.find(v => /samantha|victoria|karen|zira|aria|nova|siri|ava/i.test(v.name) && /en/i.test(v.lang)) ||
      voices.find(v => /en/i.test(v.lang));
    if (preferred) utt.voice = preferred;
    utt.onend = () => onEnd?.();
    utt.onerror = () => onEnd?.();
    synth.speak(utt);
  };
  if (synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => { synth.onvoiceschanged = null; doSpeak(); };
  } else {
    doSpeak();
  }
}

function stopSpeech(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  window.speechSynthesis?.cancel();
}

// Page-aware suggested prompts
const PAGE_PROMPTS: Record<string, { icon: React.ElementType; text: string }[]> = {
  overview: [
    { icon: BarChart2, text: "What's standing out in today's data?" },
    { icon: Zap,       text: "What needs my attention right now?" },
    { icon: Users,     text: "How's my team performing overall?" },
  ],
  submissions: [
    { icon: Zap,       text: "Walk me through the flagged submissions" },
    { icon: Users,     text: "Who's generating the most flags?" },
    { icon: BarChart2, text: "What's the overall quality looking like?" },
  ],
  enumerators: [
    { icon: Users,     text: "Who's my star performer right now?" },
    { icon: Zap,       text: "Anyone I should be worried about?" },
    { icon: BarChart2, text: "How does the team compare overall?" },
  ],
  map: [
    { icon: Map,       text: "Any GPS anomalies I should know about?" },
    { icon: Zap,       text: "Where are the lowest scoring areas?" },
    { icon: BarChart2, text: "Is my coverage balanced across locations?" },
  ],
  insights: [
    { icon: MessageSquare, text: "What are the big themes in my data?" },
    { icon: BarChart2,     text: "Which questions didn't land well?" },
    { icon: Zap,           text: "What's signal fidelity telling us?" },
  ],
  reports: [
    { icon: FileText,  text: "Generate an executive summary for me" },
    { icon: BarChart2, text: "What should I lead with for the client?" },
    { icon: Zap,       text: "Any red flags before I send this?" },
  ],
};

// Simple markdown → JSX renderer
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
        if (isBullet) return (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ color: BLUE, fontWeight: 700, flexShrink: 0 }}>·</span>
            <span>{rendered}</span>
          </div>
        );
        return line.trim() === ""
          ? <div key={i} style={{ height: 6 }} />
          : <div key={i} style={{ marginBottom: 2 }}>{rendered}</div>;
      })}
    </div>
  );
}

function nearestEdge(x: number, y: number) {
  const d = { left: x, right: 1 - x, top: y, bottom: 1 - y };
  const edge = (Object.entries(d) as [string, number][]).reduce((a, b) => a[1] < b[1] ? a : b)[0];
  return { edge, along: edge === "left" || edge === "right" ? y : x };
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

export default function AdaDock() {
  const { store, setState, addMessage, setMessages, setOpen, markMemoryLoaded, navigatePage, dispatchCommand } = useAda();
  const { store: guidedStore } = useGuidedExperience();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false); // continuous voice mode
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [subs, setSubs] = useState<Submission[]>([]);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRef = useRef("");

  // Fetch live submissions for data context
  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 200 })
      .then(r => setSubs(r.data?.submissions || []))
      .catch(() => {});
  }, []);

  // Build rich data summary Ada can reference
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

  // Load conversation memory
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

  // FIX: close panel and stop speech on page navigation
  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;
    navigatePage(location.pathname.replace("/", "") || "overview");
    // Close chat and stop speech when navigating
    setOpen(false);
    stopSpeech(audioRef);
    setHandsFree(false);
    setListening(false);
    recognitionRef.current?.stop?.();
    setTransitioning(true);
    setVisible(false);
    const t = setTimeout(() => { setVisible(true); setTransitioning(false); }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (store.isOpen) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [store.messages, store.isOpen]);

  // Focus input when panel opens
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

  // Start recognition (used by both one-shot and hands-free)
  const startRecognition = useCallback((continuous: boolean) => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    recognitionRef.current?.stop?.();
    const rec = new SR();
    rec.lang = "en-NG";
    rec.continuous = continuous;
    rec.interimResults = continuous; // show live transcript in continuous mode
    rec.maxAlternatives = 1;
    interimRef.current = "";

    rec.onstart = () => { setListening(true); setState("listening"); if (!store.isOpen) setOpen(true); };

    rec.onresult = (e: any) => {
      if (!continuous) {
        // One-shot: just grab the final result
        const t = e.results?.[0]?.[0]?.transcript || "";
        if (t) { interimRef.current = t; setInput(t); }
        return;
      }
      // Continuous: accumulate finals, show interim live
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interimText = e.results[i][0].transcript;
      }
      if (finalText) {
        interimRef.current += finalText;
        setInput(interimRef.current + interimText);
        // Auto-submit after 1.2s silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const msg = interimRef.current.trim();
          interimRef.current = "";
          setInput("");
          if (msg) sendMsg(msg);
        }, 1200);
      } else {
        setInput(interimRef.current + interimText);
      }
    };

    rec.onerror = () => { setListening(false); if (!continuous) setState("idle"); };

    rec.onend = () => {
      if (!continuous) {
        // One-shot: send whatever was captured
        const msg = interimRef.current.trim();
        interimRef.current = "";
        setListening(false);
        if (msg) sendMsg(msg);
      }
      // Continuous: onend fires when recognition stops (e.g. long silence).
      // We restart ONLY if handsFree is still on and Ada isn't speaking.
      // The restart-after-speech logic is handled in sendMsg's onEnd callback.
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen, setState, setOpen]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sendMsg = useCallback(async (msg: string, isHandsFree?: boolean) => {
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setState("thinking");
    setListening(false);
    recognitionRef.current?.stop?.();
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
      if (aiCmd && !localCmd) applyCommand(aiCmd);
      // After Ada finishes speaking, restart mic in hands-free mode
      await speak(reply, voiceOn, audioRef, () => {
        setState("idle");
        if (isHandsFree || handsFree) {
          interimRef.current = "";
          startRecognition(true);
        }
      });
    } catch {
      const errMsg = "I lost connection. Please try again.";
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: errMsg, timestamp: new Date().toISOString() });
      await speak(errMsg, voiceOn, audioRef, () => {
        setState("idle");
        if (isHandsFree || handsFree) startRecognition(true);
      });
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, setState, addMessage, applyCommand, currentPage, dataContext, store.messages, voiceOn, handsFree, startRecognition]);

  const send = useCallback(() => {
    const msg = input.trim();
    if (msg) sendMsg(msg, handsFree);
  }, [input, sendMsg, handsFree]);

  // Toggle hands-free continuous voice mode
  const toggleHandsFree = useCallback(() => {
    if (handsFree) {
      // Turn off
      setHandsFree(false);
      setListening(false);
      recognitionRef.current?.stop?.();
      stopSpeech(audioRef);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } else {
      // Turn on
      setHandsFree(true);
      setOpen(true);
      startRecognition(true);
    }
  }, [handsFree, setOpen, startRecognition]);

  // One-shot voice (tap to speak one message)
  const tapVoice = useCallback(() => {
    if (handsFree) return; // handled by hands-free
    if (listening) { recognitionRef.current?.stop?.(); setListening(false); return; }
    startRecognition(false);
  }, [handsFree, listening, startRecognition]);

  const { x, y } = store.position;
  const { edge, along } = nearestEdge(x, y);
  const offscreen = edgeTarget(edge, along);
  const avatarSize = transitioning ? 42 : store.isOpen ? 48 : 64;
  const borderColor = handsFree ? "#059669" : store.state === "warning" ? "#DC2626" : "rgba(255,255,255,.2)";
  const shadowColor = handsFree ? "rgba(5,150,105,.5)" : store.state === "warning" ? "rgba(220,38,38,.4)" : "rgba(37,99,235,.4)";

  return (
    <>
      {/* Floating avatar — hidden during guided experience */}
      <AnimatePresence>
        {visible && !guidedStore.active && (
          <motion.div
            key="ada-dock"
            style={{ position: "fixed", left: `${x * 100}vw`, top: `${y * 100}vh`, transform: "translate(-50%,-50%)", zIndex: 1000, cursor: "pointer" }}
            initial={{ x: offscreen.x, y: offscreen.y, scale: 0.3, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{ x: offscreen.x, y: offscreen.y, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { stopSpeech(audioRef); setOpen(!store.isOpen); }}
          >
            <motion.div animate={{ scale: [1, 1.02, 1], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}>
              <motion.div animate={
                store.state === "thinking"
                  ? { y: [0, -8, 0, -5, 0], transition: { duration: 0.8, repeat: Infinity } }
                  : { y: [0, -14, 3, -6, 0], transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4.5 } }
              }>
                <div style={{ position: "relative", width: avatarSize, height: avatarSize, transition: "width .3s, height .3s" }}>
                  <motion.div
                    animate={{ scale: [0.95, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", repeatDelay: 1.5 }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(96,165,250,0.8)", pointerEvents: "none" }}
                  />
                  {/* Pulse ring in hands-free mode */}
                  {handsFree && (
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                      style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${GREEN}`, pointerEvents: "none" }}
                    />
                  )}
                  <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: `3px solid ${borderColor}`, boxShadow: `0 8px 32px ${shadowColor}` }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                </div>
              </motion.div>
            </motion.div>
            {!store.isOpen && (
              <div style={{ fontSize: 10, fontWeight: 700, color: handsFree ? GREEN : BLUE, background: "white", padding: "2px 8px", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.1)", border: "1px solid #E2E8F0", textAlign: "center", marginTop: 6, whiteSpace: "nowrap" }}>
                {handsFree ? "● Listening" : store.state === "thinking" ? "Thinking…" : "Ada · AI"}
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
            style={{ position: "fixed", bottom: 108, right: 24, zIndex: 999, width: 420, height: 560, background: "white", borderRadius: 20, boxShadow: "0 16px 64px rgba(8,13,26,.22), 0 2px 8px rgba(8,13,26,.08)", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {/* Header */}
            <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg, #0C1128, #1A1F3E)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: `2px solid ${handsFree ? GREEN : "rgba(255,255,255,.25)"}`, boxShadow: `0 0 16px ${handsFree ? "rgba(5,150,105,.5)" : "rgba(37,99,235,.4)"}`, transition: "all .3s" }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: handsFree ? GREEN : "#059669", border: "2px solid #0C1128" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "white", letterSpacing: -0.2 }}>Ada</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", marginTop: 1 }}>
                  {handsFree && listening ? "● Listening to you…" :
                   handsFree && sending  ? "● Thinking…" :
                   store.state === "thinking"  ? "Thinking…" :
                   store.state === "speaking"  ? "Responding…" :
                   store.state === "listening" ? "Listening…" : "AI Research Analyst · Online"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { const v = !voiceOn; setVoiceOn(v); if (!v) stopSpeech(audioRef); }}
                  title={voiceOn ? "Mute Ada" : "Unmute Ada"}
                  style={{ width: 28, height: 28, borderRadius: 8, background: voiceOn ? "rgba(37,99,235,.35)" : "rgba(255,255,255,.08)", border: `1px solid ${voiceOn ? "rgba(37,99,235,.5)" : "rgba(255,255,255,.1)"}`, cursor: "pointer", display: "grid", placeItems: "center", color: voiceOn ? "#93C5FD" : "rgba(255,255,255,.5)", transition: "all .15s" }}
                >
                  {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
                <button
                  onClick={() => { stopSpeech(audioRef); setOpen(false); }}
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
                    <RichText content={"Hey! I'm Ada — your research intelligence layer. I'm connected to your live data right now, so feel free to ask me **anything about your submissions, your team, or your findings**.\n\nWhat would you like to dig into?"} />
                  </div>
                </motion.div>
              )}

              {store.messages.map((msg, idx) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.03, 0.15) }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                    </div>
                  )}
                  <div style={{ background: msg.role === "user" ? "linear-gradient(135deg, #2463EB, #1D4ED8)" : "#F8FAFF", border: msg.role === "user" ? "none" : "1px solid #E8EDF5", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "11px 14px", maxWidth: 300, boxShadow: msg.role === "user" ? "0 2px 8px rgba(37,99,235,.25)" : "none" }}>
                    {msg.role === "user"
                      ? <div style={{ fontSize: 13, color: "white", lineHeight: 1.55 }}>{msg.content}</div>
                      : <RichText content={msg.content} />}
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
                        transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Hands-free listening indicator */}
              {handsFree && listening && !sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: 20 }}>
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN }} />
                    </motion.div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: GREEN }}>{input ? `"${input}"` : "Listening…"}</span>
                  </div>
                </motion.div>
              )}

              <div ref={endRef} />
            </div>

            {/* Suggested prompts */}
            {store.messages.length < 2 && !sending && (
              <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2 }}>Suggested</div>
                {prompts.map(({ icon: Icon, text }) => (
                  <motion.button key={text} whileHover={{ background: "#EFF6FF", borderColor: `${BLUE}44` }}
                    onClick={() => sendMsg(text, handsFree)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#F8FAFF", border: "1px solid #E8EDF5", borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "Inter,sans-serif", transition: "all .12s" }}>
                    <Icon size={12} color={BLUE} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{text}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFF", border: `1.5px solid ${listening ? GREEN : "#E2E8F0"}`, borderRadius: 12, padding: "6px 8px 6px 14px", transition: "border-color .15s", boxShadow: listening ? `0 0 0 3px ${GREEN}18` : "none" }}
                onFocusCapture={e => { if (!listening) { (e.currentTarget as HTMLElement).style.borderColor = BLUE; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${BLUE}18`; } }}
                onBlurCapture={e => { if (!listening) { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
              >
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={handsFree ? (listening ? "Listening… speak now" : "Hands-free mode on") : "Ask Ada anything…"}
                  readOnly={handsFree}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, fontFamily: "Inter,sans-serif", color: "#111827", outline: "none" }}
                />
                {/* Hands-free toggle */}
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={toggleHandsFree}
                  title={handsFree ? "Exit hands-free mode" : "Hands-free: speak continuously"}
                  style={{ width: 32, height: 32, borderRadius: 8, background: handsFree ? GREEN : "transparent", border: handsFree ? "none" : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s", gap: 0 }}
                >
                  {handsFree
                    ? <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}><Mic size={14} color="white" /></motion.div>
                    : <Mic size={14} color="#9CA3AF" />
                  }
                </motion.button>
                {/* One-shot voice (not in hands-free) */}
                {!handsFree && (
                  <button onClick={tapVoice} title={listening ? "Stop" : "Tap to speak"}
                    style={{ width: 32, height: 32, borderRadius: 8, background: listening ? "#FEF2F2" : "transparent", border: listening ? "1px solid #FECACA" : "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Mic size={14} color={listening ? "#DC2626" : "#CBD5E1"} />
                  </button>
                )}
                <motion.button whileHover={input.trim() && !handsFree ? { scale: 1.05 } : {}} whileTap={input.trim() && !handsFree ? { scale: 0.95 } : {}}
                  onClick={send} disabled={sending || !input.trim() || handsFree}
                  style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() && !handsFree ? BLUE : "#E2E8F0", border: "none", cursor: input.trim() && !handsFree ? "pointer" : "default", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .15s" }}>
                  <Send size={13} color={input.trim() && !handsFree ? "white" : "#9CA3AF"} />
                </motion.button>
              </div>
              <div style={{ fontSize: 10, color: "#CBD5E1", textAlign: "center", marginTop: 7 }}>
                {OAI_KEY ? "Ada · Neural voice (OpenAI)" : "Ada · Voice enabled"} · {handsFree ? "Hands-free mode on" : "Tap mic for voice"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
