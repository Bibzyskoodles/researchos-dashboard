import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { insightScoreApi } from "../../../services/api";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const PURPLE = "#7C3AED";

interface DemographicSegment {
  value: string;
  count: number;
  pct: number;
  sentiment_score?: number;
  themes?: string[];
  quotes?: string[];
  mti_avg?: number;
}

interface DemographicBreakdown {
  field: string;
  label: string;
  total: number;
  segments: DemographicSegment[];
}

interface DemographicsData {
  available_fields: Array<{ key: string; label: string }>;
  breakdowns: Record<string, DemographicBreakdown>;
}

const PALETTES = [BLUE, GREEN, PURPLE, AMBER, "#0891B2", "#DC2626", "#7C3AED", "#059669"];

function SentimentDot({ score }: { score?: number }) {
  if (score === undefined) return null;
  const color = score >= 0.6 ? GREEN : score >= 0.4 ? AMBER : RED;
  const label = score >= 0.6 ? "Positive" : score >= 0.4 ? "Mixed" : "Negative";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

function SegmentBar({ segment, maxCount, color }: { segment: DemographicSegment; maxCount: number; color: string }) {
  const [open, setOpen] = useState(false);
  const pct = maxCount > 0 ? (segment.count / maxCount) * 100 : 0;

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #E8EDF5", overflow: "hidden", marginBottom: 6 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#080D1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{segment.value}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <SentimentDot score={segment.sentiment_score} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{segment.count} ({segment.pct}%)</span>
            </div>
          </div>
          <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
              style={{ height: "100%", background: color, borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ color: open ? BLUE : "#CBD5E1", fontSize: 14, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</div>
      </div>
      <AnimatePresence>
        {open && (segment.themes?.length || segment.quotes?.length) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ borderTop: "1px solid #F8FAFF", padding: "12px 14px 14px" }}>
              {segment.mti_avg !== undefined && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", borderRadius: 6, padding: "3px 9px", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700 }}>SFI: {segment.mti_avg}</span>
                </div>
              )}
              {segment.themes && segment.themes.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Themes</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {segment.themes.map((t, i) => (
                      <span key={i} style={{ fontSize: 11, color: "#374151", background: "#F1F5F9", borderRadius: 5, padding: "2px 8px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {segment.quotes && segment.quotes.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Voice of Respondent</div>
                  {segment.quotes.slice(0, 2).map((q, i) => (
                    <div key={i} style={{ background: "#F8FAFF", borderLeft: `3px solid ${color}`, borderRadius: "0 7px 7px 0", padding: "7px 10px", fontSize: 12, color: "#374151", fontStyle: "italic", lineHeight: 1.5, marginBottom: 5 }}>"{q}"</div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldBreakdown({ breakdown }: { breakdown: DemographicBreakdown }) {
  const maxCount = Math.max(...breakdown.segments.map(s => s.count), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#080D1A" }}>{breakdown.label}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{breakdown.total} respondents · {breakdown.segments.length} segments</div>
      </div>
      {breakdown.segments.map((seg, i) => (
        <SegmentBar key={seg.value || i} segment={seg} maxCount={maxCount} color={PALETTES[i % PALETTES.length]} />
      ))}
    </div>
  );
}

function PendingState() {
  const DEMO_FIELDS = ["Gender", "Age Group", "Location", "Education", "Income"];
  return (
    <div>
      <div style={{ background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "#1E40AF" }}>Demographic Intelligence will populate once Ada analyses the interview responses. Demographic fields are read dynamically from your questionnaire metadata — no hardcoded fields.</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {DEMO_FIELDS.map(f => (
          <div key={f} style={{ padding: "6px 14px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #E5E7EB", color: "#CBD5E1", fontSize: 12, fontWeight: 600 }}>{f}</div>
        ))}
      </div>
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", padding: "20px" }}>
        {[80, 55, 40, 25].map((w, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 90, height: 10, background: "#F1F5F9", borderRadius: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, height: 8, background: "#F8FAFF", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${w}%`, height: "100%", background: "#E2E8F0", borderRadius: 4 }} />
            </div>
            <div style={{ width: 40, height: 10, background: "#F1F5F9", borderRadius: 5, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DemographicIntelligencePanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [crossField, setCrossField] = useState<string | null>(null);
  const [loadingField, setLoadingField] = useState(false);

  useEffect(() => {
    setLoading(true); setError(false); setData(null);
    insightScoreApi.getDemographics(projectId)
      .then((r: any) => {
        if (r.data) {
          setData(r.data);
          const fields = r.data.available_fields;
          if (fields?.length > 0) setActiveField(fields[0].key);
        }
      })
      .catch((e: any) => { if (e?.response?.status !== 404) setError(true); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadField = useCallback((key: string) => {
    setCrossField(null);
    if (!data || data.breakdowns[key]) { setActiveField(key); return; }
    setLoadingField(true);
    setActiveField(key);
    insightScoreApi.getDemographics(projectId, key)
      .then((r: any) => {
        if (r.data?.breakdown) {
          setData(prev => prev ? { ...prev, breakdowns: { ...prev.breakdowns, [key]: r.data.breakdown } } : prev);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingField(false));
  }, [data, projectId]);

  const loadCrossField = useCallback((key: string) => {
    if (crossField === key) { setCrossField(null); return; }
    setCrossField(key);
    if (!data) return;
    // Fetch the cross field's own breakdown if not already cached
    if (!data.breakdowns[key]) {
      setLoadingField(true);
      insightScoreApi.getDemographics(projectId, key)
        .then((r: any) => {
          if (r.data?.breakdown) {
            setData(prev => prev ? { ...prev, breakdowns: { ...prev.breakdowns, [key]: r.data.breakdown } } : prev);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingField(false));
    }
  }, [data, projectId, crossField]);

  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading demographics...</div>;
  if (error) return <div style={{ padding: "20px", background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA", fontSize: 13, color: "#7F1D1D" }}>Could not load Demographics — the analysis service may be unavailable. Please try again shortly.</div>;
  if (!data) return <PendingState />;

  const primaryBreakdown = activeField ? data.breakdowns[activeField] : null;
  const crossBreakdown = crossField ? data.breakdowns[crossField] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Primary dimension picker */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E8EDF5", padding: "16px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>Demographic Dimensions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.available_fields.map(f => (
            <button key={f.key} onClick={() => loadField(f.key)}
              style={{ padding: "7px 16px", borderRadius: 9, background: activeField === f.key ? BLUE : "white", border: `1px solid ${activeField === f.key ? BLUE : "#E5E7EB"}`, color: activeField === f.key ? "white" : "#374151", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compare With picker */}
      {activeField && data.available_fields.length > 1 && (
        <div style={{ background: "linear-gradient(135deg, #F0F4FF, #F8FAFF)", borderRadius: 12, border: "1px solid #E0E7FF", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Compare With</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>Select a second dimension to view side-by-side.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.available_fields.filter(f => f.key !== activeField).map(f => {
              const active = crossField === f.key;
              return (
                <button key={f.key} onClick={() => loadCrossField(f.key)}
                  style={{ padding: "5px 12px", borderRadius: 7, background: active ? PURPLE : "white", border: `1px solid ${active ? PURPLE : "#E0E7FF"}`, color: active ? "white" : "#4B5563", fontSize: 11.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>
                  {active ? "✕ " : "+ "}{f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdown display */}
      <AnimatePresence mode="wait">
        {loadingField ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: "center", padding: "30px 0", color: "#9CA3AF", fontSize: 13 }}>
            Loading breakdown...
          </motion.div>
        ) : primaryBreakdown ? (
          <motion.div key={`${activeField}-${crossField}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {crossBreakdown ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "white", borderRadius: 12, border: `2px solid ${BLUE}33`, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
                    {data.available_fields.find(f => f.key === activeField)?.label}
                  </div>
                  <FieldBreakdown breakdown={primaryBreakdown} />
                </div>
                <div style={{ background: "white", borderRadius: 12, border: `2px solid ${PURPLE}33`, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
                    {data.available_fields.find(f => f.key === crossField)?.label}
                  </div>
                  <FieldBreakdown breakdown={crossBreakdown} />
                </div>
              </div>
            ) : (
              <FieldBreakdown breakdown={primaryBreakdown} />
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "30px 0", color: "#9CA3AF", fontSize: 13 }}>
            Select a demographic dimension to explore.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
