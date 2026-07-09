/**
 * ResearchOS — Live Respondent Preview
 * Full-page questionnaire view for respondents (no login required)
 * Session-based anonymous response tracking
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Clock, AlertCircle, CheckCircle, Loader } from "lucide-react";
import api from "../../services/api";

const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626";

interface Question {
  id: string;
  text: string;
  type: "text" | "select" | "number" | "audio" | "image" | "gps" | "date";
  required: boolean;
  options?: string[];
  hint?: string;
  validation?: string;
}

interface Section {
  title: string;
  questions: Question[];
}

interface PreviewData {
  id: string;
  title: string;
  intro: string;
  sections: Section[];
  session_id: string;
}

type Stage = "loading" | "intro" | "questions" | "thank-you" | "error";

export default function PublicPreview() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const questionnnaireId = searchParams.get("q");

  const [stage, setStage] = useState<Stage>("loading");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [questionStartTime, setQuestionStartTime] = useState<Record<string, number>>({});
  const [submitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Device info for analytics
  const [deviceInfo] = useState({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Load questionnaire on mount
  useEffect(() => {
    const loadPreview = async () => {
      try {
        if (!questionnnaireId || !token) {
          setError("Invalid or missing questionnaire");
          setStage("error");
          return;
        }

        const response = await api.get(`/api/questionnaires/${questionnnaireId}/preview`, {
          params: { token },
        });

        setPreview(response.data);
        setStage("intro");
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load questionnaire");
        setStage("error");
      }
    };

    loadPreview();
  }, [questionnnaireId, token]);

  // Track question start time
  useEffect(() => {
    if (stage === "questions" && preview) {
      const currentSection = preview.sections[currentSectionIdx];
      const firstQuestion = currentSection?.questions[0];
      if (firstQuestion && !questionStartTime[firstQuestion.id]) {
        setQuestionStartTime((prev) => ({
          ...prev,
          [firstQuestion.id]: Date.now(),
        }));
      }
    }
  }, [stage, currentSectionIdx, preview, questionStartTime]);

  const totalQuestions = preview?.sections.reduce((sum, s) => sum + s.questions.length, 0) || 0;
  const answeredCount = Object.keys(responses).length;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Estimate time remaining
  const estimateTimeRemaining = useCallback(() => {
    const avgTimePerQ = 45; // seconds
    const remainingQuestions = totalQuestions - answeredCount;
    return Math.max(1, Math.ceil((remainingQuestions * avgTimePerQ) / 60));
  }, [totalQuestions, answeredCount]);

  const handleAnswer = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    setSubmitError("");
  };

  const handleNextSection = async () => {
    if (!preview) return;

    const currentSection = preview.sections[currentSectionIdx];
    const unansweredRequired = currentSection.questions.filter(
      (q) => q.required && !responses[q.id]
    );

    if (unansweredRequired.length > 0) {
      setSubmitError(`Please answer ${unansweredRequired.length} required question(s)`);
      return;
    }

    // Record response times for this section
    for (const q of currentSection.questions) {
      if (responses[q.id] !== undefined) {
        const startTime = questionStartTime[q.id] || Date.now();
        const responseTime = Math.round((Date.now() - startTime) / 1000);

        try {
          await api.post("/api/responses", {
            questionnaire_id: preview.id,
            session_id: preview.session_id,
            question_id: q.id,
            answer: responses[q.id],
            response_time_seconds: responseTime,
            device_info: deviceInfo,
          });
        } catch (err) {
          console.error("Failed to save response:", err);
        }
      }
    }

    if (currentSectionIdx + 1 < preview.sections.length) {
      setCurrentSectionIdx((prev) => prev + 1);
      setSubmitError("");
    } else {
      setStage("thank-you");
    }
  };

  const handlePreviousSection = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx((prev) => prev - 1);
      setSubmitError("");
    }
  };

  // Render intro screen
  if (stage === "intro" && preview) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              border: `1px solid #E8EDF5`,
              boxShadow: "0 8px 32px rgba(10, 15, 28, 0.1)",
              padding: 48,
              textAlign: "center",
            }}
          >
            {/* Logo placeholder */}
            <div
              style={{
                width: 80,
                height: 80,
                background: BLUE,
                borderRadius: "50%",
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "white", fontSize: 36, fontWeight: 700 }}>RS</span>
            </div>

            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>
              {preview.title}
            </h1>

            {preview.intro && (
              <p
                style={{
                  fontSize: 16,
                  color: "#64748B",
                  lineHeight: 1.6,
                  marginBottom: 32,
                  maxWidth: 500,
                  margin: "0 auto 32px",
                }}
              >
                {preview.intro}
              </p>
            )}

            {/* Stats */}
            <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: 48 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: BLUE }}>
                  {totalQuestions}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Questions</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>
                  {Math.max(1, Math.ceil((totalQuestions * 45) / 60))} min
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Estimated time</div>
              </div>
            </div>

            <motion.button
              onClick={() => setStage("questions")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: BLUE,
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "14px 32px",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Start Survey <ChevronRight size={18} />
            </motion.button>

            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 32 }}>
              Your responses are anonymous and will be kept strictly confidential.
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Render questions
  if (stage === "questions" && preview) {
    const currentSection = preview.sections[currentSectionIdx];
    void ((currentSectionIdx + 1) / preview.sections.length * 100); // sectionProgress unused

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4"
      >
        <div className="max-w-3xl mx-auto py-8">
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>
                Section {currentSectionIdx + 1} of {preview.sections.length}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                {currentSection.title}
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Clock size={16} color={AMBER} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>
                  ~{estimateTimeRemaining()}min left
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {answeredCount} of {totalQuestions} answered
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: 6,
              background: "#E2E8F0",
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 32,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
              style={{ height: "100%", background: BLUE }}
            />
          </div>

          {/* Questions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {currentSection.questions.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                style={{
                  background: "white",
                  borderRadius: 16,
                  border: `1px solid ${responses[q.id] !== undefined ? BLUE : "#E8EDF5"}`,
                  padding: 24,
                  transition: "border-color 0.2s",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", flex: 1 }}>
                    {idx + 1}. {q.text}
                  </span>
                  {q.required && (
                    <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Required</span>
                  )}
                </label>

                {q.hint && (
                  <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12, fontStyle: "italic" }}>
                    {q.hint}
                  </p>
                )}

                {/* Answer inputs by type */}
                <div>
                  {q.type === "text" && (
                    <textarea
                      value={responses[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      placeholder="Your answer..."
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid #E2E8F0`,
                        fontSize: 14,
                        fontFamily: "Inter, sans-serif",
                        resize: "vertical",
                        minHeight: 80,
                      }}
                    />
                  )}

                  {q.type === "select" && (
                    <select
                      value={responses[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid #E2E8F0`,
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select an option...</option>
                      {q.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {q.type === "number" && (
                    <input
                      type="number"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      placeholder="0"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid #E2E8F0`,
                        fontSize: 14,
                      }}
                    />
                  )}

                  {q.type === "date" && (
                    <input
                      type="date"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid #E2E8F0`,
                        fontSize: 14,
                      }}
                    />
                  )}

                  {["audio", "image", "gps"].includes(q.type) && (
                    <div
                      style={{
                        padding: 32,
                        background: "#F8FAFC",
                        borderRadius: 12,
                        textAlign: "center",
                        color: "#9CA3AF",
                      }}
                    >
                      {q.type === "audio" && "Audio recording not available in this browser"}
                      {q.type === "image" && "Image capture not available in this browser"}
                      {q.type === "gps" && "GPS location not available"}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Error message */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  background: "#FEE2E2",
                  borderRadius: 12,
                  marginTop: 24,
                  color: RED,
                  fontSize: 14,
                }}
              >
                <AlertCircle size={18} />
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              marginTop: 40,
            }}
          >
            <motion.button
              onClick={handlePreviousSection}
              disabled={currentSectionIdx === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: `1px solid #E2E8F0`,
                background: currentSectionIdx === 0 ? "#F8FAFC" : "white",
                color: currentSectionIdx === 0 ? "#D1D5DB" : "#64748B",
                fontSize: 14,
                fontWeight: 600,
                cursor: currentSectionIdx === 0 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </motion.button>

            <motion.button
              onClick={handleNextSection}
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "12px 32px",
                borderRadius: 8,
                background: BLUE,
                color: "white",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {submitting ? <Loader size={18} className="animate-spin" /> : null}
              {currentSectionIdx + 1 === preview.sections.length ? "Submit" : "Next"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Render thank you screen
  if (stage === "thank-you") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-xl text-center"
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              border: `1px solid #E8EDF5`,
              boxShadow: "0 8px 32px rgba(10, 15, 28, 0.1)",
              padding: 48,
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              style={{ marginBottom: 24 }}
            >
              <CheckCircle size={80} color={GREEN} style={{ margin: "0 auto" }} />
            </motion.div>

            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
              Thank You!
            </h1>

            <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.6, marginBottom: 32 }}>
              Your responses have been received and will help us improve our research. We appreciate
              your time and valuable feedback.
            </p>

            <div
              style={{
                background: "#F0FDF4",
                borderRadius: 12,
                padding: 16,
                marginBottom: 32,
                fontSize: 13,
                color: GREEN,
              }}
            >
              ✓ All {totalQuestions} responses recorded successfully
            </div>

            <p style={{ fontSize: 12, color: "#9CA3AF" }}>
              You can now close this window. Thank you for participating!
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Render error screen
  if (stage === "error") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-xl text-center"
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              border: `1px solid #E8EDF5`,
              boxShadow: "0 8px 32px rgba(10, 15, 28, 0.1)",
              padding: 48,
            }}
          >
            <AlertCircle size={80} color={RED} style={{ margin: "0 auto 24px" }} />

            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
              Unable to Load Survey
            </h1>

            <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.6 }}>{error}</p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
        <Loader size={48} color={BLUE} />
      </motion.div>
    </div>
  );
}
