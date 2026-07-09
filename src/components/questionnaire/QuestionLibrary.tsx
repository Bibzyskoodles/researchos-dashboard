/**
 * QuestionLibrary.tsx
 *
 * Modal/sidebar component for browsing, searching, and adding questions to a questionnaire.
 * Design: Utilitarian interface with sidebar filters and scannable card layout.
 * Includes deduplication detection and drag-reorder functionality.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Question,
  QuestionCard,
  QuestionType,
  SearchFilters,
  DeduplicationWarning,
} from './types';

// ============================================================================
// STYLES
// ============================================================================

const STYLES = `
:root {
  --bg-surface: #F8F9FA;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --border: #E5E7EB;
  --accent: #0F766E;
  --accent-light: #F0FDFA;
  --warning: #D97706;
  --warning-light: #FEF3C7;
  --success: #10B981;
  --success-light: #ECFDF5;

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-surface: #111827;
    --text-primary: #F3F4F6;
    --text-secondary: #9CA3AF;
    --border: #374151;
    --accent: #14B8A6;
    --accent-light: #0F2F2E;
    --warning: #F59E0B;
    --warning-light: #332701;
    --success: #34D399;
    --success-light: #064E3B;
  }
}

:root[data-theme="light"] {
  --bg-surface: #F8F9FA;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --border: #E5E7EB;
  --accent: #0F766E;
  --accent-light: #F0FDFA;
  --warning: #D97706;
  --warning-light: #FEF3C7;
  --success: #10B981;
  --success-light: #ECFDF5;
}

:root[data-theme="dark"] {
  --bg-surface: #111827;
  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --border: #374151;
  --accent: #14B8A6;
  --accent-light: #0F2F2E;
  --warning: #F59E0B;
  --warning-light: #332701;
  --success: #34D399;
  --success-light: #064E3B;
}

* {
  box-sizing: border-box;
}

.library-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.library-container {
  display: flex;
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  background: var(--bg-surface);
  border-radius: 8px;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  margin: auto;
  overflow: hidden;
}

.library-sidebar {
  width: 280px;
  border-right: 1px solid var(--border);
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--bg-surface);
}

.library-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 16px;
}

/* Header */
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.library-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.3px;
}

.library-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.library-close-btn:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.library-close-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Search */
.search-container {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-surface);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  pointer-events: none;
}

/* Filter Sections */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.filter-checkbox input {
  accent-color: var(--accent);
  cursor: pointer;
}

.filter-checkbox label {
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  margin: 0;
}

/* Results Area */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.results-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 4px;
}

@media (max-width: 900px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
}

/* Question Card */
.question-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

.question-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.1);
}

.question-card:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.card-type-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  margin: 0;
  flex: 1;
  word-break: break-word;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-block;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 500;
}

.card-metadata {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stars {
  color: #FBBF24;
  letter-spacing: -2px;
}

.card-action {
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-primary:hover {
  background: #0B5F5A;
  border-color: #0B5F5A;
}

.btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-color: var(--border);
}

.btn-secondary:hover {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

.btn-secondary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 0.2s ease-out;
}

.modal-box {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90vw;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, calc(-50% + 20px));
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-alert {
  background: var(--warning-light);
  color: #92400E;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  padding: 40px 20px;
  text-align: center;
}

.empty-state-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-state-text {
  font-size: 14px;
  line-height: 1.6;
  max-width: 300px;
}

/* Loading */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: var(--text-secondary);
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    border-top-color: var(--text-secondary);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .library-container {
    width: 98vw;
    height: 90vh;
  }

  .library-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 16px;
    max-height: 200px;
    flex-direction: row;
    overflow-x: auto;
    gap: 16px;
  }

  .library-main {
    padding: 16px;
    gap: 12px;
  }

  .filter-section {
    flex-direction: row;
    gap: 8px;
  }

  .results-grid {
    grid-template-columns: 1fr;
  }
}
`;

// ============================================================================
// COMPONENTS
// ============================================================================

interface QuestionCardProps {
  card: QuestionCard;
  onAdd: (questionId: string) => void;
  onCreateVariant: (questionId: string) => void;
}

function QuestionCardComponent({ card, onAdd, onCreateVariant }: QuestionCardProps) {
  const typeIcons: Record<QuestionType, string> = {
    'multiple-choice': 'MC',
    text: 'T',
    scale: '★',
    ranking: '↕',
    matrix: '▦',
  };

  return (
    <div className="question-card">
      <div className="card-header">
        <div className="card-type-icon" title={card.type}>
          {typeIcons[card.type]}
        </div>
        <p className="card-title">{card.text}</p>
      </div>

      {card.tags.length > 0 && (
        <div className="card-tags">
          {card.tags.slice(0, 3).map(tag => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && <span className="tag-chip">+{card.tags.length - 3}</span>}
        </div>
      )}

      <div className="card-metadata">
        <div className="metadata-item">
          <span>Used in {card.usageCount}</span>
        </div>
        {card.rating > 0 && (
          <div className="metadata-item">
            <span className="stars">{'★'.repeat(Math.round(card.rating))}</span>
            <span>{card.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="card-action">
        <button
          className="btn btn-primary"
          onClick={() => onAdd(card.id)}
          aria-label={`Add "${card.text}" to questionnaire`}
        >
          Add
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onCreateVariant(card.id)}
          title="Create a variant of this question"
        >
          Variant
        </button>
      </div>
    </div>
  );
}

interface DeduplicationModalProps {
  warning: DeduplicationWarning;
  onReuse: () => void;
  onCreateVariant: () => void;
  onCancel: () => void;
}

function DeduplicationModal({
  warning,
  onReuse,
  onCreateVariant,
  onCancel,
}: DeduplicationModalProps) {
  const similarity = Math.round(warning.similarity * 100);

  return (
    <>
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal-box">
        <h2 className="modal-title">
          ⚠️ Possible Duplicate
        </h2>
        <div className="modal-alert">
          <strong>Similarity: {similarity}%</strong>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
            You already asked "{warning.existingQuestionText}" in Q{warning.existingQuestionPosition}.
          </p>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
          What would you like to do?
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={onReuse}>
            Reuse Existing
          </button>
          <button className="btn btn-primary" onClick={onCreateVariant}>
            Create Variant
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface QuestionLibraryProps {
  questionnaireId: string;
  onAddQuestion: (questionId: string, asVariant?: boolean) => Promise<void>;
  onClose: () => void;
  currentQuestions?: string[]; // IDs of questions already in questionnaire
}

export function QuestionLibrary({
  questionnaireId,
  onAddQuestion,
  onClose,
  currentQuestions = [],
}: QuestionLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all');
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deduplicationWarning, setDeduplicationWarning] = useState<DeduplicationWarning | null>(null);
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);
  const [pendingAsVariant, setPendingAsVariant] = useState(false);

  const availableTags = ['health', 'demographics', 'income', 'product', 'brand'];
  const questionTypes: (QuestionType | 'all')[] = ['all', 'multiple-choice', 'text', 'scale', 'ranking', 'matrix'];

  // Fetch questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (selectedTags.length) params.append('tags', selectedTags.join(','));
        if (selectedType !== 'all') params.append('type', selectedType);

        const response = await fetch(`/api/questions?${params}`);
        const data = await response.json();
        setQuestions(
          data.questions.map((q: any) => ({
            ...q,
            isUsedInThisQuestionnaire: currentQuestions.includes(q.id),
          }))
        );
      } catch (error) {
        console.error('Failed to fetch questions:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedTags, selectedType, currentQuestions]);

  const handleAddQuestion = useCallback(async (questionId: string, asVariant = false) => {
    setPendingQuestionId(questionId);
    setPendingAsVariant(asVariant);

    if (!asVariant) {
      try {
        const response = await fetch(
          `/api/questions/${questionId}/add-to-questionnaire`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionnaireId, asVariant: false }),
          }
        );

        if (response.status === 409) {
          const data = await response.json();
          setDeduplicationWarning(data.warning);
          return;
        }

        if (response.ok) {
          await onAddQuestion(questionId, false);
          setPendingQuestionId(null);
        }
      } catch (error) {
        console.error('Failed to add question:', error);
        setPendingQuestionId(null);
      }
    } else {
      await onAddQuestion(questionId, true);
      setPendingQuestionId(null);
    }
  }, [questionnaireId, onAddQuestion]);

  const handleConfirmVariant = useCallback(async () => {
    if (pendingQuestionId) {
      await handleAddQuestion(pendingQuestionId, true);
      setDeduplicationWarning(null);
    }
  }, [pendingQuestionId, handleAddQuestion]);

  const handleReusExisting = useCallback(() => {
    setDeduplicationWarning(null);
    onClose();
  }, [onClose]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredQuestions = useMemo(
    () => questions.filter(q => !q.isUsedInThisQuestionnaire),
    [questions]
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className="library-modal" onClick={e => e.currentTarget === e.target && onClose()}>
        <div className="library-container">
          {/* Sidebar */}
          <div className="library-sidebar">
            <div className="library-header">
              <h1>Question Library</h1>
              <button className="library-close-btn" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="search-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Tags Filter */}
            <div className="filter-section">
              <label className="filter-label">Tags</label>
              <div className="filter-options">
                {availableTags.map(tag => (
                  <label key={tag} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div className="filter-section">
              <label className="filter-label">Type</label>
              <div className="filter-options">
                {questionTypes.map(type => (
                  <label key={type} className="filter-checkbox">
                    <input
                      type="radio"
                      name="question-type"
                      checked={selectedType === type}
                      onChange={() => setSelectedType(type)}
                    />
                    <span>{type === 'all' ? 'All types' : type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="library-main">
            <div className="results-header">
              <span>{questions.length} questions available</span>
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-text">
                  {questions.length === 0 ? 'No questions found' : 'All available questions are already in this questionnaire'}
                </div>
              </div>
            ) : (
              <div className="results-grid">
                {filteredQuestions.map(card => (
                  <QuestionCardComponent
                    key={card.id}
                    card={card}
                    onAdd={questionId => handleAddQuestion(questionId, false)}
                    onCreateVariant={questionId => handleAddQuestion(questionId, true)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deduplication Warning Modal */}
      {deduplicationWarning && (
        <DeduplicationModal
          warning={deduplicationWarning}
          onReuse={handleReusExisting}
          onCreateVariant={handleConfirmVariant}
          onCancel={() => {
            setDeduplicationWarning(null);
            setPendingQuestionId(null);
          }}
        />
      )}
    </>
  );
}

export default QuestionLibrary;
