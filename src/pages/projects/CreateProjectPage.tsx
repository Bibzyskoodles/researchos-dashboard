import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { projectsApi } from '../../services/api';
import { getIndustry, StudyType } from '../../context/ResearchContext';

const BLUE = '#2463EB';

function Step1Name({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('');
  const examples = ['Retail Audit Q3 2025', 'Consumer Usage & Attitudes Study', 'Beneficiary Survey — Northern Region', 'Brand Health Tracker Wave 4'];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Step 1 of 4
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 8 }}>
        Name your project
      </h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,.55)', marginBottom: 36 }}>
        Give your project a clear name so your team knows what it's for.
      </p>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
        placeholder="e.g. Retail Audit Q3 2025"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.15)',
          borderRadius: 10, padding: '14px 16px', fontSize: 18,
          color: 'white', outline: 'none', fontFamily: 'Inter, sans-serif',
          marginBottom: 12,
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 36 }}>
        {examples.map(ex => (
          <button key={ex} onClick={() => setName(ex)} style={{
            background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
            color: 'rgba(255,255,255,.55)', borderRadius: 6, padding: '4px 10px',
            fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>{ex}</button>
        ))}
      </div>
      <button
        disabled={!name.trim()}
        onClick={() => onNext(name.trim())}
        style={{
          background: name.trim() ? BLUE : 'rgba(255,255,255,.12)',
          color: 'white', border: 'none', borderRadius: 8,
          padding: '12px 24px', fontSize: 15, fontWeight: 600,
          cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif',
          transition: 'background .15s',
        }}
      >
        Continue →
      </button>
    </div>
  );
}

function StudyTypeCard({ st, selected, onSelect }: { st: StudyType; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? 'rgba(36,99,235,.15)' : 'rgba(255,255,255,.05)',
        border: `1.5px solid ${selected ? BLUE : 'rgba(255,255,255,.1)'}`,
        borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'all .15s',
        position: 'relative',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 20, height: 20, borderRadius: '50%', background: BLUE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'white', fontWeight: 700,
        }}>✓</div>
      )}
      <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 4 }}>
        {st.label}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
        {st.respondent_label} · {st.duration_expectation_mins.min}–{st.duration_expectation_mins.max} min
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
        {st.respondent_description}
      </div>
    </div>
  );
}

function Step2StudyType({
  onNext, onBack
}: {
  onNext: (studyTypeId: string) => void;
  onBack: () => void;
}) {
  const { org } = useAuth();
  const industryId = (org as any)?.industry_id || 'research_agency';
  const industry = getIndustry(industryId);
  const isRA = industryId === 'research_agency';
  const [selected, setSelected] = useState<string>(industry.study_types[0]?.id || '');

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Step 2 of 4
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 6 }}>
        {isRA ? 'What type of research is this?' : `What kind of ${industry.project_label.toLowerCase()} is this?`}
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 28 }}>
        {isRA
          ? 'Select the study type — this shapes how Ada analyses your data and how reports are structured.'
          : `Select the research type for this ${industry.project_label.toLowerCase()}.`
        }
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
        {industry.study_types.map(st => (
          <StudyTypeCard
            key={st.id}
            st={st}
            selected={selected === st.id}
            onSelect={() => setSelected(st.id)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
          color: 'white', borderRadius: 8, padding: '12px 20px',
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
        <button
          disabled={!selected}
          onClick={() => onNext(selected)}
          style={{
            background: selected ? BLUE : 'rgba(255,255,255,.12)',
            color: 'white', border: 'none', borderRadius: 8,
            padding: '12px 24px', fontSize: 14, fontWeight: 600,
            cursor: selected ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

const START_OPTIONS = [
  {
    id: 'design',
    icon: '📝',
    title: 'Design a questionnaire',
    desc: 'Ada will help you build a questionnaire from scratch — or from a brief.',
  },
  {
    id: 'connect',
    icon: '🔗',
    title: 'I already have a form',
    desc: 'Connect KoboToolbox, SurveyCTO, or ODK and start receiving submissions.',
  },
  {
    id: 'upload',
    icon: '📂',
    title: 'Upload existing data',
    desc: 'Start from data already collected — import a CSV or Excel file.',
  },
];

function Step3StartPoint({ onNext, onBack }: { onNext: (sp: string) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<string>('design');

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Step 3 of 4
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 6 }}>
        Where are you starting?
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 28 }}>
        Choose how you'd like to begin this project.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {START_OPTIONS.map(opt => (
          <div
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            style={{
              background: selected === opt.id ? 'rgba(36,99,235,.15)' : 'rgba(255,255,255,.05)',
              border: `1.5px solid ${selected === opt.id ? BLUE : 'rgba(255,255,255,.1)'}`,
              borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 16, transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 24 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 3 }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>{opt.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
          color: 'white', borderRadius: 8, padding: '12px 20px',
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
        <button onClick={() => onNext(selected)} style={{
          background: BLUE, color: 'white', border: 'none', borderRadius: 8,
          padding: '12px 24px', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Continue →</button>
      </div>
    </div>
  );
}

function Step4Target({ onSubmit, onBack, loading }: { onSubmit: (target?: number) => void; onBack: () => void; loading: boolean }) {
  const [target, setTarget] = useState('');

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Step 4 of 4
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 6 }}>
        Target submissions
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
        How many completed interviews are you aiming for? (Optional — you can set this later.)
      </p>
      <input
        type="number"
        min={1}
        value={target}
        onChange={e => setTarget(e.target.value)}
        placeholder="e.g. 500"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.15)',
          borderRadius: 10, padding: '14px 16px', fontSize: 20,
          color: 'white', outline: 'none', fontFamily: 'Inter, sans-serif',
          marginBottom: 32,
        }}
      />
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
          color: 'white', borderRadius: 8, padding: '12px 20px',
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
        <button
          disabled={loading}
          onClick={() => onSubmit(target ? parseInt(target) : undefined)}
          style={{
            background: loading ? 'rgba(255,255,255,.12)' : BLUE,
            color: 'white', border: 'none', borderRadius: 8,
            padding: '12px 24px', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          {loading ? 'Creating...' : 'Create Project →'}
        </button>
      </div>
    </div>
  );
}

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [studyTypeId, setStudyTypeId] = useState('');
  const [startPoint, setStartPoint] = useState('design');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (target?: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await projectsApi.create({
        name,
        study_type_id: studyTypeId,
        platform: startPoint === 'connect' ? 'kobo' : 'manual',
        target_submissions: target,
        start_point: startPoint,
      });
      navigate(`/projects/${res.data.project.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(135deg, #080D1A 0%, #0F1729 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '48px 24px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Back nav */}
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', marginBottom: 40 }}>
        <button
          onClick={() => step === 1 ? navigate('/projects') : setStep(s => s - 1)}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← {step === 1 ? 'All Projects' : 'Back'}
        </button>
      </div>

      {error && (
        <div style={{
          maxWidth: 560, margin: '0 auto 20px', width: '100%',
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, width: '100%' }}>
        {step === 1 && <Step1Name onNext={(n) => { setName(n); setStep(2); }} />}
        {step === 2 && <Step2StudyType onNext={(st) => { setStudyTypeId(st); setStep(3); }} onBack={() => setStep(1)} />}
        {step === 3 && <Step3StartPoint onNext={(sp) => { setStartPoint(sp); setStep(4); }} onBack={() => setStep(2)} />}
        {step === 4 && <Step4Target onSubmit={handleSubmit} onBack={() => setStep(3)} loading={loading} />}
      </div>
    </div>
  );
}
