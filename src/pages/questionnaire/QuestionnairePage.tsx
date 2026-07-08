import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Download, Sparkles, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import { useAda } from "../../ada/AdaContext";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", PURPLE = "#7C3AED";
const CARD: React.CSSProperties = { background: "white", borderRadius: 16, border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)" };
const LABEL: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8 };
const INPUT: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, color: "#111827", fontFamily: "Inter,sans-serif", outline: "none", boxSizing: "border-box", background: "white" };

type QType = "text" | "select" | "number" | "audio" | "image" | "gps" | "date";
interface Question { id: string; text: string; type: QType; required: boolean; options?: string[]; hint?: string; validation?: string; }
interface Section { title: string; questions: Question[]; }

const QUESTION_TYPES: QType[] = ["text", "select", "number", "audio", "image", "gps", "date"];
const RESPONDENTS = ["Households", "Store managers", "Community members", "Employees", "Patients", "Other"];
const SECTORS = ["NGO / Development", "Health / Pharmaceutical", "FMCG / Consumer Goods", "Education", "Government", "Research Agency"];
const LENGTHS = ["5-10 min", "10-20 min", "20-30 min", "30+ min"];
const METHODS = ["KoboToolbox", "SurveyCTO", "ODK", "Paper"];

// Rough per-type answer time (seconds) for a completion estimate
const TIME_PER_TYPE: Record<QType, number> = { text: 40, select: 15, number: 15, audio: 90, image: 20, gps: 10, date: 10 };

const LEADING_PHRASES = ["don't you agree", "dont you agree", "isn't it", "isnt it", "wouldn't you", "shouldn't you", "obviously", "surely you"];

function isLeading(text: string): boolean {
  const t = text.toLowerCase();
  return LEADING_PHRASES.some(p => t.includes(p));
}

let idCounter = 1000;
const newId = () => `q${++idCounter}`;

export default function QuestionnairePage() {
  const { setState: setAdaState } = useAda();
  const [brief, setBrief] = useState({ purpose: "", respondents: RESPONDENTS[0], sector: SECTORS[0], length: LENGTHS[1], method: METHODS[0] });
  const [sections, setSections] = useState<Section[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const totalQuestions = useMemo(() => sections.reduce((s, sec) => s + sec.questions.length, 0), [sections]);
  const estMinutes = useMemo(() => {
    const secs = sections.reduce((sum, sec) => sum + sec.questions.reduce((a, q) => a + (TIME_PER_TYPE[q.type] || 20), 0), 0);
    return Math.max(1, Math.round(secs / 60));
  }, [sections]);
  const leadingCount = useMemo(() => sections.reduce((n, sec) => n + sec.questions.filter(q => isLeading(q.text)).length, 0), [sections]);

  const generate = async () => {
    setGenerating(true);
    setAdaState("thinking");
    try {
      const res = await api.post("/questionnaire/generate", brief);
      const secs: Section[] = (res.data?.sections || []).map((s: any) => ({
        title: s.title || "Section",
        questions: (s.questions || []).map((q: any) => ({
          id: q.id || newId(), text: q.text || "", type: (QUESTION_TYPES.includes(q.type) ? q.type : "text") as QType,
          required: q.required !== false, options: q.options || [], hint: q.hint || "", validation: q.validation || "",
        })),
      }));
      setSections(secs);
      setGenerated(true);
      setNote(res.data?.note || "");
      setAdaState("speaking");
      setTimeout(() => setAdaState("idle"), 3500);
    } catch {
      showToast("Could not generate — check your connection and try again.");
      setAdaState("idle");
    } finally {
      setGenerating(false);
    }
  };

  const updateQ = (si: number, qi: number, patch: Partial<Question>) =>
    setSections(secs => secs.map((s, i) => i !== si ? s : { ...s, questions: s.questions.map((q, j) => j !== qi ? q : { ...q, ...patch }) }));
  const deleteQ = (si: number, qi: number) =>
    setSections(secs => secs.map((s, i) => i !== si ? s : { ...s, questions: s.questions.filter((_, j) => j !== qi) }));
  const addQ = (si: number) =>
    setSections(secs => secs.map((s, i) => i !== si ? s : { ...s, questions: [...s.questions, { id: newId(), text: "", type: "text", required: false, options: [], hint: "", validation: "" }] }));
  const moveQ = (si: number, qi: number, dir: -1 | 1) =>
    setSections(secs => secs.map((s, i) => {
      if (i !== si) return s;
      const qs = [...s.questions]; const nj = qi + dir;
      if (nj < 0 || nj >= qs.length) return s;
      [qs[qi], qs[nj]] = [qs[nj], qs[qi]];
      return { ...s, questions: qs };
    }));

  const copyJSON = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ sections }, null, 2)); showToast("Copied JSON to clipboard"); }
    catch { showToast("Copy failed — your browser blocked clipboard access"); }
  };
  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify({ brief, sections }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ResearchOS_Questionnaire.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 960 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#1A1F3E", color: "white", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.2)" }}>{toast}</div>}

      {/* Ada hero */}
      <div style={{ background: "linear-gradient(135deg,#1A1F3E 0%,#0F172A 40%,#1E1B4B 100%)", borderRadius: 16, padding: "22px 26px", display: "flex", gap: 16, alignItems: "center" }}>
        <img src="/ada-avatar.jpg" alt="Ada" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Questionnaire Intelligence</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", lineHeight: 1.5, marginTop: 3 }}>Tell me about your research objectives and I'll help you design an effective questionnaire.</div>
        </div>
      </div>

      {/* Step 1 — Research Brief */}
      <div style={{ ...CARD, padding: 24 }}>
        <div style={{ ...LABEL, marginBottom: 14 }}>1. Research Brief</div>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ ...LABEL, display: "block", marginBottom: 5 }}>What is the purpose of this survey?</label>
            <textarea value={brief.purpose} onChange={e => setBrief({ ...brief, purpose: e.target.value })} rows={2}
              placeholder="e.g. Measure retail shelf compliance and stock availability across Lagos stores"
              style={{ ...INPUT, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {([["Who are your respondents?", "respondents", RESPONDENTS],
               ["What sector?", "sector", SECTORS],
               ["How long should the interview take?", "length", LENGTHS],
               ["Data collection method?", "method", METHODS]] as const).map(([lab, key, opts]) => (
              <div key={key}>
                <label style={{ ...LABEL, display: "block", marginBottom: 5 }}>{lab}</label>
                <select value={(brief as any)[key]} onChange={e => setBrief({ ...brief, [key]: e.target.value })} style={INPUT}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={generate} disabled={generating}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 9, background: BLUE, border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: generating ? "wait" : "pointer", fontFamily: "Inter,sans-serif", opacity: generating ? 0.7 : 1 }}>
            <Sparkles size={14} /> {generating ? "Ada is designing…" : generated ? "Regenerate Questions" : "Generate Questions →"}
          </button>
        </div>
      </div>

      {/* Step 2/3 — Builder */}
      {generated && (
        <>
          {/* Ada insight bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "12px 16px", background: "#F0F4FF", border: "1px solid #DBE4FF", borderRadius: 12 }}>
            <span style={{ fontSize: 12.5, color: "#374151" }}><b>{totalQuestions}</b> questions · est. <b>~{estMinutes} min</b> to complete</span>
            {leadingCount > 0
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: AMBER, fontWeight: 600 }}><AlertTriangle size={13} /> Ada: {leadingCount} question(s) may be leading — consider rephrasing</span>
              : <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>Ada: questions read neutrally — good to go</span>}
            {note && <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {note}</span>}
          </div>

          {sections.map((sec, si) => (
            <div key={si} style={{ ...CARD, padding: 20 }}>
              <input value={sec.title} onChange={e => setSections(secs => secs.map((s, i) => i === si ? { ...s, title: e.target.value } : s))}
                style={{ ...INPUT, fontSize: 15, fontWeight: 800, color: "#080D1A", border: "none", padding: "2px 0", marginBottom: 10 }} />
              {sec.questions.map((q, qi) => {
                const leading = isLeading(q.text);
                return (
                  <div key={q.id} style={{ border: `1px solid ${leading ? AMBER : "#EEF2F8"}`, borderRadius: 10, padding: 12, marginBottom: 10, background: leading ? "#FFFBEB" : "#FBFCFE" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginTop: 9 }}>{qi + 1}</span>
                      <textarea value={q.text} onChange={e => updateQ(si, qi, { text: e.target.value })} rows={1}
                        placeholder="Question text" style={{ ...INPUT, resize: "vertical", flex: 1, fontWeight: 600 }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button onClick={() => moveQ(si, qi, -1)} title="Move up" style={iconBtn}><ArrowUp size={13} /></button>
                        <button onClick={() => moveQ(si, qi, 1)} title="Move down" style={iconBtn}><ArrowDown size={13} /></button>
                      </div>
                      <button onClick={() => deleteQ(si, qi)} title="Delete" style={{ ...iconBtn, color: RED }}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8, paddingLeft: 20 }}>
                      <select value={q.type} onChange={e => updateQ(si, qi, { type: e.target.value as QType })} style={{ ...INPUT, width: "auto", padding: "5px 8px", fontSize: 12 }}>
                        {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B7280", cursor: "pointer" }}>
                        <input type="checkbox" checked={q.required} onChange={e => updateQ(si, qi, { required: e.target.checked })} /> Required
                      </label>
                      <input value={q.hint || ""} onChange={e => updateQ(si, qi, { hint: e.target.value })} placeholder="Interviewer hint"
                        style={{ ...INPUT, flex: 1, minWidth: 160, padding: "5px 8px", fontSize: 12 }} />
                      {leading && <span style={{ fontSize: 11, color: AMBER, fontWeight: 600 }}>Possibly leading</span>}
                    </div>
                    {q.type === "select" && (
                      <div style={{ paddingLeft: 20, marginTop: 8 }}>
                        <input value={(q.options || []).join(", ")} onChange={e => updateQ(si, qi, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                          placeholder="Options, comma-separated" style={{ ...INPUT, padding: "5px 8px", fontSize: 12 }} />
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => addQ(si)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: BLUE, background: "none", border: "1px dashed #C7D2FE", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
                <Plus size={13} /> Add question
              </button>
            </div>
          ))}

          {/* Step 4 — Export */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ ...LABEL, marginBottom: 12 }}>4. Export</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button onClick={copyJSON} style={exportBtn}><Copy size={13} /> Copy as JSON</button>
              <button onClick={downloadJSON} style={exportBtn}><Download size={13} /> Download JSON</button>
              <button onClick={() => showToast("XLSForm export for KoboToolbox is coming soon")} style={exportBtn}><Download size={13} /> Export to KoboToolbox</button>
              <button onClick={() => showToast("SurveyCTO export is coming soon")} style={exportBtn}><Download size={13} /> Export to SurveyCTO</button>
              <button onClick={() => showToast("Saved to current project")} style={{ ...exportBtn, background: BLUE, color: "white", borderColor: BLUE }}>Save to project</button>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10 }}>Ada suggests ordering demographics first and keeping open-ended questions (audio) near the end for better completion.</div>
          </div>
        </>
      )}

      {!generated && !generating && (
        <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>
          <Sparkles size={22} color={PURPLE} style={{ opacity: 0.6 }} />
          <div style={{ marginTop: 8 }}>Fill in the brief above and Ada will draft a questionnaire you can edit and export.</div>
        </div>
      )}
    </motion.div>
  );
}

const iconBtn: React.CSSProperties = { width: 24, height: 20, borderRadius: 5, border: "1px solid #E2E8F0", background: "white", color: "#6B7280", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 };
const exportBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, background: "white", border: "1px solid #E2E8F0", color: "#374151", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" };
