import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import {
  ConfiguratorAnswers, OrgType, Criticality, SetupHelp, Evidence,
  ORG_PROFILES, EVIDENCE_META, defaultsFor, recommend, annualInterviews,
} from './configuratorEngine';

/**
 * Ada-guided deployment configurator — the public "pricing" experience.
 *
 * See docs/deployment_configurator_spec.md. Two rules govern this page:
 *
 * 1. It never quotes a price. It shows an INDICATIVE RANGE and routes to a
 *    human. The published self-serve plans stay in Settings → Billing.
 * 2. Ada states assumptions, never fabricated evidence. The one inferred
 *    figure (annual interviews) is shown WITH the assumption behind it, and
 *    that assumption is editable. We sell "we detect invented research data";
 *    inventing numbers in our own estimator would undercut exactly that.
 */

const INK = '#0A0F1F';
const BLUE = '#2463EB';
const MUTE = '#6B7280';
const LINE = '#E8EDF5';
const EASE = { duration: 0.22, ease: 'easeOut' as const };

const TOTAL_STEPS = 6;

type Phase = 'welcome' | 'questions' | 'result';

export default function ConfiguratorPage() {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<ConfiguratorAnswers>({
    orgType: null,
    ...defaultsFor('other'),
  });

  const rec = useMemo(() => recommend(answers), [answers]);
  const started = answers.orgType !== null;

  const chooseOrg = (t: OrgType) => {
    // Picking an org type pre-positions every later answer, so a user can
    // simply press Next through the rest. Inference as a visible default.
    setAnswers({ orgType: t, ...defaultsFor(t) });
    setStep(2);
  };

  const set = <K extends keyof ConfiguratorAnswers>(k: K, v: ConfiguratorAnswers[K]) =>
    setAnswers(a => ({ ...a, [k]: v }));

  const toggleEvidence = (e: Evidence) =>
    setAnswers(a => ({
      ...a,
      evidence: a.evidence.includes(e) ? a.evidence.filter(x => x !== e) : [...a.evidence, e],
    }));

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F9FC', fontFamily: 'Inter, sans-serif',
      color: INK, padding: '32px 20px 64px',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <Header />

        {phase === 'welcome' && <Welcome onStart={() => setPhase('questions')} />}

        {phase === 'questions' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 28, alignItems: 'start' }}
               className="cfg-grid">
            <div>
              <Progress step={step} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={EASE}
                >
                  {step === 1 && <StepOrg onPick={chooseOrg} chosen={answers.orgType} />}
                  {step === 2 && (
                    <StepSlider
                      title="Roughly how many fieldworkers do you manage?"
                      value={answers.fieldworkers} min={5} max={5000} step={5}
                      onChange={v => set('fieldworkers', v)}
                      format={v => `${v.toLocaleString()} fieldworkers`}
                      ada={teamSizeNote(answers.fieldworkers)}
                    />
                  )}
                  {step === 3 && (
                    <StepVolume
                      answers={answers}
                      onProjects={v => set('projectsPerYear', v)}
                      onPerProject={v => set('interviewsPerProject', v)}
                    />
                  )}
                  {step === 4 && <StepEvidence selected={answers.evidence} onToggle={toggleEvidence} />}
                  {step === 5 && <StepCriticality value={answers.criticality} onChange={v => set('criticality', v)} />}
                  {step === 6 && <StepSetup value={answers.setupHelp} onChange={v => set('setupHelp', v)} />}
                </motion.div>
              </AnimatePresence>

              <Nav
                step={step}
                canAdvance={started}
                onBack={() => setStep(s => Math.max(1, s - 1))}
                onNext={() => (step === TOTAL_STEPS ? setPhase('result') : setStep(s => s + 1))}
              />
            </div>

            <RecommendationPanel answers={answers} rec={rec} live />
          </div>
        )}

        {phase === 'result' && <Result answers={answers} rec={rec} onEdit={() => { setPhase('questions'); setStep(1); }} />}
      </div>

      {/* The two-panel layout is a desktop pattern; stack it on smaller screens
          rather than shrinking both columns into unreadability. */}
      <style>{`@media (max-width: 900px) { .cfg-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

/* ── chrome ─────────────────────────────────────────────────────────────── */

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>FIELDSC<span style={{ color: BLUE }}>◎</span>RE</span>
      <span style={{ fontSize: 11, color: MUTE, letterSpacing: 1, textTransform: 'uppercase' }}>ResearchOS</span>
    </div>
  );
}

function AdaLine({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14 }}>
      <img src="/ada-avatar.jpg" alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
           onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
      <div style={{ fontSize: 13.5, color: muted ? MUTE : '#374151', lineHeight: 1.55, paddingTop: 3 }}>{children}</div>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={EASE}
      style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 20, padding: '48px 44px', maxWidth: 620, margin: '48px auto 0', textAlign: 'center' }}>
      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', marginBottom: 20 }}
           onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <h1 style={{ fontSize: 27, fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.6 }}>Hi, I'm Ada 👋</h1>
      <p style={{ fontSize: 15.5, color: MUTE, lineHeight: 1.6, margin: '0 0 8px' }}>
        Let's find the right FieldScore configuration for your organisation.
      </p>
      <p style={{ fontSize: 13.5, color: '#9CA3AF', margin: '0 0 28px' }}>Six questions, about 90 seconds.</p>
      <button onClick={onStart} style={{ ...primaryBtn, fontSize: 14.5, padding: '13px 30px' }}>
        Start <ArrowRight size={16} />
      </button>
    </motion.div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i < step ? BLUE : '#E5EAF2', transition: 'background 220ms ease',
        }} />
      ))}
      <span style={{ fontSize: 11.5, color: MUTE, marginLeft: 6, whiteSpace: 'nowrap' }}>{step} / {TOTAL_STEPS}</span>
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '30px 30px 34px' }}>
      <h2 style={{ fontSize: 20.5, fontWeight: 750, margin: '0 0 20px', letterSpacing: -0.35, lineHeight: 1.35 }}>{title}</h2>
      {children}
    </div>
  );
}

/* ── steps ──────────────────────────────────────────────────────────────── */

function StepOrg({ onPick, chosen }: { onPick: (t: OrgType) => void; chosen: OrgType | null }) {
  const types = Object.keys(ORG_PROFILES) as OrgType[];
  return (
    <Question title="What best describes your organisation?">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {types.map(t => {
          const p = ORG_PROFILES[t];
          const on = chosen === t;
          return (
            <button key={t} onClick={() => onPick(t)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              padding: '18px 16px', borderRadius: 13, cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${on ? BLUE : LINE}`, background: on ? '#F5F8FF' : 'white',
              fontFamily: 'Inter, sans-serif', transition: 'all 220ms ease',
            }}>
              <span style={{ fontSize: 21 }}>{p.icon}</span>
              <span style={{ fontSize: 13.5, fontWeight: 650, color: INK }}>{p.label}</span>
            </button>
          );
        })}
      </div>
      {chosen && <AdaLine>{ORG_PROFILES[chosen].note}</AdaLine>}
    </Question>
  );
}

function StepSlider({ title, value, min, max, step, onChange, format, ada }: {
  title: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; ada?: string;
}) {
  return (
    <Question title={title}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, marginBottom: 4 }}>{format(value)}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: BLUE, marginTop: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
        <span>{min.toLocaleString()}</span><span>{max.toLocaleString()}+</span>
      </div>
      {ada && <AdaLine>{ada}</AdaLine>}
    </Question>
  );
}

function StepVolume({ answers, onProjects, onPerProject }: {
  answers: ConfiguratorAnswers; onProjects: (v: number) => void; onPerProject: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const total = annualInterviews(answers);
  return (
    <Question title="About how many projects do you run each year?">
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8 }}>{answers.projectsPerYear} projects</div>
      <input type="range" min={1} max={200} value={answers.projectsPerYear}
        onChange={e => onProjects(Number(e.target.value))}
        style={{ width: '100%', accentColor: BLUE, marginTop: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#9CA3AF' }}>
        <span>1</span><span>200+</span>
      </div>

      {/* The one inferred number — shown WITH its assumption, and editable.
          Never presented as knowledge about "similar organisations". */}
      <div style={{ marginTop: 20, padding: '16px 18px', background: '#F5F8FF', borderRadius: 13, border: '1px solid #DCE6FF' }}>
        <div style={{ fontSize: 12, color: MUTE, marginBottom: 4 }}>That works out to roughly</div>
        <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.5 }}>{total.toLocaleString()} interviews a year</div>
        <div style={{ fontSize: 12.5, color: MUTE, marginTop: 8 }}>
          I'm assuming <strong>{answers.interviewsPerProject}</strong> interviews per project.{' '}
          <button onClick={() => setEditing(v => !v)} style={linkBtn}>
            {editing ? 'Done' : 'Adjust'}
          </button>
        </div>
        {editing && (
          <div style={{ marginTop: 12 }}>
            <input type="range" min={20} max={5000} step={10} value={answers.interviewsPerProject}
              onChange={e => onPerProject(Number(e.target.value))}
              style={{ width: '100%', accentColor: BLUE }} />
            <div style={{ fontSize: 12, color: MUTE }}>{answers.interviewsPerProject} per project</div>
          </div>
        )}
      </div>
      <AdaLine muted>That's my starting assumption, not a measurement — adjust it and everything below updates.</AdaLine>
    </Question>
  );
}

function StepEvidence({ selected, onToggle }: { selected: Evidence[]; onToggle: (e: Evidence) => void }) {
  const all = Object.keys(EVIDENCE_META) as Evidence[];
  return (
    <Question title="What evidence do your teams usually collect?">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {all.map(e => {
          const on = selected.includes(e);
          return (
            <button key={e} onClick={() => onToggle(e)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '15px 16px', borderRadius: 13,
              border: `1.5px solid ${on ? BLUE : LINE}`, background: on ? '#F5F8FF' : 'white',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', transition: 'all 220ms ease',
            }}>
              <span style={{ fontSize: 17 }}>{EVIDENCE_META[e].icon}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, flex: 1 }}>{EVIDENCE_META[e].label}</span>
              {on && <Check size={15} color={BLUE} />}
            </button>
          );
        })}
      </div>
      <AdaLine>This decides which verification engines I turn on — each type of evidence is checked differently.</AdaLine>
    </Question>
  );
}

const CRITICALITY: { id: Criticality; icon: string; label: string; sub: string }[] = [
  { id: 'helpful',   icon: '😊', label: 'Helpful',          sub: 'Good to have, not business-critical' },
  { id: 'important', icon: '⭐', label: 'Important',        sub: 'Our work depends on it' },
  { id: 'critical',  icon: '🚨', label: 'Mission critical', sub: 'Failures have real consequences' },
];

function StepCriticality({ value, onChange }: { value: Criticality; onChange: (v: Criticality) => void }) {
  return (
    <Question title="How important is field data quality to your organisation?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CRITICALITY.map(c => {
          const on = value === c.id;
          return (
            <button key={c.id} onClick={() => onChange(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderRadius: 13,
              border: `1.5px solid ${on ? BLUE : LINE}`, background: on ? '#F5F8FF' : 'white',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', transition: 'all 220ms ease',
            }}>
              <span style={{ fontSize: 19 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: INK }}>{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTE }}>{c.sub}</span>
              </span>
              {on && <Check size={16} color={BLUE} />}
            </button>
          );
        })}
      </div>
    </Question>
  );
}

const SETUP: { id: SetupHelp; label: string; sub: string }[] = [
  { id: 'none', label: 'We\'ll set it up ourselves', sub: 'You have the capacity in-house' },
  { id: 'configuration', label: 'Help us configure it', sub: 'We set up your projects and scoring rules with you' },
  { id: 'configuration_training', label: 'Configuration + team training', sub: 'Plus sessions for supervisors and fieldworkers' },
];

function StepSetup({ value, onChange }: { value: SetupHelp; onChange: (v: SetupHelp) => void }) {
  return (
    <Question title="Would you like help getting set up?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SETUP.map(s => {
          const on = value === s.id;
          return (
            <button key={s.id} onClick={() => onChange(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderRadius: 13,
              border: `1.5px solid ${on ? BLUE : LINE}`, background: on ? '#F5F8FF' : 'white',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', transition: 'all 220ms ease',
            }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: INK }}>{s.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTE }}>{s.sub}</span>
              </span>
              {on && <Check size={16} color={BLUE} />}
            </button>
          );
        })}
      </div>
    </Question>
  );
}

function Nav({ step, canAdvance, onBack, onNext }: {
  step: number; canAdvance: boolean; onBack: () => void; onNext: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
      <button onClick={onBack} disabled={step === 1}
        style={{ ...ghostBtn, opacity: step === 1 ? 0.35 : 1, cursor: step === 1 ? 'default' : 'pointer' }}>
        <ArrowLeft size={15} /> Back
      </button>
      <button onClick={onNext} disabled={!canAdvance}
        style={{ ...primaryBtn, opacity: canAdvance ? 1 : 0.4, cursor: canAdvance ? 'pointer' : 'default' }}>
        {step === TOTAL_STEPS ? 'See my recommendation' : 'Next'} <ArrowRight size={15} />
      </button>
    </div>
  );
}

/* ── recommendation ─────────────────────────────────────────────────────── */

function RecommendationPanel({ answers, rec, live }: {
  answers: ConfiguratorAnswers; rec: ReturnType<typeof recommend>; live?: boolean;
}) {
  if (!answers.orgType) {
    return (
      <div style={{ ...panel, color: MUTE, fontSize: 13.5 }}>
        Your recommendation will build here as you answer.
      </div>
    );
  }
  return (
    <div style={panel}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        {live ? 'Building your recommendation' : 'Your recommendation'}
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 14 }}>{rec.tierLabel}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rec.engines.map(e => (
          <li key={e} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
            <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />{e}
          </li>
        ))}
        <li style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
          <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />{rec.supportLabel}
        </li>
        <li style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
          <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />{rec.onboardingLabel}
        </li>
        {rec.pilotRecommended && (
          <li style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
            <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />Pilot project included
          </li>
        )}
      </ul>
    </div>
  );
}

const GAINS = [
  ['Every interview reviewed', 'Spot-checking a sample by hand'],
  ['Fraud flagged automatically', 'Fabrication found late, or not at all'],
  ['A quality score per fieldworker', 'Reputation and memory'],
  ['Evidence you can show a funder', 'A spreadsheet and a promise'],
];

function Result({ answers, rec, onEdit }: {
  answers: ConfiguratorAnswers; rec: ReturnType<typeof recommend>; onEdit: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const send = async () => {
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setState('sending'); setError('');
    try {
      await api.post('/api/leads/deployment-plan', {
        email: email.trim(), name: name.trim(), organisation: org.trim(),
        org_type: answers.orgType, tier: rec.tierLabel,
        support: rec.supportLabel, onboarding: rec.onboardingLabel,
        fieldworkers: answers.fieldworkers, projects_per_year: answers.projectsPerYear,
        annual_interviews: rec.annualInterviews, evidence: answers.evidence,
        engines: rec.engines, investment_low: rec.investmentLow, investment_high: rec.investmentHigh,
      });
      setState('sent');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not send just now — please try again.');
      setState('error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={EASE}
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 28, alignItems: 'start' }}
      className="cfg-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '30px 30px 32px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Based on your answers
          </div>
          <h1 style={{ fontSize: 25, fontWeight: 800, margin: '0 0 14px', letterSpacing: -0.6 }}>{rec.tierLabel}</h1>
          <AdaLine>{rec.rationale}</AdaLine>
        </div>

        <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '26px 30px 30px' }}>
          <div style={{ fontSize: 15.5, fontWeight: 750, marginBottom: 16 }}>What changes</div>
          {GAINS.map(([withFs, without]) => (
            <div key={withFs} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '11px 0', borderTop: `1px solid #F3F6FB` }}>
              <div style={{ fontSize: 13, color: '#374151', display: 'flex', gap: 8 }}>
                <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />{withFs}
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>{without}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '26px 30px 30px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Indicative annual investment
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: -0.7 }}>
            ₦{rec.investmentLow.toLocaleString()} – ₦{rec.investmentHigh.toLocaleString()}
          </div>
          <p style={{ fontSize: 12.5, color: MUTE, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
            A guide based on what you told us — not a quotation. The exact figure depends on how you
            deploy, and we'd rather talk it through than guess.
          </p>
        </div>

        <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 18, padding: '26px 30px 30px' }}>
          {state === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 750, marginBottom: 6 }}>Sent — check your inbox 📩</div>
              <div style={{ fontSize: 13.5, color: MUTE }}>We'll follow up shortly. You can reply to that email directly.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15.5, fontWeight: 750, marginBottom: 4 }}>Send me this configuration</div>
              <div style={{ fontSize: 13, color: MUTE, marginBottom: 16 }}>We'll email it over and follow up — no obligation.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={input} />
                <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Organisation" style={input} />
              </div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Work email" type="email"
                     style={{ ...input, marginBottom: 12 }} />
              {error && <div style={{ fontSize: 12.5, color: '#DC2626', marginBottom: 10 }}>{error}</div>}
              <button onClick={send} disabled={state === 'sending'}
                style={{ ...primaryBtn, width: '100%', justifyContent: 'center', opacity: state === 'sending' ? 0.6 : 1 }}>
                {state === 'sending' ? 'Sending…' : 'Email me this configuration'}
              </button>
            </>
          )}
        </div>

        <button onClick={onEdit} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>
          <ArrowLeft size={15} /> Change my answers
        </button>
      </div>

      <RecommendationPanel answers={answers} rec={rec} />
    </motion.div>
  );
}

/* ── Ada's threshold notes — she speaks when the picture changes, not on
      every tick, which reads as noise within about ten seconds. ───────────── */

function teamSizeNote(n: number): string {
  if (n >= 1000) return "At this scale I'd suggest a dedicated environment — we should talk about how you'd roll it out.";
  if (n >= 300) return "That's a large field operation. Supervisor tooling and per-fieldworker scoring matter most at this size.";
  if (n >= 50) return "A medium-sized field team — the sweet spot for automated verification.";
  return 'A focused team. Everything here scales down cleanly.';
}

/* ── shared styles ──────────────────────────────────────────────────────── */

const panel: React.CSSProperties = {
  background: 'white', border: `1px solid ${LINE}`, borderRadius: 18,
  padding: '24px 26px', position: 'sticky', top: 24,
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
  borderRadius: 11, border: 'none', background: BLUE, color: 'white',
  fontSize: 13.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px',
  borderRadius: 11, border: `1px solid ${LINE}`, background: 'white', color: MUTE,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};
const input: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: `1px solid ${LINE}`,
  fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: INK, boxSizing: 'border-box',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: BLUE, fontSize: 12.5, fontWeight: 650,
  cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', textDecoration: 'underline',
};
