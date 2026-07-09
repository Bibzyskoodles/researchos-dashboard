import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Save, X } from 'lucide-react';
import api from '../../services/api';
import { GeneratedQuestionnaire } from './types';

interface Props {
  questionnaire: GeneratedQuestionnaire;
  onClose: () => void;
  onSave: () => void;
}

const BLUE = '#2463EB';
const GREEN = '#059669';

const EXPORT_OPTIONS = [
  {
    id: 'kobo',
    icon: '🌐',
    label: 'KoboToolbox XLSForm',
    description: 'Full XLSForm with skip logic in KoboToolbox syntax',
    format: '.xlsx',
    color: '#059669',
  },
  {
    id: 'surveycto',
    icon: '📊',
    label: 'SurveyCTO',
    description: 'SurveyCTO-compatible XLSForm',
    format: '.xlsx',
    color: '#7C3AED',
  },
  {
    id: 'odk',
    icon: '📋',
    label: 'ODK XLSForm',
    description: 'Standard ODK format',
    format: '.xlsx',
    color: '#D97706',
  },
  {
    id: 'docx',
    icon: '📄',
    label: 'Word Document',
    description: 'Professional interviewer guide with branding',
    format: '.docx',
    color: '#2463EB',
  },
  {
    id: 'json',
    icon: '</> ',
    label: 'JSON Export',
    description: 'Raw questionnaire JSON for developers',
    format: '.json',
    color: '#6B7280',
  },
];

export default function ExportPanel({ questionnaire, onClose, onSave }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportQuestionnaire = async (format: string) => {
    setExporting(format);
    setError(null);

    try {
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(questionnaire, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${questionnaire.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const endpoint = format === 'docx'
        ? '/questionnaire/export/docx'
        : '/questionnaire/export/xlsform';

      const res = await api.post(endpoint, {
        questionnaire,
        platform: format,
      }, { responseType: 'blob' });

      const ext = format === 'docx' ? '.docx' : '.xlsx';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${questionnaire.title.replace(/[^a-zA-Z0-9]/g, '_')}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Export failed. The ${format.toUpperCase()} export endpoint may not be set up yet.`);
    } finally {
      setExporting(null);
    }
  };

  const handleSave = async () => {
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save questionnaire.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(8,13,26,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 24, fontFamily: 'Inter, sans-serif',
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          background: 'white', borderRadius: 20, maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflow: 'auto', padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Export Questionnaire</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{questionnaire.title}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={20} />
          </button>
        </div>

        {/* Ada's final note */}
        <div style={{
          padding: 16, background: '#EEF2FF', borderRadius: 12,
          borderLeft: `4px solid ${BLUE}`, marginBottom: 24, fontSize: 13, color: '#374151', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: BLUE, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            Ada's recommendation
          </div>
          {questionnaire.methodology_notes || 'Your questionnaire is ready for export. Test it with 2-3 respondents before full deployment to check timing and comprehension.'}
          {questionnaire.xlsform_notes && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #DBEAFE', fontSize: 12, color: '#6B7280' }}>
              📋 {questionnaire.xlsform_notes}
            </div>
          )}
        </div>

        {/* Export options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {EXPORT_OPTIONS.map(opt => (
            <motion.button
              key={opt.id}
              onClick={() => exportQuestionnaire(opt.id)}
              disabled={exporting === opt.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 12,
                border: '1px solid #E5E7EB', background: exporting === opt.id ? '#F9FAFB' : 'white',
                cursor: exporting === opt.id ? 'wait' : 'pointer', textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 24 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{opt.description}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: opt.color,
                  background: `${opt.color}15`, padding: '2px 8px', borderRadius: 20,
                }}>
                  {opt.format}
                </span>
                {exporting === opt.id ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 16, height: 16, border: '2px solid #E5E7EB', borderTopColor: BLUE, borderRadius: '50%' }}
                  />
                ) : (
                  <Download size={16} color="#9CA3AF" />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Save to project */}
        <motion.button
          onClick={handleSave}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            border: `2px solid ${saved ? GREEN : BLUE}`,
            background: saved ? GREEN : BLUE, color: 'white',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {saved ? '✓ Saved to project' : (
            <>
              <Save size={16} />
              Save to ResearchOS project
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
