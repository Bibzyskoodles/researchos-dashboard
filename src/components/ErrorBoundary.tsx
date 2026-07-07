import React from "react";

interface ErrorState { hasError: boolean; message: string; }
interface ErrorProps { children: React.ReactNode; }

export default class ErrorBoundary extends React.Component<ErrorProps, ErrorState> {
  state: ErrorState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ResearchOS crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", background: "#F0F4FF", fontFamily: "Inter, sans-serif" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 40, maxWidth: 480,
            border: "1px solid #E2E8F0", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#080D1A", marginBottom: 8 }}>
              Something went wrong on this page.
            </div>
            <pre style={{ fontSize: 11, color: "#9CA3AF", background: "#F8FAFF",
              borderRadius: 8, padding: "10px 14px", textAlign: "left",
              whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 24 }}>
              {this.state.message}
            </pre>
            <button onClick={() => { window.location.href = "/overview"; }}
              style={{ padding: "10px 24px", borderRadius: 9, background: "#2463EB",
                color: "white", border: "none", cursor: "pointer", fontSize: 13,
                fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
              Go to Overview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
