import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ── Public marketing page — no auth, no dashboard shell ──────────────────────
const BLUE = "#2463EB", GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", PURPLE = "#7C3AED", CYAN = "#06B6D4";
const DARK = "#1A1F3E";
const SALES = "mailto:bibilade@intelligencyai.com.ng";
const NGN_PER_USD = 1600;

const LABEL: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8 };

type MetricKey = "fieldscore" | "interviews" | "reports" | "presentations" | "questionnaires";
type Volumes = Record<MetricKey, number>;
type PlanName = "Starter" | "Professional" | "Enterprise";

const GOALS = [
  { key: "verify", label: "Verify Fieldwork", desc: "Ensure data quality in the field", icon: "🔍", metrics: ["fieldscore"] },
  { key: "analyse", label: "Analyse Interviews", desc: "Extract insights from qualitative data", icon: "💬", metrics: ["interviews"] },
  { key: "reports", label: "Generate Reports", desc: "Create stunning reports and presentations", icon: "📄", metrics: ["reports", "presentations"] },
  { key: "design", label: "Design Research", desc: "Build better questionnaires and research plans", icon: "📋", metrics: ["questionnaires"] },
  { key: "everything", label: "Everything", desc: "All capabilities for end-to-end research", icon: "🚀", metrics: ["fieldscore", "interviews", "reports", "presentations", "questionnaires"] },
];

const METRICS: { key: MetricKey; label: string; desc: string; min: number; max: number; def: number; color: string; icon: string; goal: string }[] = [
  { key: "fieldscore", label: "FieldScore Verifications", desc: "Surveys & interviews verified for quality", min: 0, max: 50000, def: 500, color: BLUE, icon: "🔍", goal: "verify" },
  { key: "interviews", label: "Qualitative Interviews Analysed", desc: "FGDs, IDIs, open-ended responses", min: 0, max: 10000, def: 50, color: PURPLE, icon: "💬", goal: "analyse" },
  { key: "reports", label: "Executive Reports Generated", desc: "Word, PowerPoint & Excel reports", min: 0, max: 500, def: 5, color: GREEN, icon: "📄", goal: "reports" },
  { key: "presentations", label: "PowerPoint Presentations", desc: "Board-ready presentations generated", min: 0, max: 200, def: 2, color: AMBER, icon: "📊", goal: "reports" },
  { key: "questionnaires", label: "Questionnaires Generated / Reviewed", desc: "AI-generated or AI-reviewed questionnaires", min: 0, max: 100, def: 2, color: CYAN, icon: "📋", goal: "design" },
];

const PLANS: Record<PlanName, { price_ngn: number; price_usd: number; riu: number; popular: boolean; caps: Record<MetricKey, number>; features: string[]; support: string; cta: string }> = {
  Starter: {
    price_ngn: 150000, price_usd: 94, riu: 1000, popular: false,
    caps: { fieldscore: 500, interviews: 50, reports: 5, presentations: 3, questionnaires: 2 },
    features: ["Up to 500 FieldScore verifications", "50 qualitative interviews", "5 executive reports", "3 presentations", "2 questionnaires", "1,000 Research Intelligence Units", "Email support"],
    support: "Email support", cta: "Start Free Trial",
  },
  Professional: {
    price_ngn: 350000, price_usd: 219, riu: 5000, popular: true,
    caps: { fieldscore: 2000, interviews: 200, reports: 20, presentations: 10, questionnaires: 5 },
    features: ["Up to 2,000 FieldScore verifications", "200 qualitative interviews", "20 executive reports", "10 presentations", "5 questionnaires", "5,000 Research Intelligence Units", "Priority support"],
    support: "Priority support", cta: "Start Free Trial",
  },
  Enterprise: {
    price_ngn: 800000, price_usd: 500, riu: Infinity, popular: false,
    caps: { fieldscore: Infinity, interviews: Infinity, reports: Infinity, presentations: Infinity, questionnaires: Infinity },
    features: ["Unlimited verifications", "Unlimited interviews", "Unlimited reports", "Custom presentations", "Custom questionnaires", "Unlimited RIUs", "Dedicated account manager", "Custom integrations", "SLA guarantee"],
    support: "Dedicated account manager", cta: "Talk to Sales",
  },
};

const PLAN_DESC: Record<PlanName, string> = {
  Starter: "For small teams running focused studies.",
  Professional: "For active research teams running multiple projects.",
  Enterprise: "For organisations with large-scale or continuous research.",
};

function money(ngn: number, currency: "NGN" | "USD", plus = false) {
  const s = currency === "NGN" ? `₦${ngn.toLocaleString()}` : `$${Math.round(ngn / NGN_PER_USD).toLocaleString()}`;
  return plus ? `${s}+` : s;
}

function recommend(v: Volumes): PlanName {
  const highs = [v.fieldscore > 3000, v.interviews > 500, v.reports > 50, v.presentations > 30].filter(Boolean).length;
  if (v.fieldscore > 3000 || highs >= 2) return "Enterprise";
  if (v.fieldscore >= 500 || v.interviews > 50 || v.reports > 5 || v.presentations > 3 || v.questionnaires > 2) return "Professional";
  return "Starter";
}

// Rough RIU estimate from monthly volumes
function estimateRIU(v: Volumes): number {
  return Math.round(v.fieldscore * 1 + v.interviews * 10 + v.reports * 20 + v.presentations * 15 + v.questionnaires * 5);
}

function Slider({ m, value, onChange, active }: { m: typeof METRICS[number]; value: number; onChange: (n: number) => void; active: boolean }) {
  const clamp = (n: number) => Math.max(m.min, Math.min(m.max, isNaN(n) ? m.min : n));
  return (
    <div style={{ padding: "14px 0", opacity: active ? 1 : 0.55, transition: "opacity .2s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 20 }}>{m.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A" }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.desc}</div>
          </div>
        </div>
        <input type="number" value={value} min={m.min} max={m.max} onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
          style={{ width: 92, textAlign: "right", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px", fontSize: 15, fontWeight: 800, color: m.color, fontFamily: "Inter,sans-serif", outline: "none", letterSpacing: -0.5 }} />
      </div>
      <input type="range" min={m.min} max={m.max} value={value} onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
        style={{ width: "100%", accentColor: m.color, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#CBD5E1", marginTop: 2 }}>
        <span>{m.min.toLocaleString()}</span><span>{m.max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function PlanCard({ name, currency, recommended }: { name: PlanName; currency: "NGN" | "USD"; recommended: boolean }) {
  const p = PLANS[name];
  const isEnt = name === "Enterprise";
  return (
    <div style={{ flex: "1 1 260px", background: "white", borderRadius: 16, border: `1px solid ${p.popular ? BLUE : "#E8EDF5"}`, boxShadow: p.popular ? "0 8px 30px rgba(37,99,235,.14)" : "0 2px 12px rgba(10,15,28,.06)", padding: 24, position: "relative", display: "flex", flexDirection: "column" }}>
      {p.popular && <div style={{ position: "absolute", top: -11, left: 24, background: BLUE, color: "white", fontSize: 10.5, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>Most Popular</div>}
      {recommended && !p.popular && <div style={{ position: "absolute", top: -11, left: 24, background: GREEN, color: "white", fontSize: 10.5, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>Recommended</div>}
      <div style={{ fontSize: 17, fontWeight: 800, color: "#080D1A" }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#080D1A", letterSpacing: -1.5, marginTop: 8 }}>
        {money(p.price_ngn, currency, isEnt)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9CA3AF" }}>/month</span>
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{money(p.price_usd * NGN_PER_USD, "USD", isEnt)} / month</div>
      <div style={{ height: 1, background: "#F1F5F9", margin: "16px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {p.features.map(f => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#374151" }}>
            <span style={{ color: p.popular ? BLUE : GREEN, fontWeight: 800 }}>✓</span><span>{f}</span>
          </div>
        ))}
      </div>
      {isEnt
        ? <a href={SALES} style={{ marginTop: 18, textAlign: "center", padding: "11px", borderRadius: 9, background: "white", border: "1px solid #E2E8F0", color: "#374151", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>{p.cta}</a>
        : <Link to="/login" style={{ marginTop: 18, textAlign: "center", padding: "11px", borderRadius: 9, background: p.popular ? BLUE : "#0F172A", color: "white", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>{p.cta}</Link>}
    </div>
  );
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [goals, setGoals] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Volumes>(() => {
    const v = {} as Volumes; METRICS.forEach(m => { v[m.key] = m.def; }); return v;
  });
  const [adaMsg, setAdaMsg] = useState("");

  const toggleGoal = (key: string) => {
    setGoals(prev => {
      if (key === "everything") {
        const on = !prev.everything;
        const next: Record<string, boolean> = {};
        GOALS.forEach(g => { next[g.key] = on; });
        return next;
      }
      const next = { ...prev, [key]: !prev[key] };
      const others = GOALS.filter(g => g.key !== "everything");
      next.everything = others.every(g => next[g.key]);
      return next;
    });
  };

  const setVol = (k: MetricKey, n: number) => setVolumes(v => ({ ...v, [k]: n }));

  const activeMetric = (mk: string) => {
    const anyGoal = Object.values(goals).some(Boolean);
    if (!anyGoal) return true; // nothing selected → all active
    return GOALS.some(g => goals[g.key] && g.metrics.includes(mk));
  };

  const plan = useMemo(() => recommend(volumes), [volumes]);
  const p = PLANS[plan];
  const riuEstimate = estimateRIU(volumes);
  const riuPct = p.riu === Infinity ? 0 : Math.min(100, Math.round((riuEstimate / p.riu) * 100));
  const riuRemaining = p.riu === Infinity ? Infinity : Math.max(0, p.riu - riuEstimate);

  const letAdaEstimate = () => {
    const g = goals;
    const anyGoal = Object.values(g).some(Boolean);
    const use = anyGoal ? g : { verify: true, analyse: true, reports: true };
    const next: Volumes = { fieldscore: 0, interviews: 0, reports: 0, presentations: 0, questionnaires: 0 };
    if (use.verify || use.everything) next.fieldscore = 1500;
    if (use.analyse || use.everything) next.interviews = 120;
    if (use.reports || use.everything) { next.reports = 12; next.presentations = 6; }
    if (use.design || use.everything) next.questionnaires = 8;
    // ensure at least the defaults so nothing is zero-only
    METRICS.forEach(m => { if (next[m.key] === 0) next[m.key] = m.def; });
    setVolumes(next);
    setAdaMsg("Based on a mid-sized team running a few projects a month, I've set these volumes. The Professional plan usually fits teams at this scale — adjust any slider and I'll re-recommend.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FE", fontFamily: "Inter,sans-serif", color: "#080D1A" }}>
      {/* NAVBAR */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <Link to="/pricing" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <div style={{ background: "linear-gradient(135deg,#1A1F3E,#0F172A)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center" }}>
            <img src="/researchos-logo.png" alt="ResearchOS" style={{ height: 22, width: "auto", objectFit: "contain" }} />
          </div>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/login" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none" }}>Log in</Link>
          <a href={SALES} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "white", background: BLUE, borderRadius: 8, textDecoration: "none" }}>Talk to Sales</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 60px" }}>
        {/* HERO */}
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center", padding: "24px 0 12px" }}>
          <div style={{ flex: "1 1 420px" }}>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, margin: 0 }}>
              Pricing built around <span style={{ color: BLUE }}>your research volume</span>
            </h1>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6, marginTop: 16, maxWidth: 480 }}>
              Move the sliders to match your monthly research needs. See your capacity, value and pricing update in real time.
            </p>
            <p style={{ fontSize: 14, color: BLUE, fontStyle: "italic", marginTop: 8 }}>Ada will recommend the perfect plan for you.</p>
          </div>
          <div style={{ flex: "0 1 320px", background: DARK, borderRadius: 16, padding: 24, color: "white", display: "flex", gap: 14, alignItems: "center" }}>
            <img src="/ada-avatar.jpg" alt="Ada" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", border: "2px solid rgba(255,255,255,.2)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Hi! I'm Ada.</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", lineHeight: 1.5, marginTop: 4 }}>I'll help you find the right plan for your research needs.</div>
            </div>
          </div>
        </div>

        {/* STEP 1 — GOALS */}
        <div style={{ marginTop: 28 }}>
          <div style={{ ...LABEL, marginBottom: 12 }}>1. What do you want to accomplish?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {GOALS.map(g => {
              const on = !!goals[g.key];
              return (
                <button key={g.key} onClick={() => toggleGoal(g.key)} style={{ textAlign: "left", background: "white", border: `1.5px solid ${on ? BLUE : "#E8EDF5"}`, borderRadius: 14, padding: 16, cursor: "pointer", position: "relative", boxShadow: on ? "0 4px 16px rgba(37,99,235,.12)" : "none", fontFamily: "Inter,sans-serif" }}>
                  {on && <div style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderRadius: "50%", background: BLUE, color: "white", fontSize: 11, display: "grid", placeItems: "center", fontWeight: 800 }}>✓</div>}
                  <div style={{ fontSize: 24 }}>{g.icon}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A", marginTop: 8 }}>{g.label}</div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.4, marginTop: 2 }}>{g.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2 + PLAN SUMMARY */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)", gap: 20, marginTop: 28, alignItems: "start" }}>
          {/* LEFT — sliders */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E8EDF5", boxShadow: "0 2px 12px rgba(10,15,28,.06)", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={LABEL}>2. Tell us about your monthly research volume</div>
              <span style={{ fontSize: 11.5, color: BLUE, fontWeight: 600 }}>How is this calculated? →</span>
            </div>
            {METRICS.map(m => (
              <Slider key={m.key} m={m} value={volumes[m.key]} onChange={(n) => setVol(m.key, n)} active={activeMetric(m.key)} />
            ))}
            <div style={{ marginTop: 12, background: DARK, borderRadius: 12, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <img src="/ada-avatar.jpg" alt="Ada" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0 }} />
              <div style={{ flex: "1 1 180px", color: "white" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Not sure about the numbers?</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>Ada can estimate based on your team size and projects.</div>
              </div>
              <button onClick={letAdaEstimate} style={{ padding: "9px 16px", borderRadius: 9, background: BLUE, border: "none", color: "white", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Let Ada Estimate →</button>
            </div>
            {adaMsg && <div style={{ marginTop: 10, fontSize: 12, color: "#374151", background: "#F0F4FF", border: "1px solid #DBE4FF", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>{adaMsg}</div>}
          </div>

          {/* RIGHT — plan summary (sticky) */}
          <div style={{ position: "sticky", top: 16 }}>
            <div style={{ background: DARK, borderRadius: 16, padding: 22, color: "white" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8 }}>Recommended plan</div>
              <AnimatePresence mode="wait">
                <motion.div key={plan} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{plan}</div>
                    {p.popular && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: `${BLUE}33`, color: "#93C5FD" }}>Most Popular</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{PLAN_DESC[plan]}</div>
                </motion.div>
              </AnimatePresence>

              <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Monthly Research Capacity</div>
              {METRICS.map(m => {
                const cap = p.caps[m.key];
                const fits = volumes[m.key] <= cap;
                return (
                  <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                    <span style={{ color: "rgba(255,255,255,.7)" }}>{m.icon} {m.label.split(" ")[0]} {m.key === "questionnaires" ? "" : ""}</span>
                    <span style={{ color: fits ? "rgba(255,255,255,.9)" : "#FCA5A5", fontWeight: 700 }}>
                      {cap === Infinity ? "Unlimited" : cap.toLocaleString()}{!fits && " ⚠"}
                    </span>
                  </div>
                );
              })}

              <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Research Intelligence Units</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,.75)" }}>
                <span>Included</span><span style={{ fontWeight: 700 }}>{p.riu === Infinity ? "Unlimited" : p.riu.toLocaleString()}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.12)", borderRadius: 3, margin: "8px 0 4px", overflow: "hidden" }}>
                <motion.div animate={{ width: `${riuPct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} style={{ height: "100%", background: riuPct > 90 ? RED : BLUE, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>
                Est. usage ~{riuEstimate.toLocaleString()} RIUs{p.riu !== Infinity && ` · ~${riuRemaining.toLocaleString()} remaining each month`}
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: 0.8 }}>Estimated Monthly Investment</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1.5, marginTop: 6 }}>{money(p.price_ngn, currency, plan === "Enterprise")}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}>Billed monthly. Cancel anytime.</div>
              <Link to="/login" style={{ display: "block", textAlign: "center", marginTop: 14, padding: "12px", borderRadius: 10, background: BLUE, color: "white", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Start Free Trial</Link>
              <a href={SALES} style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12.5, color: "rgba(255,255,255,.6)", textDecoration: "none" }}>Talk to Sales Team →</a>

              <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                <div style={{ display: "inline-flex", background: "rgba(255,255,255,.08)", borderRadius: 20, padding: 3 }}>
                  {(["NGN", "USD"] as const).map(cur => (
                    <button key={cur} onClick={() => setCurrency(cur)} style={{ padding: "4px 12px", borderRadius: 18, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "Inter,sans-serif", background: currency === cur ? "white" : "transparent", color: currency === cur ? "#080D1A" : "rgba(255,255,255,.6)" }}>
                      {cur === "NGN" ? "₦ NGN" : "$ USD"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div style={{ marginTop: 40 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(["Starter", "Professional", "Enterprise"] as PlanName[]).map(name => (
              <PlanCard key={name} name={name} currency={currency} recommended={plan === name} />
            ))}
          </div>
        </div>

        {/* IMPACT STATS */}
        <div style={{ marginTop: 48, background: "white", borderRadius: 16, border: "1px solid #E8EDF5", padding: "28px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 20 }}>
          {[
            { n: "320+", d: "Analyst hours saved every month", c: BLUE },
            { n: "38+", d: "Poor quality interviews detected & prevented", c: RED },
            { n: "3x", d: "Faster report turnaround time", c: GREEN },
            { n: "95%", d: "Faster insights with AI", c: PURPLE },
            { n: "4.6x", d: "Average ROI reported by customers", c: AMBER },
          ].map(s => (
            <div key={s.d} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: s.c, letterSpacing: -1.5 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, marginTop: 4 }}>{s.d}</div>
            </div>
          ))}
        </div>

        {/* TRUST */}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <div style={{ ...LABEL, marginBottom: 16 }}>Trusted by leading research organizations</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, alignItems: "center" }}>
            {[["PPFN", 800], ["UNICEF", 700], ["WHO", 800], ["Ipsos", 600], ["Nielsen", 700], ["Kantar", 800], ["Mercy Corps", 600], ["PwC", 700]].map(([name, w]) => (
              <span key={name as string} style={{ fontSize: 20, fontWeight: w as number, color: "#CBD5E1", letterSpacing: -0.5 }}>{name}</span>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E8EDF5", textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          Enterprise-grade security · SOC 2 Type II Compliant · Your data is always yours
        </div>
      </div>
    </div>
  );
}
