import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAda, parseAdaCommand } from "../../ada/AdaContext";
import { useProject } from "../../context/ProjectContext";
import { adaApi, orgSettingsApi, projectsApi, dashboardApi } from "../../services/api";
import { isSpreadsheetFile, loadSpreadsheetFile, autoMap, buildSubmissionsPayload, FIELD_MAP } from "../../services/csvImport";
import { X, Send, Paperclip, Trash2, Upload } from "lucide-react";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

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
  const [processingAttachment, setProcessingAttachment] = useState(false);
  // Confirmation cards (currently just project deletion) resolve locally —
  // once acted on, the card's buttons disable and a follow-up message
  // states the outcome. Keyed by message id, not project id, so two
  // separate proposals for the same project each get their own state.
  const [resolvedConfirms, setResolvedConfirms] = useState<Set<string>>(new Set());
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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

  // A logo is low-risk and single-purpose, so it still saves immediately —
  // there's nothing ambiguous to confirm. Everything else Ada can act on
  // (spreadsheets of submissions) is data-changing, so it stops at a
  // confirmation card instead of importing on drop. Anything she doesn't
  // have a defined action for, she says so honestly rather than guessing.
  const saveLogoFile = (file: File) => {
    const now = () => new Date().toISOString();
    if (file.size > MAX_LOGO_BYTES) {
      addMessage({ id: Date.now().toString(), role: "assistant", content: "That's over 2MB — please send a smaller file. (Settings > Branding has the same 2MB limit.)", timestamp: now() });
      return;
    }
    setProcessingAttachment(true);
    setState("thinking");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        // Reuses the exact same endpoint Settings > Branding uses, so it
        // shows up identically wherever branding is read.
        await orgSettingsApi.updateSettings({ brand_logo: reader.result as string });
        addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: "Got it — saved as your organisation logo. It'll appear on every report generated from now on.", timestamp: now() });
        setState("speaking");
        setTimeout(() => setState("idle"), 3000);
      } catch {
        addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: "I couldn't save that just now — please try again, or upload it directly in Settings > Branding.", timestamp: now() });
        setState("warning");
        setTimeout(() => setState("idle"), 3000);
      } finally {
        setProcessingAttachment(false);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    };
    reader.onerror = () => {
      setProcessingAttachment(false);
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: "I couldn't read that file — please try again.", timestamp: now() });
    };
    reader.readAsDataURL(file);
  };

  const proposeSpreadsheetImport = async (file: File) => {
    const now = () => new Date().toISOString();
    if (file.size > MAX_SPREADSHEET_BYTES) {
      addMessage({ id: Date.now().toString(), role: "assistant", content: "That file's over 10MB — please split it up or trim it down and try again.", timestamp: now() });
      return;
    }
    setProcessingAttachment(true);
    setState("thinking");
    try {
      const { headers, rows } = await loadSpreadsheetFile(file);
      const mapping = autoMap(headers);
      const mappedFieldLabels = FIELD_MAP.filter(f => mapping[f.key]).map(f => f.label);
      const suggestedProjectName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const summary = mappedFieldLabels.length
        ? `I found ${rows.length} row${rows.length === 1 ? '' : 's'} in **${file.name}** and matched: ${mappedFieldLabels.join(', ')}. I'd import this as a new project called "${suggestedProjectName}" — confirm?`
        : `I found ${rows.length} row${rows.length === 1 ? '' : 's'} in **${file.name}** but couldn't confidently match any columns to submission fields. I'd still import it into a new project called "${suggestedProjectName}" using best-guess columns — confirm, or upload it directly in Integrations for manual mapping.`;
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: summary,
        timestamp: now(),
        confirmAction: {
          type: 'upload_submissions',
          fileName: file.name,
          suggestedProjectName: suggestedProjectName || 'Imported data',
          rowCount: rows.length,
          headers,
          rows,
          mapping,
          mappedFieldLabels,
        },
      });
      setState("speaking");
      setTimeout(() => setState("idle"), 3000);
    } catch (err: any) {
      addMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: err?.message || "I couldn't read that file — please check it's a valid CSV or Excel file and try again.", timestamp: now() });
      setState("warning");
      setTimeout(() => setState("idle"), 3000);
    } finally {
      setProcessingAttachment(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    addMessage({ id: Date.now().toString(), role: "user", content: `📎 ${file.name}`, timestamp: new Date().toISOString() });

    if (file.type.startsWith("image/")) {
      saveLogoFile(file);
    } else if (isSpreadsheetFile(file)) {
      proposeSpreadsheetImport(file);
    } else {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I'm not sure what to do with a ${file.name.split('.').pop()?.toUpperCase() || 'this'} file yet — right now I can save an image as your logo, or import submissions from a CSV or Excel file. You may need to handle that one elsewhere in the dashboard.`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // The only action Ada never finalizes herself. AppShell's
  // CONFIRM_DELETE_PROJECT handler already added the card message this
  // responds to — nothing is deleted until this actually runs, and the
  // server independently re-verifies the project is still empty before
  // honoring it, regardless of what Ada believed when she proposed it.
  const handleConfirmDelete = async (messageId: string, projectId: string, projectName: string, confirmed: boolean) => {
    setResolvedConfirms(prev => new Set(prev).add(messageId));
    if (!confirmed) {
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: `Okay, I'll leave "${projectName}" alone.`, timestamp: new Date().toISOString() });
      return;
    }
    setConfirmBusy(messageId);
    try {
      await projectsApi.delete(projectId, true);
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: `Done — "${projectName}" is deleted.`, timestamp: new Date().toISOString() });
    } catch (err: any) {
      const msg = err?.response?.status === 409
        ? `I couldn't delete "${projectName}" — it turns out to have real submissions, so I'm leaving it alone.`
        : `I couldn't delete "${projectName}" — please try again, or use the Clean Up flow on the Projects page.`;
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: msg, timestamp: new Date().toISOString() });
    } finally {
      setConfirmBusy(null);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // Mirrors IntegrationsPage's own import flow (same create-project +
  // upload-submissions calls) so a spreadsheet dropped in chat behaves
  // identically to one uploaded through Integrations — nothing is imported
  // until the user clicks Confirm on the card this responds to.
  const handleConfirmUpload = async (
    messageId: string,
    action: { fileName: string; suggestedProjectName: string; rowCount: number; rows: Record<string, string>[]; mapping: Record<string, string> },
    confirmed: boolean
  ) => {
    setResolvedConfirms(prev => new Set(prev).add(messageId));
    if (!confirmed) {
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: `Okay, I won't import "${action.fileName}".`, timestamp: new Date().toISOString() });
      return;
    }
    setConfirmBusy(messageId);
    try {
      const projRes = await projectsApi.create({ name: action.suggestedProjectName, platform: 'excel_import' });
      const projectId = projRes.data?.id || projRes.data?.project?.id || '';
      const submissions = buildSubmissionsPayload(action.rows, action.mapping, projectId);
      const res = await dashboardApi.uploadSubmissions(submissions);
      const imported = res.data?.imported ?? submissions.length;
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: `Done — imported ${imported} submission${imported === 1 ? '' : 's'} into "${action.suggestedProjectName}".`, timestamp: new Date().toISOString() });
    } catch {
      addMessage({ id: `${messageId}-outcome`, role: "assistant", content: `I couldn't import "${action.fileName}" — please try again, or upload it directly on the Integrations page.`, timestamp: new Date().toISOString() });
    } finally {
      setConfirmBusy(null);
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
              {store.messages.map(msg => {
                const pendingDelete = msg.confirmAction?.type === 'delete_project' && !resolvedConfirms.has(msg.id)
                  ? msg.confirmAction : null;
                const pendingUpload = msg.confirmAction?.type === 'upload_submissions' && !resolvedConfirms.has(msg.id)
                  ? msg.confirmAction : null;
                const busy = confirmBusy === msg.id;
                return (
                  <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                    {msg.role === "assistant" && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                        <img src="/ada-avatar.jpg" alt="Ada" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
                      </div>
                    )}
                    <div style={{ background: msg.role === "user" ? "#2463EB" : "#F8FAFF", border: msg.role === "user" ? "none" : "1px solid #E2E8F0", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", padding: "10px 12px", fontSize: 12.5, color: msg.role === "user" ? "white" : "#374151", lineHeight: 1.6, maxWidth: 260 }}>
                      {renderMessageParts(sanitiseMessage(msg.content))}
                      {pendingDelete && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button
                            onClick={() => handleConfirmDelete(msg.id, pendingDelete.project_id, pendingDelete.project_name, true)}
                            disabled={busy}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 11.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(msg.id, pendingDelete.project_id, pendingDelete.project_name, false)}
                            disabled={busy}
                            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", color: "#6B7280", fontSize: 11.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {pendingUpload && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button
                            onClick={() => handleConfirmUpload(msg.id, pendingUpload, true)}
                            disabled={busy}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", background: "#2463EB", color: "white", fontSize: 11.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
                          >
                            <Upload size={11} /> Import
                          </button>
                          <button
                            onClick={() => handleConfirmUpload(msg.id, pendingUpload, false)}
                            disabled={busy}
                            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", color: "#6B7280", fontSize: 11.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                ref={logoInputRef}
                type="file"
                accept="image/*,.csv,.tsv,.txt,.xlsx,.xls"
                onChange={handleAttachment}
                style={{ display: "none" }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={processingAttachment}
                title="Attach a logo image, or a CSV/Excel file of submissions"
                style={{ width: 36, height: 36, borderRadius: 8, background: "white", border: "1.5px solid #E2E8F0", cursor: processingAttachment ? "not-allowed" : "pointer", display: "grid", placeItems: "center", opacity: processingAttachment ? 0.5 : 1, flexShrink: 0 }}
              >
                <Paperclip size={14} color="#6B7280" />
              </button>
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
                style={{ width: 36, height: 36, borderRadius: 8, background: "#2463EB", border: "none", cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "grid", placeItems: "center", opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0 }}
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
