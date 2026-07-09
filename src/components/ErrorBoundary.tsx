import React from "react";

interface ErrorState { hasError: boolean; message: string; }
interface ErrorProps { children: React.ReactNode; resetKey?: string; }

export default class ErrorBoundary extends React.Component<ErrorProps, ErrorState> {
  state: ErrorState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ResearchOS crash:", error, info);
  }

  // Reset when the route changes (resetKey = location.pathname)
  componentDidUpdate(prevProps: ErrorProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", background: "#F0F4FF", fontFamily: "Inter, sans-serif",
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 40, maxWidth: 440,
            border: "1px solid #E2E8F0", textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#080D1A", marginBottom: 8 }}>
              This page ran into a problem
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              {this.state.message || "An unexpected error occurred. You can navigate to another page."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => this.setState({ hasError: false, message: "" })}
                style={{
                  padding: "9px 20px", borderRadius: 9, background: "white",
                  color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                }}
              >
                Try again
              </button>
              <button
                onClick={() => { window.location.href = "/overview"; }}
                style={{
                  padding: "9px 20px", borderRadius: 9, background: "#2463EB",
                  color: "white", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                }}
              >
                Go to Overview
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
