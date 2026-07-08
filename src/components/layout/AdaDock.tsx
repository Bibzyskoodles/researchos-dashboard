import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAda, parseAdaCommand, AdaCommand } from "../../ada/AdaContext";
import { adaApi } from "../../services/api";
import { X, Send, Mic } from "lucide-react";

function nearestEdge(x: number, y: number): { edge: string; along: number } {
  const d = { left: x, right: 1 - x, top: y, bottom: 1 - y };
  const edge = (Object.entries(d) as [string, number][]).reduce((a, b) => a[1] < b[1] ? a : b)[0];
  const along = edge === "left" || edge === "right" ? y : x;
  return { edge, along };
}

function dockStyle(x: number, y: number): React.CSSProperties {
  return {
    position: "fixed",
    left: `${x * 100}vw`,
    top: `${y * 100}vh`,
    transform: "translate(-50%, -50%)",
    zIndex: 1000,
  };
}

function edgeTarget(edge: string, along: number): { x: string; y: string } {
  switch (edge) {
    case "left":   return { x: "-120px", y: `${along * 100}vh` };
    case "right":  return { x: "calc(100vw + 120px)", y: `${along * 100}vh` };
    case "top":    return { x: `${along * 100}vw`, y: "-120px" };
    case "bottom": return { x: `${along * 100}vw`, y: "calc(100vh + 120px)" };
    default:       return { x: "calc(100vw + 120px)", y: "90vh" };
  }
}

export default function AdaDock() {
  const { store, setState, addMessage, setMessages, setOpen, markMemoryLoaded, navigatePage, dispatchCommand } = useAda();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (store.memoryLoaded) return;
    markMemoryLoaded();
    adaApi.getMemory()
      .then(res => {
        const msgs = res.data?.messages;
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs.slice(-10));
        }
      })
      .catch(() => undefined);
  }, [store.memoryLoaded, markMemoryLoaded, setMessages]);

  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;
    navigatePage(location.pathname.replace("/", "") || "overview");
    setTransitioning(true);
    setVisible(false);
    const timer = setTimeout(() => {
      setVisible(true);
      setTransitioning(false);
    }, 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (store.isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [store.messages, store.isOpen]);

  // Ada can adjust the UI when asked — filter, highlight, navigate (never
  // delete). Applies a command dispatched either by the instant local parser
  // or by the AI (tool call) once her reply returns.
  const applyCommand = useCallback((cmd: AdaCommand) => {
    dispatchCommand(cmd);
    if (cmd.type === "NAVIGATE_TO") {
      navigatePage(cmd.path.replace("/", ""));
      setTimeout(() => navigate(cmd.path), 350);
    }
  }, [dispatchCommand, navigatePage, navigate]);

  const send = async (override?: string) => {
    const msg = (override ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setState("thinking");
    addMessage({ id: Date.now().toString(), role: "user", content: msg, timestamp: new Date().toISOString() });
    // Instant local fast-path for the obvious commands; the AI is authoritative.
    const localCmd = parseAdaCommand(msg);
    if (localCmd) applyCommand(localCmd);
    try {
      const res = await adaApi.chat(msg, store.currentPage, {});
      const reply: string = res.data.reply;
      const aiCmd: AdaCommand | null = res.data.command || null;
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date().toISOString() });
      setState("speaking");
      setTimeout(() => setState("idle"), 3000);
      // Honour the AI's decision when the local parser didn't already catch it.
      if (aiCmd && !localCmd) applyCommand(aiCmd);
    } catch {
      setState("idle");
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // Voice input — browser speech recognition → transcript → send to Ada
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

  const breatheAnim = {
    scale: [1, 1.02, 1] as number[],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
  };

  const bounceAnim = store.state === "thinking"
    ? { y: [0, -8, 0, -5, 0] as number[], scale: [1, 1.08, 0.97, 1.02, 1] as number[], transition: { duration: 0.8, repeat: Infinity, type: "spring" as const, stiffness: 300, damping: 10 } }
    : { y: [0, -14, 3, -6, 0] as number[], scale: [1, 1.08, 0.97, 1.02, 1] as number[], transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" as const, repeatDelay: 4.5 } };

  const borderColor = store.state === "warning" ? "#DC2626" : "rgba(255,255,255,.2)";
  const shadowColor = store.state === "warning" ? "rgba(220,38,38,.4)" : "rgba(37,99,235,.4)";

  return (
    <>
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
            <motion.div animate={breatheAnim}>
              <motion.div animate={bounceAnim}>
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
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2463EB", background: "white", padding: "2px 8px", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.1)", border: "1px solid #E2E8F0", textAlign: "center", marginTop: 6, whiteSpace: "nowrap" }}>
                {store.state === "thinking" ? "Thinking..." : "Ada · AI"}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {store.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", bottom: 110, right: 24, zIndex: 999, width: 360, height: 480, background: "white", borderRadius: 16, boxShadow: "0 8px 40px rgba(8,13,26,.18)", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#EFF6FF,#F8FAFF)" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid #2463EB", flexShrink: 0 }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A" }}>Ada</div>
                <div style={{ fontSize: 10.5, color: "#059669" }}>● AI Research Analyst</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {store.messages.length === 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                  <div style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: "4px 12px 12px 12px", padding: "10px 12px", fontSize: 12.5, color: "#374151", lineHeight: 1.6, maxWidth: 260 }}>
                    Hello! I have already reviewed your project data. What would you like to explore?
                  </div>
                </div>
              )}
              {store.messages.map(msg => (
                <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                    </div>
                  )}
                  <div
                    style={{ background: msg.role === "user" ? "#2463EB" : "#F8FAFF", border: msg.role === "user" ? "none" : "1px solid #E2E8F0", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "10px 12px", fontSize: 12.5, color: msg.role === "user" ? "white" : "#374151", lineHeight: 1.6, maxWidth: 260 }}
                    dangerouslySetInnerHTML={{ __html: msg.content.replace(/[*][*](.*?)[*][*]/g, "<strong>$1</strong>").replace(/\n/g, "<br>") }}
                  />
                </div>
              ))}
              {sending && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                  </div>
                  <div style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: "4px 12px 12px 12px", padding: "12px 16px", display: "flex", gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#2463EB" }}
                        animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder={listening ? "Listening…" : "Ask Ada anything..."}
                style={{ flex: 1, border: `1.5px solid ${listening ? "#2463EB" : "#E2E8F0"}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontFamily: "Inter,sans-serif", outline: "none" }}
              />
              <button
                onClick={startVoice}
                title={listening ? "Stop listening" : "Speak to Ada"}
                style={{ width: 36, height: 36, borderRadius: 8, background: listening ? "#DC2626" : "#F0F4FF", border: "1px solid #E2E8F0", cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                <Mic size={14} color={listening ? "white" : "#2463EB"} />
              </button>
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                style={{ width: 36, height: 36, borderRadius: 8, background: "#2463EB", border: "none", cursor: "pointer", display: "grid", placeItems: "center", opacity: sending || !input.trim() ? 0.5 : 1 }}
              >
                <Send size={14} color="white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
