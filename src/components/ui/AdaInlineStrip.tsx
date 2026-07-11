import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { useAda } from "../../ada/AdaContext";

interface Chip {
  label: string;
  message: string;
}

interface AdaInlineStripProps {
  message: string;
  chips?: Chip[];
  page: string;
  dismissKey?: string; // localStorage key so user can dismiss permanently
}

export default function AdaInlineStrip({ message, chips = [], page, dismissKey }: AdaInlineStripProps) {
  const storageKey = dismissKey ? `ada_strip_dismissed_${dismissKey}` : null;
  const [dismissed, setDismissed] = useState(() =>
    storageKey ? localStorage.getItem(storageKey) === "1" : false
  );
  const { addMessage, setState } = useAda();

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (storageKey) localStorage.setItem(storageKey, "1");
  };

  const handleChip = (chip: Chip) => {
    setState("thinking");
    setTimeout(() => {
      setState("speaking");
      addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: chip.message,
        timestamp: new Date().toISOString(),
        page,
      });
      setTimeout(() => setState("idle"), 5000);
    }, 500);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "linear-gradient(135deg,#1A1F3E 0%,#0F172A 100%)",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.18)", flexShrink: 0 }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Sparkles size={11} color="#93C5FD" />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#93C5FD", textTransform: "uppercase", letterSpacing: 0.7 }}>Ada · AI</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", lineHeight: 1.6, marginBottom: chips.length > 0 ? 12 : 0 }}>
              {message}
            </div>
            {chips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleChip(chip)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      border: "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.07)",
                      color: "rgba(255,255,255,.75)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "Inter,sans-serif",
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.14)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)"; }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.3)", padding: 2, lineHeight: 0, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
