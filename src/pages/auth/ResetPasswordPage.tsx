import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authApi } from "../../services/api";
import FieldScoreLogo from "../../components/brand/FieldScoreLogo";

/**
 * Self-serve password reset, both halves on one route:
 *
 *  - /reset-password           → ask for the account email, request a link.
 *  - /reset-password?token=…   → the emailed link lands here; set a new
 *                                password, which also signs the account out
 *                                of every other device (server-side).
 *
 * The request half always shows the same confirmation whether or not the
 * address has an account — the backend answers identically on purpose (no
 * existence oracle), and the UI must not undo that by behaving differently.
 */

const CARD: React.CSSProperties = {
  background: "white", borderRadius: 16, padding: 40, width: "100%",
  maxWidth: 400, boxShadow: "0 4px 24px rgba(8,13,26,.10)",
};
const INPUT: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8,
  padding: "10px 13px", fontSize: 13.5, fontFamily: "Inter,sans-serif",
  color: "#080D1A", outline: "none", marginBottom: 16, boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5,
};
const BUTTON = (busy: boolean): React.CSSProperties => ({
  width: "100%", padding: 11, background: busy ? "#93C5FD" : "#2463EB",
  color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: busy ? "not-allowed" : "pointer", fontFamily: "Inter,sans-serif",
});

function describeResetError(err: any): string {
  const serverMessage = err?.response?.data?.error;
  if (typeof serverMessage === "string" && serverMessage) return serverMessage;
  if (!err?.response) {
    return "Can't reach the FieldScore server. Please try again shortly.";
  }
  return `Something went wrong (${err.response.status}). Please try again.`;
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError("");
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(describeResetError(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", marginBottom: 6 }}>Check your inbox</h1>
        <p style={{ fontSize: 13.5, color: "#6B7280", lineHeight: 1.6 }}>
          If <b>{email.trim()}</b> has a FieldScore account, a reset link is on its
          way. It works once and expires in one hour. Don't forget the spam folder.
        </p>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 20, textAlign: "center" }}>
          <a href="/login" style={{ color: "#2463EB", fontWeight: 600, textDecoration: "none" }}>Back to sign in</a>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", marginBottom: 6 }}>Reset your password</h1>
      <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 28 }}>
        Enter your account email and we'll send you a link to set a new one.
      </p>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 13px", borderRadius: 7, fontSize: 12.5, marginBottom: 16 }}>{error}</div>}
      <form onSubmit={submit}>
        <label style={LABEL}>Email address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@organisation.com" style={INPUT} />
        <button type="submit" disabled={busy} style={BUTTON(busy)}>
          {busy ? "Sending…" : "Email me a reset link"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "#6B7280", marginTop: 20, textAlign: "center" }}>
        Remembered it?{" "}
        <a href="/login" style={{ color: "#2463EB", fontWeight: 600, textDecoration: "none" }}>Sign in</a>
      </p>
    </>
  );
}

function ConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    try {
      await authApi.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err: any) {
      setError(describeResetError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", marginBottom: 6 }}>Password updated</h1>
        <p style={{ fontSize: 13.5, color: "#6B7280", lineHeight: 1.6 }}>
          You've been signed out of all other devices. Sign in with your new
          password to get back to your workspace.
        </p>
        <a href="/login" style={{ ...BUTTON(false), display: "block", textAlign: "center", textDecoration: "none", marginTop: 20, boxSizing: "border-box" }}>
          Sign in
        </a>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", marginBottom: 6 }}>Set a new password</h1>
      <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 28 }}>
        Choose a new password for your account. At least 8 characters.
      </p>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 13px", borderRadius: 7, fontSize: 12.5, marginBottom: 16 }}>{error}</div>}
      <form onSubmit={submit}>
        <label style={LABEL}>New password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" style={INPUT} />
        <label style={LABEL}>Repeat new password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••" style={INPUT} />
        <button type="submit" disabled={busy} style={BUTTON(busy)}>
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "#6B7280", marginTop: 20, textAlign: "center" }}>
        Link expired?{" "}
        <a href="/reset-password" style={{ color: "#2463EB", fontWeight: 600, textDecoration: "none" }}>Request a new one</a>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
      <div style={CARD}>
        <div style={{ marginBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#0A1230", borderRadius: 12, padding: "22px 22px 20px", width: "100%", display: "flex", justifyContent: "center" }}>
            <FieldScoreLogo height={26} mode="dark" casing="#0A1230" tagline />
          </div>
        </div>
        {token ? <ConfirmForm token={token} /> : <RequestForm />}
      </div>
    </div>
  );
}
