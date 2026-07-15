import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardApi, adaApi } from '../../services/api';
import { useAdaGreeting } from '../../hooks/useAdaGreeting';
import { Submission } from '../../types';
import { loadEngineConfig } from '../../services/engineConfig';
import { computeTrustIndex } from '../../services/trustEngine';
import {
  Target, Sparkles, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle2, XCircle, Lightbulb, BarChart2, FileText,
  Upload, Loader, Download, RefreshCw,
} from 'lucide-react';

const BLUE = '#2463EB', GREEN = '#059669', AMBER = '#D97706', RED = '#DC2626', PURPLE = '#7C3AED';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OutcomeGap {
  dimension: string;
  severity: 'critical' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
}

interface ObjectiveScore {
  objective: string;
  score: number;          // 0-100
  confidence: 'high' | 'medium' | 'low';
  evidenceFound: string[];
  evidenceMissing: string[];
}

interface OutcomeReport {
  inferredObjective: string;
  studyDesign: string;
  researchQualityScore: number;        // 0-100
  objectiveScores: ObjectiveScore[];
  methodologicalGaps: OutcomeGap[];
  dataCompleteness: number;            // 0-100
  representationRisk: string;
  statisticalAdequacy: string;
  keyFindings: string[];
  verdict: 'strong' | 'adequate' | 'weak' | 'insufficient';
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 88, label }: { score: number; size?: number; label: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? GREEN : score >= 45 ? AMBER : RED;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EDF5" strokeWidth={8} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: size * 0.22, fontWeight: 800, fill: color, fontFamily: 'monospace', transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
          {score}
        </text>
      </svg>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7 }}>{label}</div>
    </div>
  );
}

// ─── Gap pill ─────────────────────────────────────────────────────────────────
function GapPill({ gap }: { gap: OutcomeGap }) {
  const [open, setOpen] = useState(false);
  const color = gap.severity === 'critical' ? RED : gap.severity === 'moderate' ? AMBER : BLUE;
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${color}25`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: color + '08', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#374151' }}>{gap.dimension}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: color + '18', color }}>{gap.severity}</span>
        {open ? <ChevronDown size={12} color="#9CA3AF" /> : <ChevronRight size={12} color="#9CA3AF" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 14px 30px', background: 'white' }}>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>{gap.description}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Lightbulb size={12} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11.5, color: AMBER, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.5 }}>{gap.recommendation}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Objective card ───────────────────────────────────────────────────────────
function ObjectiveCard({ obj }: { obj: ObjectiveScore }) {
  const color = obj.score >= 70 ? GREEN : obj.score >= 45 ? AMBER : RED;
  const confColor = obj.confidence === 'high' ? GREEN : obj.confidence === 'medium' ? AMBER : RED;
  return (
    <div style={{ borderRadius: 12, border: '1px solid #E8EDF5', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#FAFBFF', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>{obj.objective}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: confColor + '15', color: confColor }}>{obj.confidence} conf.</span>
        <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'monospace', minWidth: 34, textAlign: 'right' }}>{obj.score}</div>
      </div>
      <div style={{ height: 4, background: '#E8EDF5' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${obj.score}%` }} transition={{ duration: .8, ease: 'easeOut' }}
          style={{ height: '100%', background: color }} />
      </div>
      <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Evidence found</div>
          {obj.evidenceFound.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 3 }}>
              <CheckCircle2 size={10} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{e}</span>
            </div>
          ))}
          {obj.evidenceFound.length === 0 && <div style={{ fontSize: 11, color: '#CBD5E1' }}>None found</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Evidence missing</div>
          {obj.evidenceMissing.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 3 }}>
              <XCircle size={10} color={RED} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{e}</span>
            </div>
          ))}
          {obj.evidenceMissing.length === 0 && <div style={{ fontSize: 11, color: '#CBD5E1' }}>None — complete</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Build the analysis prompt ────────────────────────────────────────────────
function buildPrompt(submissions: Submission[], brief: string, questionSample: string): string {
  const n = submissions.length;
  const verdicts = { PASS: 0, FLAG: 0, REJECT: 0 } as Record<string, number>;
  for (const s of submissions) verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1;
  // Trust Index, not raw backend score — this average gets narrated by Ada
  // and must match the number shown on every other page for the same data.
  const outcomeEngineCfg = loadEngineConfig();
  const avgScore = submissions.reduce((a, s) => a + computeTrustIndex(s as any, outcomeEngineCfg).trustIndex, 0) / n;
  const enums = new Set(submissions.map(s => s.enumerator_id)).size;
  const hasDates = submissions.some(s => s.scored_at);
  const dateRange = hasDates ? (() => {
    const sorted = submissions.filter(s => s.scored_at).map(s => new Date(s.scored_at).getTime()).sort((a, b) => a - b);
    const diff = (sorted[sorted.length - 1] - sorted[0]) / 86400000;
    return `${Math.round(diff)} days`;
  })() : 'unknown';

  return `You are a research quality analyst. Analyse this survey dataset and return a JSON OutcomeReport.

DATASET SUMMARY:
- ${n} submissions, ${enums} enumerators, collected over ${dateRange}
- Verdicts: ${verdicts.PASS || 0} PASS / ${verdicts.FLAG || 0} FLAG / ${verdicts.REJECT || 0} REJECT
- Average FieldScore: ${avgScore.toFixed(1)}/100
- Quality pass rate: ${((verdicts.PASS || 0) / n * 100).toFixed(1)}%

${brief ? `STUDY BRIEF PROVIDED BY RESEARCHER:\n${brief}\n` : 'NO STUDY BRIEF PROVIDED — infer the research objective from question content and data patterns.\n'}

${questionSample ? `QUESTION SAMPLE:\n${questionSample}\n` : ''}

Return ONLY valid JSON matching this TypeScript interface (no markdown, no explanation):

interface OutcomeReport {
  inferredObjective: string;          // 1-2 sentences: what this study was trying to measure
  studyDesign: string;                // e.g. "Cross-sectional household survey"
  researchQualityScore: number;       // 0-100 composite score
  objectiveScores: Array<{
    objective: string;                // sub-objective or dimension being measured
    score: number;                    // 0-100 how well data answers this
    confidence: "high" | "medium" | "low";
    evidenceFound: string[];          // max 3 items
    evidenceMissing: string[];        // max 3 items
  }>;
  methodologicalGaps: Array<{
    dimension: string;
    severity: "critical" | "moderate" | "minor";
    description: string;
    recommendation: string;
  }>;
  dataCompleteness: number;           // 0-100
  representationRisk: string;         // 1 sentence
  statisticalAdequacy: string;        // 1 sentence with specific numbers
  keyFindings: string[];              // 3-5 bullet points
  verdict: "strong" | "adequate" | "weak" | "insufficient";
}

Be specific and rigorous. Base scores on actual numbers from the dataset. If the study brief is missing, infer the objective from data patterns but note the uncertainty.`;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OutcomeIntelligencePage() {
  useAdaGreeting({ page: "outcome" });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [brief, setBrief] = useState('');
  const [questionSample, setQuestionSample] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [report, setReport] = useState<OutcomeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'objectives' | 'gaps' | 'findings'>('objectives');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFromProject = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const r = await dashboardApi.getSubmissions({ limit: 500 });
      const subs = Array.isArray(r.data.submissions || r.data) ? (r.data.submissions || r.data) : [];
      setSubmissions(subs);
      setDataLoaded(true);
    } catch {
      setError('Could not load submissions. Check your connection.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        let parsed: Submission[] = [];
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          parsed = Array.isArray(json) ? json : json.submissions || [];
        } else {
          // CSV: parse header row to build objects
          const lines = text.split('\n').filter(Boolean);
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          parsed = lines.slice(1).map(line => {
            const vals = line.split(',');
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/"/g, '').trim(); });
            return {
              submission_id: obj.submission_id || obj.id || String(Math.random()),
              enumerator_id: obj.enumerator_id || obj.enumerator || 'unknown',
              verdict: (obj.verdict as 'PASS' | 'FLAG' | 'REJECT') || 'PASS',
              overall_score: Number(obj.overall_score || obj.score || 50),
              duration_mins: obj.duration_mins ? Number(obj.duration_mins) : undefined,
              scored_at: obj.scored_at || obj.date || '',
            } as unknown as Submission;
          });
        }
        setSubmissions(parsed);
        setDataLoaded(true);
      } catch {
        setError('Could not parse file. Ensure it is a valid JSON or CSV export from ResearchOS.');
      }
    };
    reader.readAsText(file);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!submissions.length) return;
    setAnalysing(true);
    setError(null);
    setReport(null);
    try {
      const prompt = buildPrompt(submissions, brief, questionSample);
      const res = await adaApi.analyse(
        prompt,
        'You are a research quality analyst. Return only valid JSON matching the OutcomeReport schema. No markdown, no explanation.',
      );
      const parsed: OutcomeReport = res.data?.result;
      if (!parsed || typeof parsed !== 'object') throw new Error('Empty result');
      setReport(parsed);
    } catch (err: any) {
      const detail = err?.response?.data?.error || err?.message || '';
      setError(`Analysis failed${detail ? ': ' + detail : '. The AI may have returned an unexpected format. Try simplifying your brief.'}`);
    } finally {
      setAnalysing(false);
    }
  }, [submissions, brief, questionSample]);

  const exportReport = useCallback(() => {
    if (!report) return;
    const lines = [
      'OUTCOME INTELLIGENCE REPORT',
      `ResearchOS · Generated ${new Date().toLocaleString('en-GB')}`,
      '═'.repeat(56),
      '',
      `INFERRED OBJECTIVE`,
      report.inferredObjective,
      '',
      `STUDY DESIGN: ${report.studyDesign}`,
      `RESEARCH QUALITY SCORE: ${report.researchQualityScore}/100  [${report.verdict.toUpperCase()}]`,
      `DATA COMPLETENESS: ${report.dataCompleteness}%`,
      '',
      '─'.repeat(40),
      'OBJECTIVE SCORES',
      ...report.objectiveScores.map(o => `  ${o.objective.padEnd(40)} ${o.score}/100  (${o.confidence} confidence)`),
      '',
      '─'.repeat(40),
      'METHODOLOGICAL GAPS',
      ...report.methodologicalGaps.map(g => `  [${g.severity.toUpperCase()}] ${g.dimension}\n    ${g.description}\n    → ${g.recommendation}`),
      '',
      '─'.repeat(40),
      'KEY FINDINGS',
      ...report.keyFindings.map(f => `  • ${f}`),
      '',
      `REPRESENTATION RISK: ${report.representationRisk}`,
      `STATISTICAL ADEQUACY: ${report.statisticalAdequacy}`,
      '',
      '─'.repeat(56),
      'Generated by ResearchOS Outcome Intelligence',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'outcome-intelligence-report.txt'; a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  const verdictMeta = report ? {
    strong: { color: GREEN, label: 'Strong Evidence', icon: CheckCircle2 },
    adequate: { color: BLUE, label: 'Adequate Evidence', icon: CheckCircle2 },
    weak: { color: AMBER, label: 'Weak Evidence', icon: AlertCircle },
    insufficient: { color: RED, label: 'Insufficient Evidence', icon: XCircle },
  }[report.verdict] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#F0F4FF,#F5F0FF)', border: '1px solid #C7D2FE', display: 'grid', placeItems: 'center' }}>
              <Target size={16} color={BLUE} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#080D1A', letterSpacing: -.6, margin: 0 }}>Outcome Intelligence</h1>
          </div>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 4 }}>
            Retroactive analysis — did your research actually answer the study objective?
          </p>
        </div>
        {report && (
          <button onClick={exportReport}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <Download size={13} /> Export Report
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: report ? '320px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Setup panel ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Data source */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .8 }}>Dataset</div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>Load from this project or upload any CSV/JSON</div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={loadFromProject} disabled={loadingData}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', border: `1px solid ${dataLoaded && !loadingData ? GREEN : BLUE}`, borderRadius: 9, background: dataLoaded && !loadingData ? GREEN + '10' : BLUE + '08', fontSize: 12.5, fontWeight: 600, color: dataLoaded && !loadingData ? GREEN : BLUE, cursor: loadingData ? 'not-allowed' : 'pointer' }}>
                {loadingData ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : dataLoaded ? <CheckCircle2 size={13} /> : <BarChart2 size={13} />}
                {loadingData ? 'Loading…' : dataLoaded ? `${submissions.length} submissions loaded` : 'Load from current project'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                <span style={{ fontSize: 10.5, color: '#CBD5E1', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
              </div>

              <input ref={fileRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={handleFileUpload} />
              <button onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', border: '1px dashed #D1D5DB', borderRadius: 9, background: '#FAFBFF', fontSize: 12.5, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>
                <Upload size={13} /> Upload CSV or JSON
              </button>
              <div style={{ fontSize: 10.5, color: '#CBD5E1', textAlign: 'center', lineHeight: 1.5 }}>
                Works with any dataset — KoboToolbox exports, ODK, or ResearchOS CSVs
              </div>
            </div>
          </div>

          {/* Study brief */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .8 }}>Study Brief</div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>Optional — improves accuracy. Leave blank to infer from data.</div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Paste your Terms of Reference, research objective, or study brief here…"
                style={{ width: '100%', minHeight: 100, resize: 'vertical', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#374151', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: '#FAFBFF' }}
              />
              <textarea
                value={questionSample}
                onChange={e => setQuestionSample(e.target.value)}
                placeholder="Optional: paste 3–5 survey questions that represent the questionnaire…"
                style={{ width: '100%', minHeight: 70, resize: 'vertical', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#374151', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: '#FAFBFF' }}
              />
            </div>
          </div>

          {/* Run button */}
          <button onClick={runAnalysis} disabled={analysing || !dataLoaded}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0',
              border: 'none', borderRadius: 12, fontSize: 13.5, fontWeight: 700,
              background: analysing ? PURPLE + 'CC' : dataLoaded ? PURPLE : '#E5E7EB',
              color: dataLoaded ? 'white' : '#9CA3AF',
              cursor: analysing || !dataLoaded ? 'not-allowed' : 'pointer',
              boxShadow: dataLoaded && !analysing ? `0 4px 16px ${PURPLE}40` : 'none',
              transition: 'all .2s',
            }}>
            {analysing
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
              : <><Sparkles size={15} /> Run Outcome Analysis</>}
          </button>
          {!dataLoaded && (
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: -4 }}>Load a dataset first</div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 9, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: RED, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Results panel ─────────────────────────────────────────────────── */}
        {report && (
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Verdict banner */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
              <div style={{ padding: '16px 20px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* Score rings */}
                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                  <ScoreRing score={report.researchQualityScore} label="Quality" />
                  <ScoreRing score={report.dataCompleteness} label="Complete" size={72} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {verdictMeta && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: verdictMeta.color + '15', border: `1px solid ${verdictMeta.color}30`, marginBottom: 8 }}>
                      <verdictMeta.icon size={12} color={verdictMeta.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: verdictMeta.color }}>{verdictMeta.label}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#080D1A', marginBottom: 6, lineHeight: 1.5 }}>{report.inferredObjective}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 8 }}>{report.studyDesign}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', padding: '3px 10px', borderRadius: 6, background: '#F8FAFF', border: '1px solid #E8EDF5' }}>{report.statisticalAdequacy}</div>
                  </div>
                </div>

                <button onClick={runAnalysis} disabled={analysing}
                  style={{ padding: 8, border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', cursor: 'pointer', flexShrink: 0 }}
                  title="Re-run analysis">
                  <RefreshCw size={13} color="#9CA3AF" style={analysing ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
                {([['objectives', 'Objective Scores', report.objectiveScores.length],
                   ['gaps', 'Methodological Gaps', report.methodologicalGaps.length],
                   ['findings', 'Key Findings', report.keyFindings.length]] as const).map(([id, label, count]) => (
                  <button key={id} onClick={() => setActiveSection(id)}
                    style={{ padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeSection === id ? 700 : 500, color: activeSection === id ? BLUE : '#9CA3AF', borderBottom: activeSection === id ? `2px solid ${BLUE}` : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: activeSection === id ? BLUE + '18' : '#F1F5F9', color: activeSection === id ? BLUE : '#9CA3AF' }}>{count}</span>
                  </button>
                ))}
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeSection === 'objectives' && report.objectiveScores.map((obj, i) => (
                  <ObjectiveCard key={i} obj={obj} />
                ))}

                {activeSection === 'gaps' && (
                  <>
                    {['critical', 'moderate', 'minor'].map(sev => {
                      const items = report.methodologicalGaps.filter(g => g.severity === sev);
                      if (!items.length) return null;
                      return (
                        <div key={sev}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: sev === 'critical' ? RED : sev === 'moderate' ? AMBER : BLUE, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 6 }}>
                            {sev} ({items.length})
                          </div>
                          {items.map((g, i) => <GapPill key={i} gap={g} />)}
                        </div>
                      );
                    })}
                    {report.methodologicalGaps.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                        <CheckCircle2 size={24} color={GREEN} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>No major gaps identified</div>
                      </div>
                    )}
                  </>
                )}

                {activeSection === 'findings' && (
                  <>
                    <div style={{ padding: '8px 14px', borderRadius: 9, background: PURPLE + '08', border: `1px solid ${PURPLE}20`, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Representation risk</div>
                      <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 500 }}>{report.representationRisk}</div>
                    </div>
                    {report.keyFindings.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 9, background: '#FAFBFF', border: '1px solid #E8EDF5' }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, background: BLUE + '18', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <FileText size={10} color={BLUE} />
                        </div>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{f}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state when no report yet and layout is single-col */}
        {!report && dataLoaded && !analysing && (
          <div style={{ display: 'none' }} /> // placeholder to keep grid stable
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
