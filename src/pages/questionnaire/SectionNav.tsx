import React from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Section, QualityIssue } from './types';

interface Props {
  sections: Section[];
  selectedQuestionId: string | null;
  selectedSectionId: string | null;
  qualityIssues: QualityIssue[];
  onSelectQuestion: (questionId: string, sectionId: string) => void;
  onAddSection: () => void;
}

const BLUE = '#2463EB';
const AMBER = '#D97706';
const GREEN = '#059669';
const RED = '#DC2626';

export default function SectionNav({
  sections, selectedQuestionId, selectedSectionId,
  qualityIssues, onSelectQuestion, onAddSection,
}: Props) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const issueMap = React.useMemo(() => {
    const map: Record<string, QualityIssue[]> = {};
    qualityIssues.forEach(issue => {
      if (!map[issue.question_id]) map[issue.question_id] = [];
      map[issue.question_id].push(issue);
    });
    return map;
  }, [qualityIssues]);

  const toggleSection = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalIssues = qualityIssues.length;
  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);
  const cleanCount = totalQuestions - Object.keys(issueMap).length;

  return (
    <div style={{
      width: 220, background: '#F8FAFC', borderRight: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {sections.map(section => {
          const isCollapsed = collapsed.has(section.id);
          const sectionIssues = section.questions.reduce((count, q) => count + (issueMap[q.id]?.length || 0), 0);

          return (
            <div key={section.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleSection(section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  color: selectedSectionId === section.id ? BLUE : '#374151',
                }}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
                  {section.title}
                </span>
                {sectionIssues > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: AMBER,
                    background: '#FEF3C7', padding: '1px 5px', borderRadius: 8,
                  }}>
                    {sectionIssues}
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <div>
                  {section.questions.map((q, idx) => {
                    const issues = issueMap[q.id] || [];
                    const isSelected = selectedQuestionId === q.id;
                    const hasCritical = issues.some(i => i.type === 'leading_question' || i.type === 'double_barrelled');

                    return (
                      <motion.button
                        key={q.id}
                        onClick={() => onSelectQuestion(q.id, section.id)}
                        whileHover={{ backgroundColor: isSelected ? undefined : '#F0F4FF' }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 16px 6px 36px', border: 'none',
                          background: isSelected ? '#EEF2FF' : 'transparent',
                          cursor: 'pointer', textAlign: 'left',
                          borderLeft: isSelected ? `2px solid ${BLUE}` : '2px solid transparent',
                        }}
                      >
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: isSelected ? BLUE : '#9CA3AF',
                          minWidth: 20,
                        }}>
                          Q{idx + 1}
                        </span>
                        <span style={{
                          fontSize: 11.5, color: isSelected ? '#1E40AF' : '#374151',
                          flex: 1, lineHeight: 1.3, overflow: 'hidden',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {q.text || 'Untitled question'}
                        </span>
                        {issues.length > 0 ? (
                          hasCritical ? <XCircle size={12} color={RED} /> : <AlertTriangle size={12} color={AMBER} />
                        ) : (
                          <CheckCircle size={12} color={GREEN} style={{ opacity: 0.5 }} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddSection}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', border: 'none', background: 'transparent',
            cursor: 'pointer', color: BLUE, fontSize: 12, fontWeight: 600,
            width: '100%', textAlign: 'left', marginTop: 8,
          }}
        >
          <Plus size={14} />
          Add Section
        </button>
      </div>

      {/* Quality summary */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #E5E7EB',
        background: 'white',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Quality
        </div>
        {totalIssues > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={12} color={AMBER} />
            <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>{totalIssues} issue{totalIssues !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={12} color={GREEN} />
          <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{cleanCount} clean</span>
        </div>
      </div>
    </div>
  );
}
