import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAda, parseAdaCommand } from "../../ada/AdaContext";
import { useProject } from "../../context/ProjectContext";
import { adaApi } from "../../services/api";
import { X, Send } from "lucide-react";

// Sanitise Ada message content — strip all HTML tags, then apply safe bold only.
// This prevents XSS from backend-injected markup.
function sanitiseMessage(raw: string): string {
  const text = raw.replace(/<[^>]*>/g, "");
  return text;
}

function renderMessageParts(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part === "\n") return <br key={i} />;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

// Ada is fixed at bottom-right — no movement or dragging.
const ADA_DOCK_STYLE: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 1000,
};

export default function AdaDock() {
  const { store, setState, addMessage, setMessages, setOpen, markMemoryLoaded, navigatePage, dispatchCommand } = useAda();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeProject } = useProject();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (store.isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [store.messages, store.isOpen]);

  const detectAndNavigate = useCallback((reply: string) => {
    // Only navigate when Ada explicitly offers to take the user somewhere.
    // Require a strong navigational verb so casual mentions of page names
    // (e.g. "You're on the Reports page") don't trigger unwanted navigation.
    const nav: [RegExp, string][] = [
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(submission|submissions)\b/i, "/submissions"],
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(enumerator|enumerators|field agents?)\b/i, "/enumerators"],
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(map|coverage map)\b/i, "/map"],
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(insight|insights|analysis)\b/i, "/insights"],
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(report|reports)\b/i, "/reports"],
      [/\b(take you to|opening|go to|navigate to|heading to)\s*(the\s+)?(overview|dashboard|home)\b/i, "/overview"],
    ];
    for (const [pattern, path] of nav) {
      if (pattern.test(reply)) {
        setTimeout(() => navigate(path), 800);
        return;
      }
    }
  }, [navigate]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    setState("thinking");
    addMessage({ id: Date.now().toString(), role: "user", content: msg, timestamp: new Date().toISOString() });

    // Parse for direct commands immediately (before API round-trip)
    const cmd = parseAdaCommand(msg);
    if (cmd) dispatchCommand(cmd);

    try {
      // Pull project lifecycle + framework context from sessionStorage if available
      const lifecycleRaw = sessionStorage.getItem('ros_active_lifecycle');
      const frameworkRaw = sessionStorage.getItem('ros_active_framework');
      const adaContext: Record<string, unknown> = {};
      // Always tell Ada which project scope the user is looking at
      adaContext.active_project = activeProject
        ? { id: activeProject.id, name: activeProject.name, status: activeProject.status }
        : null; // null = "All projects" combined view
      if (lifecycleRaw) { try { adaContext.lifecycle = JSON.parse(lifecycleRaw); } catch {} }
      if (frameworkRaw) { try { const fw = JSON.parse(frameworkRaw); adaContext.framework_indicators = fw.indicators; adaContext.framework_filename = fw.filename; } catch {} }
      // Enrich page context: for settings, include the active sub-section so
      // Ada knows whether the user is on Engine Config, Research Defaults, etc.
      const settingsSectionEl = document.querySelector('[data-settings-section]');
      const settingsSection = settingsSectionEl?.getAttribute('data-settings-section');
      const effectivePage = settingsSection ? `settings-${settingsSection}` : store.currentPage;
      const res = await adaApi.chat(msg, effectivePage, adaContext);
      const reply: string = res.data.reply;
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date().toISOString() });
      setState("speaking");
      setTimeout(() => setState("idle"), 3000);
      detectAndNavigate(reply);
    } catch {
      setState("idle");
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const avatarSize = store.isOpen ? 48 : 60;
  const borderColor = store.state === "warning" ? "#DC2626" : "rgba(255,255,255,.2)";
  const shadowColor = store.state === "warning" ? "rgba(220,38,38,.4)" : "rgba(37,99,235,.4)";

  const breatheAnim = {
    scale: [1, 1.02, 1] as number[],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
  };

  const thinkingAnim = store.state === "thinking"
    ? { y: [0, -6, 0] as number[], transition: { duration: 0.7, repeat: Infinity } }
    : {};

  return (
    <>
      {/* Fixed Ada avatar — bottom right, no movement */}
      <div style={ADA_DOCK_STYLE}>
        <motion.div
          style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setOpen(!store.isOpen)}
          animate={breatheAnim}
        >
          <motion.div animate={thinkingAnim}>
            <div style={{ position: "relative", width: avatarSize, height: avatarSize }}>
              <motion.div
                animate={{ scale: [0.95, 1.35], opacity: [0.5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", repeatDelay: 2 }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(96,165,250,0.7)", pointerEvents: "none" }}
              />
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: `3px solid ${borderColor}`, boxShadow: `0 6px 24px ${shadowColor}` }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
              </div>
            </div>
          </motion.div>
          {!store.isOpen && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2463EB", background: "white", padding: "2px 8px", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.1)", border: "1px solid #E2E8F0", textAlign: "center", marginTop: 6, whiteSpace: "nowrap" }}>
              {store.state === "thinking" ? "Thinking..." : "Ada · AI"}
            </div>
          )}
        </motion.div>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {store.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", bottom: 110, right: 24, zIndex: 999, width: 360, height: "min(480px, calc(100vh - 130px))", maxHeight: "calc(100vh - 130px)", background: "white", borderRadius: 16, boxShadow: "0 8px 40px rgba(8,13,26,.18)", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}
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
                  <div style={{ background: msg.role === "user" ? "#2463EB" : "#F8FAFF", border: msg.role === "user" ? "none" : "1px solid #E2E8F0", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "10px 12px", fontSize: 12.5, color: msg.role === "user" ? "white" : "#374151", lineHeight: 1.6, maxWidth: 260 }}>
                    {renderMessageParts(sanitiseMessage(msg.content))}
                  </div>
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
                onKeyDown={e => e.key === "Enter" && !sending && send()}
                placeholder="Ask Ada anything..."
                maxLength={1000}
                style={{ flex: 1, border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontFamily: "Inter,sans-serif", outline: "none" }}
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                style={{ width: 36, height: 36, borderRadius: 8, background: "#2463EB", border: "none", cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "grid", placeItems: "center", opacity: sending || !input.trim() ? 0.5 : 1 }}
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
