import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Question, QuestionType, QualityIssue } from './types';

interface Props {
  question: Question;
  index: number;
  sectionTitle: string;
  qualityIssues: QualityIssue[];
  isSelected: boolean;
  onUpdate: (updated: Question) => void;
  onDelete: () => void;
  onAskAda: (question: Question) => void;
  onSelect: () => void;
}

const BLUE = '#2463EB';
const AMBER = '#D97706';
const RED = '#DC2626';
const GREEN = '#059669';

const QUESTION_TYPES: Array<{ type: QuestionType; icon: string; label: string }> = [
  { type: 'open',         icon: '📝', label: 'Open text' },
  { type: 'select',       icon: '☑',  label: 'Single select' },
  { type: 'multi_select', icon: '☑☑', label: 'Multi select' },
  { type: 'scale',        icon: '⭐', label: 'Scale' },
  { type: 'number',       icon: '🔢', label: 'Number' },
  { type: 'date',         icon: '📅', label: 'Date' },
  { type: 'audio',        icon: '🎤', label: 'Audio' },
  { type: 'image',        icon: '📷', label: 'Photo' },
  { type: 'gps',          icon: '📍', label: 'GPS' },
  { type: 'matrix',       icon: '📊', label: 'Matrix' },
  { type: 'ranking',      icon: '🏆', label: 'Ranking' },
];

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #E5E7EB', fontSize: 13, color: '#111827',
  fontFamily: 'Inter, sans-serif', outline: 'none',
  background: 'white', boxSizing: 'border-box',
};

export default function QuestionCard({
  question, index, qualityIssues, isSelected,
  onUpdate, onDelete, onAskAda, onSelect,
}: Props) {
  const [showInstruction, setShowInstruction] = useState(!!question.interviewer_instruction);
  const [showSkipLogic, setShowSkipLogic] = useState(!!question.skip_logic);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useCallback((patch: Partial<Question>) => {
    onUpdate({ ...question, ...patch });
  }, [question, onUpdate]);

  const addOption = () => {
    const options = [...(question.options || []), ''];
    update({ options });
  };

  const updateOption = (idx: number, value: string) => {
    const options = [...(question.options || [])];
    options[idx] = value;
    update({ options });
  };

  const removeOption = (idx: number) => {
    const options = (question.options || []).filter((_, i) => i !== idx);
    update({ options });
  };

  const needsOptions = ['select', 'multi_select', 'ranking'].includes(question.type);
  const isScale = question.type === 'scale';
  const isMatrix = question.type === 'matrix';

  const hasCritical = qualityIssues.some(i => i.type === 'leading_question' || i.type === 'double_barrelled');
  const borderColor = hasCritical ? RED : qualityIssues.length > 0 ? AMBER : '#E5E7EB';

  return (
    <motion.div
      onClick={onSelect}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'white', borderRadius: 12,
        border: `1px solid ${isSelected ? BLUE : borderColor}`,
        borderLeft: `4px solid ${isSelected ? BLUE : borderColor}`,
        boxShadow: isSelected ? `0 0 0 3px ${BLUE}22` : '0 1px 4px rgba(0,0,0,0.06)',
        padding: 20, cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: isSelected ? BLUE : '#9CA3AF',
          minWidth: 28, paddingTop: 2,
        }}>
          Q{index + 1}
        </span>

        <textarea
          value={question.text}
          onChange={e => update({ text: e.target.value })}
          onClick={e => e.stopPropagation()}
          placeholder="Question text as the interviewer will read it..."
          rows={2}
          style={{
            ...INPUT, resize: 'none', flex: 1,
            fontSize: 14, fontWeight: 500, lineHeight: 1.5,
            border: '1px solid transparent',
            background: 'transparent', padding: '0',
          }}
        />

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onAskAda(question); }}
            title="Ask Ada about this question"
            style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${BLUE}`,
              background: 'white', color: BLUE, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Sparkles size={12} />
            Ada
          </button>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); onDelete(); }}
                style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: RED, color: 'white', cursor: 'pointer', fontSize: 12 }}>
                Delete
              </button>
              <button onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#9CA3AF' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Question type selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {QUESTION_TYPES.map(t => (
          <button
            key={t.type}
            onClick={e => { e.stopPropagation(); update({ type: t.type }); }}
            title={t.label}
            style={{
              padding: '5px 10px', borderRadius: 20,
              border: `1px solid ${question.type === t.type ? BLUE : '#E5E7EB'}`,
              background: question.type === t.type ? '#EEF2FF' : 'white',
              color: question.type === t.type ? BLUE : '#6B7280',
              cursor: 'pointer', fontSize: 12, fontWeight: question.type === t.type ? 600 : 400,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Options for select types */}
      {needsOptions && (
        <div style={{ marginBottom: 12 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Options
          </div>
          {(question.options || []).map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 20 }}>{idx + 1}.</span>
              <input
                value={opt}
                onChange={e => updateOption(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                style={{ ...INPUT, flex: 1 }}
              />
              <button onClick={() => removeOption(idx)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                ✕
              </button>
            </div>
          ))}
          <button onClick={addOption}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: BLUE, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 0' }}>
            <Plus size={12} /> Add option
          </button>
        </div>
      )}

      {/* Scale config */}
      {isScale && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Min</label>
            <input type="number" value={question.scale_min ?? 1} onChange={e => update({ scale_min: Number(e.target.value) })}
              style={{ ...INPUT, width: 70 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Max</label>
            <input type="number" value={question.scale_max ?? 5} onChange={e => update({ scale_max: Number(e.target.value) })}
              style={{ ...INPUT, width: 70 }} />
          </div>
        </div>
      )}

      {/* Matrix rows/cols */}
      {isMatrix && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Rows</div>
            {(question.matrix_rows || ['']).map((row, i) => (
              <input key={i} value={row} onChange={e => {
                const rows = [...(question.matrix_rows || [''])];
                rows[i] = e.target.value;
                update({ matrix_rows: rows });
              }} style={{ ...INPUT, marginBottom: 4 }} placeholder={`Row ${i + 1}`} />
            ))}
            <button onClick={() => update({ matrix_rows: [...(question.matrix_rows || ['']), ''] })}
              style={{ fontSize: 12, color: BLUE, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
              + Add row
            </button>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Columns</div>
            {(question.matrix_columns || ['']).map((col, i) => (
              <input key={i} value={col} onChange={e => {
                const cols = [...(question.matrix_columns || [''])];
                cols[i] = e.target.value;
                update({ matrix_columns: cols });
              }} style={{ ...INPUT, marginBottom: 4 }} placeholder={`Column ${i + 1}`} />
            ))}
            <button onClick={() => update({ matrix_columns: [...(question.matrix_columns || ['']), ''] })}
              style={{ fontSize: 12, color: BLUE, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
              + Add column
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {/* Required toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <div
            onClick={() => update({ required: !question.required })}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: question.required ? BLUE : '#E5E7EB',
              position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: question.required ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Required</span>
        </label>

        {/* Interviewer note */}
        <button
          onClick={() => setShowInstruction(!showInstruction)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'Inter, sans-serif' }}
        >
          {showInstruction ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Interviewer note
        </button>

        {/* Skip logic */}
        <button
          onClick={() => setShowSkipLogic(!showSkipLogic)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'Inter, sans-serif' }}
        >
          {showSkipLogic ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Skip logic
        </button>
      </div>

      {showInstruction && (
        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <input
            value={question.interviewer_instruction || ''}
            onChange={e => update({ interviewer_instruction: e.target.value })}
            placeholder="Note shown to the interviewer below this question..."
            style={{ ...INPUT, fontSize: 13, color: '#6B7280' }}
          />
        </div>
      )}

      {showSkipLogic && (
        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <input
            value={question.skip_logic || ''}
            onChange={e => update({ skip_logic: e.target.value })}
            placeholder='e.g. "Show only if Q3 = Yes"'
            style={{ ...INPUT, fontSize: 13, color: '#6B7280' }}
          />
        </div>
      )}

      {/* Quality issues */}
      {qualityIssues.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {qualityIssues.map((issue, i) => (
            <div key={i} style={{
              padding: '8px 12px', borderRadius: 8,
              background: hasCritical ? '#FEF2F2' : '#FFFBEB',
              borderLeft: `3px solid ${hasCritical ? RED : AMBER}`,
              fontSize: 12, color: hasCritical ? '#991B1B' : '#92400E',
            }}>
              <span style={{ fontWeight: 600 }}>⚠ {issue.type.replace(/_/g, ' ')}: </span>
              {issue.issue}
              {issue.suggestion && (
                <span style={{ color: GREEN }}> — {issue.suggestion}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
