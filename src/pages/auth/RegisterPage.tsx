import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { INDUSTRY_PROFILES } from '../../context/ResearchContext';
import FieldScoreLogo from '../../components/brand/FieldScoreLogo';
import api from '../../services/api';

const BLUE = '#2463EB';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [studyTypeId, setStudyTypeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedIndustry = INDUSTRY_PROFILES.find(i => i.id === industryId);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !orgName || !email || !password) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleIndustrySelect = (id: string) => {
    setIndustryId(id);
    const ind = INDUSTRY_PROFILES.find(i => i.id === id);
    if (ind) setStudyTypeId(ind.study_types[0]?.id || '');
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', {
        name, org_name: orgName, email, password,
        industry_id: industryId || 'research_agency',
        default_study_type_id: studyTypeId,
      });
      await login(email, password);
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#F0F4FF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: step === 2 ? 680 : step === 3 ? 600 : 420 }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <FieldScoreLogo height={22} mode="light" casing="#F0F4FF" sub="ResearchOS" style={{ alignItems: 'center' }} />
        </div>

        {/* Step 1: Account details */}
        {step === 1 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px rgba(8,13,26,.10)' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#080D1A', marginBottom: 6 }}>Create your account</h1>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Set up ResearchOS for your organisation.</p>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '9px 12px', borderRadius: 7, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
            <form onSubmit={handleStep1}>
              {[
                { label: 'Your name', value: name, set: setName, placeholder: 'Jane Smith', type: 'text' },
                { label: 'Organisation name', value: orgName, set: setOrgName, placeholder: 'Acme Research Ltd', type: 'text' },
                { label: 'Email address', value: email, set: setEmail, placeholder: 'you@organisation.com', type: 'email' },
                { label: 'Password', value: password, set: setPassword, placeholder: '••••••••', type: 'password' },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#080D1A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button type="submit" style={{
                width: '100%', padding: 11, background: BLUE, color: 'white', border: 'none',
                borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: 4,
              }}>
                Continue →
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', marginTop: 20 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: BLUE, fontWeight: 600 }}>Sign in</Link>
            </p>
          </div>
        )}

        {/* Step 2: Industry selection */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#080D1A', marginBottom: 6, textAlign: 'center' }}>What industry are you in?</h1>
            <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 24, textAlign: 'center' }}>
              This helps ResearchOS adapt to your context — labels, quality checks, and reporting all change.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {INDUSTRY_PROFILES.map(ind => (
                <div
                  key={ind.id}
                  onClick={() => handleIndustrySelect(ind.id)}
                  style={{
                    background: industryId === ind.id ? '#EFF6FF' : 'white',
                    border: `1.5px solid ${industryId === ind.id ? BLUE : '#E8EDF5'}`,
                    borderRadius: 12, padding: '16px 14px', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(10,15,28,.05)', position: 'relative',
                    transition: 'all .15s',
                  }}
                >
                  {industryId === ind.id && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8, width: 18, height: 18,
                      borderRadius: '50%', background: BLUE, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white',
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{ind.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#080D1A', marginBottom: 3 }}>{ind.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>{ind.description}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{
                background: 'white', border: '1px solid #E2E8F0', color: '#374151', borderRadius: 8,
                padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>← Back</button>
              <button
                disabled={!industryId}
                onClick={() => setStep(3)}
                style={{
                  background: industryId ? BLUE : '#CBD5E1', color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: industryId ? 'pointer' : 'not-allowed',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Study type */}
        {step === 3 && selectedIndustry && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#080D1A', marginBottom: 6, textAlign: 'center' }}>
              What's your primary research type?
            </h1>
            <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 24, textAlign: 'center' }}>
              Your default — you can always change this per project.
            </p>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '9px 12px', borderRadius: 7, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
              {selectedIndustry.study_types.map(st => (
                <div
                  key={st.id}
                  onClick={() => setStudyTypeId(st.id)}
                  style={{
                    background: studyTypeId === st.id ? '#EFF6FF' : 'white',
                    border: `1.5px solid ${studyTypeId === st.id ? BLUE : '#E8EDF5'}`,
                    borderRadius: 10, padding: '14px', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(10,15,28,.04)', transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#080D1A', marginBottom: 3 }}>{st.label}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {st.duration_expectation_mins.min}–{st.duration_expectation_mins.max} min · {st.respondent_label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{
                background: 'white', border: '1px solid #E2E8F0', color: '#374151', borderRadius: 8,
                padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>← Back</button>
              <button
                disabled={loading || !studyTypeId}
                onClick={handleRegister}
                style={{
                  background: studyTypeId && !loading ? BLUE : '#CBD5E1',
                  color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  cursor: studyTypeId && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {loading ? 'Creating account...' : 'Create account →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
