import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare, Clock, Send } from 'lucide-react';

const BLUE = '#2463EB';

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
}

interface CollaborationPanelProps {
  questionnaireId?: string;
  currentUserId?: string;
}

const MOCK_COMMENTS: Comment[] = [
  { id: '1', user: 'Amara K.', avatar: 'A', text: 'Should we add a skip logic for Q4 if Q3 is answered negatively?', time: '2h ago' },
  { id: '2', user: 'Deo M.', avatar: 'D', text: 'Agreed — also the GPS question should be mandatory for field submissions.', time: '1h ago' },
];

const ONLINE_USERS = ['A', 'D', 'T'];

export default function CollaborationPanel({ questionnaireId, currentUserId }: CollaborationPanelProps) {
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [draft, setDraft] = useState('');

  if (!questionnaireId || !currentUserId) return null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setComments(prev => [...prev, {
      id: Date.now().toString(), user: 'You', avatar: 'Y', text, time: 'just now',
    }]);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} color={BLUE} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>Team</span>
        </div>
        <div style={{ display: 'flex', gap: -6 }}>
          {ONLINE_USERS.map((u, i) => (
            <div key={u} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
              display: 'grid', placeItems: 'center',
              fontSize: 9, fontWeight: 700, color: 'white',
              border: '2px solid white', marginLeft: i > 0 ? -6 : 0,
            }}>{u}</div>
          ))}
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: '#F1F5F9',
            display: 'grid', placeItems: 'center',
            fontSize: 8, fontWeight: 700, color: '#9CA3AF',
            border: '2px solid white', marginLeft: -6,
          }}>+2</div>
        </div>
      </div>

      {/* Comments */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comments.map(c => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: 8 }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
              display: 'grid', placeItems: 'center',
              fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{c.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{c.user}</span>
                <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>{c.time}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.55, background: '#F8FAFF', borderRadius: 8, padding: '7px 10px', border: '1px solid #E8EDF5' }}>
                {c.text}
              </div>
            </div>
          </motion.div>
        ))}
        {comments.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 24 }}>
            <MessageSquare size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: .4 }} />
            No comments yet
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Add a comment…"
          style={{
            flex: 1, border: '1px solid #E8EDF5', borderRadius: 8,
            padding: '7px 10px', fontSize: 12.5, fontFamily: 'Inter, sans-serif',
            outline: 'none', color: '#111827',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(36,99,235,.12)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E8EDF5'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          style={{
            width: 34, height: 34, borderRadius: 8, border: 'none',
            background: draft.trim() ? BLUE : '#E8EDF5',
            display: 'grid', placeItems: 'center', cursor: draft.trim() ? 'pointer' : 'default',
            transition: 'background .15s', flexShrink: 0,
          }}
        >
          <Send size={13} color={draft.trim() ? 'white' : '#9CA3AF'} />
        </button>
      </div>
    </div>
  );
}
