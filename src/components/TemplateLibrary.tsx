import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, TrendingUp, Clock, Eye, Copy, X, Filter } from "lucide-react";
import api from "../services/api";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", PURPLE = "#7C3AED";

interface Question {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  hint?: string;
  validation?: string;
}

interface Section {
  title: string;
  questions: Question[];
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  total_ratings: number;
  use_count: number;
  average_completion_time: string;
  preview_sections: Section[];
  total_questions: number;
}

interface TemplateDetail extends Template {
  suggested_respondent_flow: string;
  created_at: string;
  sections: Section[];
}

const CARD_STYLE: React.CSSProperties = {
  background: "white",
  borderRadius: 12,
  border: "1px solid #E8EDF5",
  boxShadow: "0 2px 8px rgba(10,15,28,.05)"
};

const CATEGORIES = [
  "Health",
  "Finance",
  "FMCG Market Research",
  "NGO",
  "Education"
];

const SORT_OPTIONS = [
  { value: "most-used", label: "Most Used" },
  { value: "rating", label: "Highest Rated" },
  { value: "recency", label: "Newest" }
];

export default function TemplateLibrary({ onTemplateClone }: { onTemplateClone?: (questionnaire: any) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("most-used");
  const [showPreview, setShowPreview] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [selectedCategory, searchTerm, sortBy]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (searchTerm) params.append("search", searchTerm);
      params.append("sort", sortBy);

      const res = await api.get(`/api/templates?${params.toString()}`);
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId: string) => {
    try {
      const res = await api.get(`/api/templates/${templateId}`);
      setSelectedTemplate(res.data);
      setShowPreview(true);
      setRatingSubmitted(false);
      setUserRating(0);
    } catch (err) {
      console.error("Failed to load template details:", err);
    }
  };

  const handleCloneTemplate = async () => {
    if (!selectedTemplate) return;
    setCloning(true);
    try {
      const res = await api.post(`/api/questionnaires/from-template/${selectedTemplate.id}`);
      if (onTemplateClone) {
        onTemplateClone(res.data.questionnaire);
      }
      setShowPreview(false);
      setSelectedTemplate(null);
    } catch (err) {
      console.error("Failed to clone template:", err);
    } finally {
      setCloning(false);
    }
  };

  const handleSubmitRating = async (rating: number) => {
    if (!selectedTemplate) return;
    try {
      const res = await api.post(`/api/templates/${selectedTemplate.id}/rate`, { rating });
      setUserRating(rating);
      setRatingSubmitted(true);
      setSelectedTemplate({
        ...selectedTemplate,
        rating: res.data.new_average_rating,
        total_ratings: res.data.total_ratings
      });
      setTimeout(() => setRatingSubmitted(false), 2000);
    } catch (err) {
      console.error("Failed to submit rating:", err);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [templates, selectedCategory, searchTerm]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: "0 auto", marginBottom: 40 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
            Questionnaire Templates
          </h1>
          <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 600 }}>
            Choose from pre-built templates across Health, Finance, FMCG, NGO, and Education.
            Edit and customize before use.
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 32,
            flexWrap: "wrap",
            alignItems: "center"
          }}
        >
          {/* Search */}
          <div style={{ flex: 1, minWidth: 250, position: "relative" }}>
            <Search size={18} style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9CA3AF"
            }} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 40px",
                borderRadius: 8,
                border: `1px solid #E2E8F0`,
                fontSize: 13,
                fontFamily: "Inter,sans-serif",
                outline: "none"
              }}
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid #E2E8F0`,
              fontSize: 13,
              fontFamily: "Inter,sans-serif",
              background: "white",
              outline: "none",
              minWidth: 150
            }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid #E2E8F0`,
              fontSize: 13,
              fontFamily: "Inter,sans-serif",
              background: "white",
              outline: "none",
              minWidth: 150
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </motion.div>

        {/* Templates Grid */}
        <motion.div
          layout
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 40
          }}
        >
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#6B7280" }}>Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#6B7280" }}>No templates found. Try adjusting your filters.</p>
              </div>
            ) : (
              filteredTemplates.map((template, idx) => (
                <motion.div
                  key={template.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => loadTemplateDetail(template.id)}
                  style={{
                    ...CARD_STYLE,
                    cursor: "pointer",
                    padding: 20,
                    transition: "all 0.2s ease",
                    ":hover": {
                      boxShadow: "0 8px 16px rgba(10,15,28,.1)",
                      transform: "translateY(-2px)"
                    }
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(10,15,28,.1)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(10,15,28,.05)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  {/* Category Badge */}
                  <div style={{
                    display: "inline-block",
                    background: `${BLUE}15`,
                    color: BLUE,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 12
                  }}>
                    {template.category}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: 8
                  }}>
                    {template.name}
                  </h3>

                  {/* Description */}
                  <p style={{
                    fontSize: 13,
                    color: "#6B7280",
                    marginBottom: 16,
                    lineHeight: "1.5"
                  }}>
                    {template.description}
                  </p>

                  {/* Preview */}
                  <div style={{
                    background: "#F3F4F6",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    fontSize: 12,
                    color: "#4B5563"
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview:</div>
                    {template.preview_sections.slice(0, 1).map(section => (
                      <div key={section.title}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{section.title}</div>
                        {section.questions.slice(0, 3).map(q => (
                          <div key={q.id} style={{ fontSize: 11, marginLeft: 8, marginBottom: 4 }}>
                            • {q.text.substring(0, 50)}...
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div style={{
                    display: "flex",
                    gap: 16,
                    fontSize: 12,
                    color: "#6B7280",
                    marginBottom: 16,
                    flexWrap: "wrap"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Star size={14} fill={AMBER} color={AMBER} />
                      {template.rating.toFixed(1)} ({template.total_ratings})
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={14} color={GREEN} />
                      {template.use_count} uses
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={14} color={BLUE} />
                      {template.average_completion_time}
                    </div>
                  </div>

                  {/* Use Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadTemplateDetail(template.id);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: BLUE,
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#1D5AA0";
                      (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = BLUE;
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    }}
                  >
                    Use this template
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && selectedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              padding: 20
            }}
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...CARD_STYLE,
                width: "100%",
                maxWidth: 700,
                maxHeight: "90vh",
                overflowY: "auto",
                padding: 32,
                position: "relative"
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: 4
                }}
              >
                <X size={20} />
              </button>

              {/* Template Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: "inline-block",
                  background: `${BLUE}15`,
                  color: BLUE,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 12
                }}>
                  {selectedTemplate.category}
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  {selectedTemplate.name}
                </h2>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: "1.6" }}>
                  {selectedTemplate.description}
                </p>
              </div>

              {/* Stats */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
                marginBottom: 24,
                padding: "16px",
                background: "#F9FAFB",
                borderRadius: 8
              }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Rating</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: AMBER }}>
                    {selectedTemplate.rating.toFixed(1)} ★ ({selectedTemplate.total_ratings})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Completion Time</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {selectedTemplate.average_completion_time}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Times Used</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>
                    {selectedTemplate.use_count}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Questions</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {selectedTemplate.sections.reduce((s, sec) => s + sec.questions.length, 0)}
                  </div>
                </div>
              </div>

              {/* Respondent Flow */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 8 }}>
                  Suggested Respondent Flow
                </h4>
                <p style={{ fontSize: 13, color: "#374151" }}>
                  {selectedTemplate.suggested_respondent_flow}
                </p>
              </div>

              {/* Preview Sections */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>
                  Template Structure
                </h4>
                {selectedTemplate.sections.map((section, sIdx) => (
                  <div key={sIdx} style={{ marginBottom: 16 }}>
                    <h5 style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
                      {section.title}
                    </h5>
                    <ul style={{ marginLeft: 16, color: "#6B7280", fontSize: 12 }}>
                      {section.questions.map(q => (
                        <li key={q.id} style={{ marginBottom: 4 }}>
                          {q.text} <span style={{ color: "#9CA3AF" }}>({q.type})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Rating */}
              {!ratingSubmitted && (
                <div style={{ marginBottom: 24, padding: "16px", background: "#F9FAFB", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
                    Rate this template
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button
                        key={rating}
                        onClick={() => handleSubmitRating(rating)}
                        onMouseEnter={() => setHoveredRating(rating)}
                        onMouseLeave={() => setHoveredRating(0)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 24,
                          opacity: hoveredRating >= rating || userRating >= rating ? 1 : 0.3,
                          transition: "opacity 0.2s"
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ratingSubmitted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    marginBottom: 24,
                    padding: "12px 16px",
                    background: `${GREEN}15`,
                    color: GREEN,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Thank you for rating!
                </motion.div>
              )}

              {/* Clone Button */}
              <button
                onClick={handleCloneTemplate}
                disabled={cloning}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: BLUE,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: cloning ? "not-allowed" : "pointer",
                  opacity: cloning ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <Copy size={16} />
                {cloning ? "Cloning..." : "Use this template"}
              </button>

              <p style={{
                fontSize: 12,
                color: "#6B7280",
                marginTop: 12,
                textAlign: "center"
              }}>
                Customize these {selectedTemplate.sections.reduce((s, sec) => s + sec.questions.length, 0)} questions for your research
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
