import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ExternalLink, Copy, Award } from 'lucide-react';
import { useGamify, Certificate } from './GamifyContext';
import { openCertificatePrint } from './certificatePrint';
import { useAuth } from '../store/AuthContext';
import { useProject } from '../context/ProjectContext';
import { dashboardApi } from '../services/api';

const BLUE = '#2463EB';

interface QcStats {
  sampleSize: number;
  passRate: number;
  rejectionRate: number;
  flagsResolved: number;
  enumerators: number;
}

// Client-facing deliverable: a verifiable certificate that ships alongside the
// cleaned dataset, proving the QC process ran. Issuing one also earns the org
// credits toward their next subscription payment (see GamifyContext).
export default function DataIntegrityCard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProject } = useProject();
  const { user, org } = useAuth();
  const { issueCertificate, certificatesForProject } = useGamify();
  const [stats, setStats] = useState<QcStats | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [justIssued, setJustIssued] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    dashboardApi.getStats()
      .then(r => {
        if (!live) return;
        const d = r.data || {};
        const total = d.total_submissions ?? d.total ?? 0;
        const passed = d.passed ?? d.pass_count ?? 0;
        const rejected = d.rejected ?? d.reject_count ?? 0;
        const flagged = d.flagged ?? d.flag_count ?? 0;
        setStats({
          sampleSize: total,
          passRate: total ? Math.round((passed / total) * 100) : 0,
          rejectionRate: total ? Math.round((rejected / total) * 100) : 0,
          flagsResolved: flagged,
          enumerators: d.enumerator_count ?? d.enumerators ?? 0,
        });
      })
      .catch(() => { if (live) setStats(null); });
    return () => { live = false; };
  }, [projectId]);

  if (!projectId) return null;
  const existing = certificatesForProject(projectId);
  const canIssue = stats !== null && stats.sampleSize > 0;

  const handleIssue = () => {
    if (!stats || issuing) return;
    setIssuing(true);
    const cert = issueCertificate({
      projectId,
      projectName: activeProject?.name || 'Research Project',
      orgName: org?.name || 'Research Organisation',
      issuedBy: user?.name || 'Authorised Verifier',
      ...stats,
    });
    setJustIssued(cert);
    setIssuing(false);
    openCertificatePrint(cert);
  };

  const copyLink = (id: string) => {
    navigator.clipboard?.writeText(`https://fieldscore.app/verify/${id}`).catch(() => {});
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
            {canIssue && <span style={{ color: '#9CA3AF' }}> Based on {stats!.sampleSize.toLocaleString()} screened submissions.</span>}
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

      {justIssued && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 12px' }}>
          ✓ Certificate <strong style={{ fontFamily: 'monospace' }}>{justIssued.id}</strong> issued — opened in a new tab for printing. Credit applied toward your next payment.
        </div>
      )}

      {existing.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {existing.slice(0, 3).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: '#374151', background: 'white', border: '1px solid #E8EDF5', borderRadius: 8, padding: '7px 12px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0A1230' }}>{c.id}</span>
              <span style={{ color: '#9CA3AF' }}>
                {new Date(c.issuedAt).toLocaleDateString()} · {c.sampleSize.toLocaleString()} submissions · {c.passRate}% pass
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <button onClick={() => copyLink(c.id)} title="Copy verification link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === c.id ? '#059669' : '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                  <Copy size={11} /> {copied === c.id ? 'Copied' : 'Verify link'}
                </button>
                <button onClick={() => openCertificatePrint(c)} title="View / print" style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                  <ExternalLink size={11} /> View
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
