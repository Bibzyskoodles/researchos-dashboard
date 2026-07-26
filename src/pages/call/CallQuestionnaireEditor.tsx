/**
 * Question editor for call-mode projects — the no-spreadsheet path.
 * Lives on the Design stage: type questions, pick an answer style, save.
 * Writes CallScore's questionnaire (the same list the enumerator app,
 * the laptop capture flow, and the compliance/extraction agents read).
 * XLSForm upload remains available for teams that already have forms.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';
import { COLORS } from '../../styles/tokens';

interface EditableQ {
  question_key?: string;
  question_text: string;
  question_type: 'text' | 'numeric' | 'select_one' | 'select_multiple';
  is_required: boolean;
  choicesText: string; // comma-separated labels, e.g. "Yes, No, Not sure"
}

const TYPE_LABELS: { id: EditableQ['question_type']; label: string }[] = [
  { id: 'text', label: 'Their own words' },
  { id: 'numeric', label: 'A number' },
  { id: 'select_one', label: 'Pick one option' },
  { id: 'select_multiple', label: 'Pick several options' },
];

const inputStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 10px',
  border: `1px solid ${COLORS.line}`, borderRadius: 8, background: 'white',
  color: COLORS.ink, boxSizing: 'border-box',
};

function toChoices(text: string) {
  const labels = text.split(',').map((s) => s.trim()).filter(Boolean);
  return labels.length
    ? labels.map((label, i) => ({ name: label.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `opt${i + 1}`, label }))
    : null;
}

function serverItemsToEditable(items: any[]): EditableQ[] {
  return (items || []).map((i: any): EditableQ => ({
    question_key: i.question_key,
    question_text: i.question_text,
    question_type: i.question_type || 'text',
    is_required: i.is_required !== false,
    choicesText: (i.choices || []).map((c: any) => c.label).join(', '),
  }));
}

export default function CallQuestionnaireEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [items, setItems] = useState<EditableQ[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    callScoreApi.getQuestionnaire(projectId)
      .then((res) => setItems(serverItemsToEditable(res.data.items)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const askAda = () => {
    if (!projectId || !brief.trim()) return;
    setDrafting(true);
    setStatus(null);
    callScoreApi.draftQuestionnaire(projectId, brief.trim())
      .then((res) => {
        setItems(serverItemsToEditable(res.data.items));
        setStatus({ ok: true, text: `Ada drafted ${res.data.items.length} questions — review them, adjust anything, then press Save.` });
      })
      .catch((e) => setStatus({
        ok: false,
        text: e?.response?.data?.detail || 'Ada could not draft — try describing the study with a bit more detail.',
      }))
      .finally(() => setDrafting(false));
  };

  const onFilePicked = (file: File | null) => {
    if (!projectId || !file) return;
    setParsingFile(true);
    setStatus(null);
    callScoreApi.parseQuestionnaireFile(projectId, file)
      .then((res) => {
        setItems(serverItemsToEditable(res.data.items));
        setStatus({
          ok: true,
          text: res.data.source === 'xlsform'
            ? `Recognised a standard form — ${res.data.items.length} questions loaded. Review and Save.`
            : `Ada read ${res.data.items.length} questions from your file — review them, then press Save.`,
        });
      })
      .catch((e) => setStatus({
        ok: false,
        text: e?.response?.data?.detail || 'Could not read that file — try Excel or CSV.',
      }))
      .finally(() => setParsingFile(false));
  };

  const update = (idx: number, patch: Partial<EditableQ>) =>
    setItems((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const addQuestion = () =>
    setItems((prev) => [...prev, { question_text: '', question_type: 'text', is_required: true, choicesText: '' }]);

  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const save = () => {
    if (!projectId) return;
    const cleaned = items.filter((q) => q.question_text.trim());
    if (cleaned.length === 0) {
      setStatus({ ok: false, text: 'Add at least one question before saving.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    callScoreApi.setQuestionnaire(projectId, cleaned.map((q) => ({
      question_key: q.question_key,
      question_text: q.question_text.trim(),
      question_type: q.question_type,
      is_required: q.is_required,
      choices: q.question_type === 'select_one' || q.question_type === 'select_multiple'
        ? toChoices(q.choicesText) : null,
    })))
      .then(() => setStatus({ ok: true, text: 'Saved — these questions now appear in every call interview.' }))
      .catch(() => setStatus({ ok: false, text: 'Could not save — check your connection and try again.' }))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '16px 18px', marginBottom: 18, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>📋 Interview questions</div>
      <p style={{ fontSize: 12.5, color: '#6B7280', margin: '4px 0 14px' }}>
        These are the questions your interviewers ask on every call. The AI uses this same list to
        check that every question was actually asked, and to fill in answers it hears.
      </p>

      {/* Three ways in: Ada drafts it, upload a file, or type below. */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={{
          flex: 2, minWidth: 260, background: 'linear-gradient(135deg,#F5F8FF 0%,#F8F7FF 100%)',
          border: '1px solid #E3EAFB', borderRadius: 10, padding: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', marginBottom: 6 }}>
            ✨ Ask Ada to draft it
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={'Describe the study in your own words — e.g. "Phone survey of small shop owners in Lagos about how they choose which soft drinks to stock, about 10 minutes."'}
            style={{ ...inputStyle, width: '100%', minHeight: 56, resize: 'vertical', lineHeight: 1.5 }}
          />
          <button
            onClick={askAda}
            disabled={drafting || !brief.trim()}
            style={{
              marginTop: 8, fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 600,
              background: drafting || !brief.trim() ? '#93B4F5' : COLORS.blue, color: 'white',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              cursor: drafting || !brief.trim() ? 'default' : 'pointer',
            }}
          >
            {drafting ? 'Ada is drafting…' : 'Draft questions'}
          </button>
        </div>
        <label style={{
          flex: 1, minWidth: 200, background: '#FAFBFE', border: '1px dashed #C7D4EC',
          borderRadius: 10, padding: 12, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>
            📄 Upload a file
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.45 }}>
            {parsingFile
              ? 'Reading your file…'
              : 'Excel or CSV — any layout. Ada finds the questions and lays them out below.'}
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,.txt"
            style={{ display: 'none' }}
            disabled={parsingFile}
            onChange={(e) => { onFilePicked(e.target.files?.[0] || null); e.target.value = ''; }}
          />
        </label>
      </div>

      {!loaded && <p style={{ fontSize: 13, color: '#6B7280' }}>Loading…</p>}

      {loaded && items.map((q, idx) => {
        const needsChoices = q.question_type === 'select_one' || q.question_type === 'select_multiple';
        return (
          <div key={idx} style={{ border: '1px solid #EEF2F9', background: '#FAFBFE', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, width: 22 }}>{idx + 1}.</span>
              <input
                value={q.question_text}
                onChange={(e) => update(idx, { question_text: e.target.value })}
                placeholder="Type the question exactly as it should be asked"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => move(idx, -1)} title="Move up" style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.muted, fontSize: 14 }}>↑</button>
              <button onClick={() => move(idx, 1)} title="Move down" style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.muted, fontSize: 14 }}>↓</button>
              <button onClick={() => remove(idx)} title="Remove question" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 30 }}>
              <select
                value={q.question_type}
                onChange={(e) => update(idx, { question_type: e.target.value as EditableQ['question_type'] })}
                style={{ ...inputStyle, width: 170 }}
              >
                {TYPE_LABELS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <label style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={q.is_required}
                  onChange={(e) => update(idx, { is_required: e.target.checked })}
                />
                Must be asked
              </label>
              {needsChoices && (
                <input
                  value={q.choicesText}
                  onChange={(e) => update(idx, { choicesText: e.target.value })}
                  placeholder="Options, separated by commas — e.g. Yes, No, Not sure"
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                />
              )}
            </div>
          </div>
        );
      })}

      {loaded && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <button
            onClick={addQuestion}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
              borderRadius: 8, padding: '9px 16px',
            }}
          >
            ＋ Add a question
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
              background: saving ? '#93B4F5' : COLORS.blue, color: 'white', border: 'none',
              borderRadius: 8, padding: '9px 18px', cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save questions'}
          </button>
          {status && (
            <span style={{ fontSize: 12.5, color: status.ok ? COLORS.green : '#B91C1C' }}>{status.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
