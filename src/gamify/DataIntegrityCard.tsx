import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ExternalLink, Copy, Award } from 'lucide-react';
import { useGamify, Certificate } from './GamifyContext';
import { openCertificate } from './certificatePrint';
import { certificateApi, dashboardApi } from '../services/api';

const BLUE = '#2463EB';

// Client-facing deliverable: a verifiable certificate that ships alongside the
// cleaned dataset, proving the QC process ran. Issuing one also earns the org
// credits toward their next subscription payment (see GamifyContext). All the
// actual content (stats, signature, QR) is computed and frozen server-side at
// issuance — this component just triggers that and tracks the local "issued"
// list for the credits/milestone UX.
export default function DataIntegrityCard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { recordCertificateIssued, certificatesForProject } = useGamify();
  const [hasSubmissions, setHasSubmissions] = useState<boolean | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [justIssued, setJustIssued] = useState<Certificate | null>(null);
  const [issueError, setIssueError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    dashboardApi.getStats()
      .then(r => {
        if (!live) return;
        const d = r.data || {};
        const total = d.total_submissions ?? d.total ?? 0;
        setHasSubmissions(total > 0);
      })
      .catch(() => { if (live) setHasSubmissions(null); });
    return () => { live = false; };
  }, [projectId]);

  if (!projectId) return null;
  const existing = certificatesForProject(projectId);
  const canIssue = hasSubmissions === true;

  const handleIssue = async () => {
    if (!canIssue || issuing) return;
    setIssuing(true);
    setIssueError('');
    try {
      const res = await certificateApi.issue(projectId);
      const cert: Certificate = { id: res.data.cert_id, projectId, issuedAt: res.data.issued_at };
      recordCertificateIssued(cert);
      setJustIssued(cert);
      await openCertificate(projectId);
    } catch (e: any) {
      setIssueError(e?.response?.data?.error || 'Could not issue a certificate — please try again.');
    } finally {
      setIssuing(false);
    }
  };

  const copyLink = (id: string) => {
    navigator.clipboard?.writeText(certificateApi.verifyUrl(id)).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F7FAFF 100%)',
      border: '1px solid #DBEAFE', borderRadius: 14, padding: '16px 18px',
      marginBottom: 20, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: '#EFF6FF',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <ShieldCheck size={19} color={BLUE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#080D1A' }}>
            Data Integrity Certificate
            {existing.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 12 }}>
                {existing.length} issued
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
            Ship a verifiable QC certificate alongside your cleaned data — show clients every submission was screened.
          </div>
        </div>
        <button
          onClick={handleIssue}
          disabled={!canIssue || issuing}
          title={canIssue ? 'Generate certificate' : 'Needs at least one screened submission'}
          style={{
            background: canIssue ? BLUE : '#E2E8F0', color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 12.5, fontWeight: 600,
            cursor: canIssue ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}
        >
          <Award size={13} />
          {issuing ? 'Issuing…' : existing.length > 0 ? 'Issue new certificate' : 'Issue certificate'}
        </button>
      </div>

      {issueError && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px' }}>
          {issueError}
        </div>
      )}

      {justIssued && !issueError && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 12px' }}>
          ✓ Certificate <strong style={{ fontFamily: 'monospace' }}>{justIssued.id}</strong> issued — opened in a new tab for printing. Credit applied toward your next payment.
        </div>
      )}

      {existing.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {existing.slice(0, 3).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: '#374151', background: 'white', border: '1px solid #E8EDF5', borderRadius: 8, padding: '7px 12px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0A1230' }}>{c.id}</span>
              <span style={{ color: '#9CA3AF' }}>{new Date(c.issuedAt).toLocaleDateString()}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <button onClick={() => copyLink(c.id)} title="Copy verification link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === c.id ? '#059669' : '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                  <Copy size={11} /> {copied === c.id ? 'Copied' : 'Verify link'}
                </button>
                {/* Only the latest certificate for a project can be viewed as
                    HTML (see certificate.py's render_certificate) — older
                    entries in this list are still independently verifiable
                    via the link above, which resolves that exact record. */}
                {c.id === existing[0].id && (
                  <button onClick={() => openCertificate(c.projectId)} title="View / print latest certificate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                    <ExternalLink size={11} /> View
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
