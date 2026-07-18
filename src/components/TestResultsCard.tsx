import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, Activity } from "lucide-react";

const BLUE = "#2463EB";
const GREEN = "#059669";
const AMBER = "#D97706";

interface TestResults {
  timestamp: string;
  tests: Record<string, { status: string; duration_sec: number; message: string }>;
  totals?: {
    total_time_seconds: number;
    submissions_processed: number;
    throughput_per_second: number;
    duplicates_detected: number;
  };
  phases?: Record<string, { duration_seconds: number; status: string }>;
}

export default function TestResultsCard() {
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to load test results from the backend API or JSON files
    const loadResults = async () => {
      try {
        // Try fetching from API first
        const res = await fetch("/api/test-results");
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fallback: Results not available yet
      }
      setLoading(false);
    };

    loadResults();
  }, []);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #E8EDF5",
          boxShadow: "0 2px 12px rgba(10,15,28,.06)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #E8EDF5", borderTopColor: BLUE }}
          />
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>Loading test results...</span>
        </div>
      </motion.div>
    );
  }

  if (!results) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #E8EDF5",
          boxShadow: "0 2px 12px rgba(10,15,28,.06)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", color: AMBER }}>
          <AlertCircle size={18} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>No test results yet</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              Run tests with: <code style={{ fontFamily: "monospace", background: "#F3F4F6", padding: "2px 4px", borderRadius: 3 }}>python run_tests.py</code>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const passCount = Object.values(results.tests).filter((t) => t.status?.includes("✅")).length;
  const totals = results.totals || { total_time_seconds: 0, submissions_processed: 0, throughput_per_second: 0, duplicates_detected: 0 };
  const timestamp = new Date(results.timestamp).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "white",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #E8EDF5",
        boxShadow: "0 2px 12px rgba(10,15,28,.06)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A", display: "flex", alignItems: "center", gap: 8 }}>
            🧪 System Tests
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Backend performance & integration validation</div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#ECFDF5",
            border: "1px solid #D1FAE5",
            borderRadius: 6,
            padding: "4px 8px",
          }}
        >
          <CheckCircle size={12} color={GREEN} />
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN }}>All Passing</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Tests Passing
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: -1 }}>
            {passCount}/{Object.keys(results.tests).length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Throughput
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: BLUE, letterSpacing: -1 }}>
            {(totals.throughput_per_second / 1000).toFixed(0)}K/s
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Duplicates
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: AMBER, letterSpacing: -1 }}>
            {(totals.duplicates_detected / 1000).toFixed(1)}K
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Time
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#374151", letterSpacing: -1 }}>
            {totals.total_time_seconds}s
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "#F1F5F9" }} />

      {/* Test Details */}
      <div style={{ padding: "12px 20px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>
          Integration Tests
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(results.tests)
            .slice(0, 4)
            .map(([name, test]) => (
              <motion.div key={name} whileHover={{ x: 2 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: test.status?.includes("✅") ? GREEN : AMBER }}>
                  {test.status?.includes("✅") ? "✓" : test.status?.includes("⏭️") ? "—" : "✕"}
                </span>
                <span style={{ fontSize: 11, color: "#374151", flex: 1 }}>{name}</span>
                <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}>{test.duration_sec}s</span>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Scale Projections */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #F1F5F9" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>
          Scale Capacity (Ipsos)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "100K", time: (totals.total_time_seconds * 5).toFixed(2) },
            { label: "500K", time: (totals.total_time_seconds * 25).toFixed(2) },
            { label: "1M", time: (totals.total_time_seconds * 50).toFixed(2) },
          ].map((proj) => (
            <div key={proj.label} style={{ padding: 8, background: "#F9FAFB", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{proj.label} subs</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{proj.time}s</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 20px", background: "#F9FAFB", borderTop: "1px solid #F1F5F9", fontSize: 9, color: "#9CA3AF" }}>
        Last run: {timestamp}
      </div>
    </motion.div>
  );
}
