import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAda } from "../../ada/AdaContext";
import { adaApi } from "../../services/api";
import { X, Send } from "lucide-react";

export default function AdaDock() {
  const { store, setState, addMessage, setOpen } = useAda();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    setState("thinking");
    addMessage({ id: Date.now().toString(), role: "user", content: msg, timestamp: new Date().toISOString() });
    try {
      const res = await adaApi.chat(msg, store.currentPage, {});
      addMessage({ id: (Date.now()+1).toString(), role: "assistant", content: res.data.reply, timestamp: new Date().toISOString() });
      setState("speaking");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <>
      {/* Ada character dock — bottom right */}
      <motion.div
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(!store.isOpen)}
      >
        <motion.div
          animate={{ y: store.state === "thinking" ? [0,-5,0] : [0,-2,0] }}
          transition={{ duration: store.state === "thinking" ? 0.5 : 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: `3px solid ${store.state === "warning" ? "#DC2626" : "#2463EB"}`, boxShadow: `0 4px 20px ${store.state === "warning" ? "rgba(220,38,38,.4)" : "rgba(37,99,235,.35)"}` }}
        >
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 15%" }} />
        </motion.div>
        <div style={{ fontSize:10, fontWeight:700, color:"#2463EB", background:"white", padding:"2px 8px", borderRadius:10, boxShadow:"0 1px 4px rgba(0,0,0,.1)", border:"1px solid #E2E8F0" }}>
          {store.state === "thinking" ? "Thinking..." : "Ada · AI"}
        </div>
      </motion.div>

      {/* Chat panel */}
      <AnimatePresence>
        {store.isOpen && (
          <motion.div
            initial={{ opacity:0, y:20, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:20, scale:0.95 }}
            transition={{ duration:0.2 }}
            style={{ position:"fixed", bottom:110, right:24, zIndex:999, width:360, height:480, background:"white", borderRadius:16, boxShadow:"0 8px 40px rgba(8,13,26,.18)", border:"1px solid #E2E8F0", display:"flex", flexDirection:"column", overflow:"hidden" }}
          >
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:10, background:"linear-gradient(135deg,#EFF6FF,#F8FAFF)" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", border:"2px solid #2463EB", flexShrink:0 }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 15%" }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#080D1A" }}>Ada</div>
                <div style={{ fontSize:10.5, color:"#059669" }}>● AI Research Analyst</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF" }}><X size={16} /></button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
              {store.messages.length === 0 && (
                <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", overflow:"hidden", flexShrink:0 }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 15%" }} />
                  </div>
                  <div style={{ background:"#F8FAFF", border:"1px solid #E2E8F0", borderRadius:"4px 12px 12px 12px", padding:"10px 12px", fontSize:12.5, color:"#374151", lineHeight:1.6, maxWidth:260 }}>
                    Hello! I have already reviewed your project data. What would you like to explore?
                  </div>
                </div>
              )}
              {store.messages.map(msg => (
                <div key={msg.id} style={{ display:"flex", gap:8, alignItems:"flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width:24, height:24, borderRadius:"50%", overflow:"hidden", flexShrink:0 }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 15%" }} />
                    </div>
                  )}
                  <div style={{ background: msg.role === "user" ? "#2463EB" : "#F8FAFF", border: msg.role === "user" ? "none" : "1px solid #E2E8F0", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding:"10px 12px", fontSize:12.5, color: msg.role === "user" ? "white" : "#374151", lineHeight:1.6, maxWidth:260 }}
                    dangerouslySetInnerHTML={{ __html: msg.content.replace(/[*][*](.*?)[*][*]/g,"<strong>$1</strong>").replace(/\n/g,"<br>") }} />
                </div>
              ))}
              {sending && (
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", overflow:"hidden", flexShrink:0 }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 15%" }} />
                  </div>
                  <div style={{ background:"#F8FAFF", border:"1px solid #E2E8F0", borderRadius:"4px 12px 12px 12px", padding:"12px 16px", display:"flex", gap:4 }}>
                    {[0,1,2].map(i => (
                      <motion.div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#2463EB" }}
                        animate={{ y:[0,-6,0] }} transition={{ duration:0.6, repeat:Infinity, delay:i*0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding:"10px 14px", borderTop:"1px solid #F1F5F9", display:"flex", gap:8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Ask Ada anything..."
                style={{ flex:1, border:"1.5px solid #E2E8F0", borderRadius:8, padding:"8px 12px", fontSize:12.5, fontFamily:"Inter,sans-serif", outline:"none" }} />
              <button onClick={send} disabled={sending || !input.trim()}
                style={{ width:36, height:36, borderRadius:8, background:"#2463EB", border:"none", cursor:"pointer", display:"grid", placeItems:"center", opacity: sending || !input.trim() ? 0.5 : 1 }}>
                <Send size={14} color="white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}