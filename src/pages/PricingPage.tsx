import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adaApi } from "../services/api";
import FieldScoreLogo from "../components/brand/FieldScoreLogo";

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

// ── Impact benchmarks ───────────────────────────────────────────────────────
// Hours of MANUAL effort a task typically takes, so we can estimate time (and
// therefore money) saved by automating it. These are transparent industry
// estimates — NOT customer-reported figures, and NOT things we can measure
// before we have real usage (e.g. fraud caught, ROI) which is why those are
// deliberately excluded.
const HOURS_SAVED_PER: Record<MetricKey, number> = {
  fieldscore: 0.1,      // manual quality-check of one survey ≈ 6 min
  interviews: 2,        // transcribing + coding one qualitative interview ≈ 2 hr
  reports: 8,           // drafting one executive report ≈ 1 working day
  presentations: 3,     // building one board-ready deck ≈ 3 hr
  questionnaires: 2,    // designing/reviewing one questionnaire ≈ 2 hr
};

// Blended research-analyst cost per hour, benchmarked per market so the USD
// (international) view isn't just the naira figure converted down.
// NGN: Nigeria avg research-analyst salary ≈ ₦256k/mo (~₦1.6k/hr) loaded ≈ ₦2.5k/hr.
// USD: mid-level research analyst ≈ $35/hr (US avg ~$42-48/hr, kept conservative).
const ANALYST_RATE: Record<"NGN" | "USD", number> = { NGN: 2500, USD: 35 };

function computeImpact(ev: Volumes) {
  const hours = METRICS.reduce((s, m) => s + ev[m.key] * HOURS_SAVED_PER[m.key], 0);
  const records = METRICS.reduce((s, m) => s + ev[m.key], 0);
  return { hours, records };
}

function joinPhrase(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const METRIC_NOUN: Record<MetricKey, string> = {
  fieldscore: "field verifications", interviews: "interviews", reports: "reports",
  presentations: "presentations", questionnaires: "questionnaires",
};

// Ada's live consultant commentary — reacts to the selected goals, the slider
// volumes and the resulting plan, so she reads as an advisor rather than a
// static greeting.
function buildAdaAdvice(goals: Record<string, boolean>, ev: Volumes, activeKeys: Set<MetricKey>, plan: PlanName, p: (typeof PLANS)[PlanName]): string {
  const anyGoal = Object.values(goals).some(Boolean);
  if (!anyGoal) return "Start by telling me what you'd like to accomplish — pick a goal above and I'll size the right plan around your real volumes.";

  const bits = METRICS.filter(m => activeKeys.has(m.key) && ev[m.key] > 0).map(m => `${ev[m.key].toLocaleString()} ${METRIC_NOUN[m.key]}`);
  const workload = bits.length ? `At ${joinPhrase(bits)} a month, ` : "";

  const over = METRICS.filter(m => activeKeys.has(m.key) && p.caps[m.key] !== Infinity && ev[m.key] > p.caps[m.key]);
  if (over.length) {
    const names = joinPhrase(over.map(m => METRIC_NOUN[m.key]));
    return `${workload}your ${names} run past the ${plan} plan's limits. I'd move you up to Enterprise for unlimited capacity — want me to connect you with the team?`;
  }

  const why: Record<PlanName, string> = {
    Starter: "that's a focused workload that fits comfortably in Starter without overpaying",
    Professional: "that's an active, multi-project pace — Professional gives you room to grow",
    Enterprise: "that's large-scale, continuous research where unlimited capacity pays for itself",
  };
  return `${workload}${why[plan]}. I'd recommend the ${plan} plan — adjust any slider and I'll re-check the fit.`;
}

function Slider({ m, value, onChange, active }: { m: typeof METRICS[number]; value: number; onChange: (n: number) => void; active: boolean }) {
  const clamp = (n: number) => Math.max(m.min, Math.min(m.max, isNaN(n) ? m.min : n));
  return (
    <div style={{ padding: "14px 0", opacity: active ? 1 : 0.5, transition: "opacity .2s" }} title={active ? undefined : "Select a matching goal above to adjust this"}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 20 }}>{active ? m.icon : "🔒"}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#080D1A" }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{active ? m.desc : "Not counted — select the matching goal to include it"}</div>
          </div>
        </div>
        <input type="number" value={value} min={m.min} max={m.max} disabled={!active} onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
          style={{ width: 92, textAlign: "right", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px", fontSize: 15, fontWeight: 800, color: active ? m.color : "#CBD5E1", fontFamily: "Inter,sans-serif", outline: "none", letterSpacing: -0.5, background: active ? "white" : "#F8FAFC", cursor: active ? "text" : "not-allowed" }} />
      </div>
      <input type="range" min={m.min} max={m.max} value={value} disabled={!active} onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
        style={{ width: "100%", accentColor: active ? m.color : "#CBD5E1", cursor: active ? "pointer" : "not-allowed" }} />
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
  const [adaInput, setAdaInput] = useState("");
  const [adaThinking, setAdaThinking] = useState(false);

  const toggleGoal = (key: string) => {
    setAdaMsg(""); // manual change → revert to live rule-based advice
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

  const setVol = (k: MetricKey, n: number) => { setAdaMsg(""); setVolumes(v => ({ ...v, [k]: n })); };

  // Apply a set of goal keys (as returned by Ada) to the goals record.
  const applyGoals = (arr: string[]) => {
    const set = new Set(arr);
    const base = GOALS.filter(g => g.key !== "everything");
    const next: Record<string, boolean> = {};
    if (set.has("everything")) {
      GOALS.forEach(g => { next[g.key] = true; });
    } else {
      base.forEach(g => { next[g.key] = set.has(g.key); });
      next.everything = base.every(g => next[g.key]);
    }
    setGoals(next);
  };

  // Ada (real AI) reads a plain-English description and moves the sliders herself.
  const askAda = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = adaInput.trim();
    if (!q || adaThinking) return;
    setAdaThinking(true);
    setAdaMsg("");
    try {
      const activeGoals = GOALS.map(g => g.key).filter(k => goals[k]);
      const { data } = await adaApi.pricing(q, volumes, activeGoals);
      if (Array.isArray(data.goals)) applyGoals(data.goals);
      if (data.volumes && Object.keys(data.volumes).length) {
        setVolumes(v => ({ ...v, ...data.volumes }));
      }
      setAdaMsg(data.message || "");
      setAdaInput("");
    } catch (err) {
      setAdaMsg("Sorry — I couldn't reach my AI service just now. You can set the sliders yourself, or try again in a moment.");
    } finally {
      setAdaThinking(false);
    }
  };

  const activeMetric = (mk: string) => {
    const anyGoal = Object.values(goals).some(Boolean);
    if (!anyGoal) return true; // nothing selected → all active
    return GOALS.some(g => goals[g.key] && g.metrics.includes(mk));
  };

  // Only metrics relevant to the selected goals count toward the recommendation
  // and pricing. Greyed-out (inactive) metrics contribute 0 — so picking
  // "Design Research" and setting 2 questionnaires yields Starter regardless of
  // where the other (inactive) sliders happen to sit. When no goal is selected,
  // every metric is active and counts.
  const effectiveVolumes = useMemo(() => {
    const anyGoal = Object.values(goals).some(Boolean);
    const ev = { ...volumes } as Volumes;
    if (anyGoal) {
      METRICS.forEach(m => {
        const on = GOALS.some(g => goals[g.key] && g.metrics.includes(m.key));
        if (!on) ev[m.key] = 0;
      });
    }
    return ev;
  }, [volumes, goals]);

  const plan = useMemo(() => recommend(effectiveVolumes), [effectiveVolumes]);
  const p = PLANS[plan];
  const riuEstimate = estimateRIU(effectiveVolumes);
  const riuPct = p.riu === Infinity ? 0 : Math.min(100, Math.round((riuEstimate / p.riu) * 100));
  const riuRemaining = p.riu === Infinity ? Infinity : Math.max(0, p.riu - riuEstimate);

  const activeKeys = useMemo(() => {
    const anyGoal = Object.values(goals).some(Boolean);
    const s = new Set<MetricKey>();
    METRICS.forEach(m => {
      const on = !anyGoal || GOALS.some(g => goals[g.key] && g.metrics.includes(m.key));
      if (on) s.add(m.key);
    });
    return s;
  }, [goals]);
  const adaSays = useMemo(() => buildAdaAdvice(goals, effectiveVolumes, activeKeys, plan, p), [goals, effectiveVolumes, activeKeys, plan, p]);
  // Impact stats derived from the user's own volumes — they move with the sliders.
  const impact = useMemo(() => computeImpact(effectiveVolumes), [effectiveVolumes]);
  const impactValue = Math.round(impact.hours * ANALYST_RATE[currency]);
  const impactValueStr = currency === "NGN" ? `₦${impactValue.toLocaleString()}` : `$${impactValue.toLocaleString()}`;
  // What Ada shows: while thinking → a working note; after an AI reply → that
  // reply (adaMsg); otherwise the instant rule-based advice (adaSays).
  const adaDisplay = adaThinking ? "Let me work that out…" : (adaMsg || adaSays);

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
          <div style={{ background: "#0A1230", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center" }}>
            <FieldScoreLogo height={16} mode="dark" casing="#0A1230" />
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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Hi! I'm Ada, your research consultant.</div>
              <AnimatePresence mode="wait">
                <motion.div key={adaDisplay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", lineHeight: 1.5, marginTop: 4 }}>
                  {adaDisplay}
                </motion.div>
              </AnimatePresence>
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
            <div style={{ marginTop: 12, background: DARK, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <img src="/ada-avatar.jpg" alt="Ada" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0 }} />
                <div style={{ flex: "1 1 180px", color: "white" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Tell Ada about your research</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>Describe it in plain English — she'll set the sliders for you.</div>
                </div>
              </div>
              <form onSubmit={askAda} style={{ display: "flex", gap: 8 }}>
                <input
                  value={adaInput}
                  onChange={(e) => setAdaInput(e.target.value)}
                  disabled={adaThinking}
                  placeholder="e.g. 3 national surveys a quarter, ~2,000 interviews each, plus monthly board decks"
                  style={{ flex: 1, minWidth: 0, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "white", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, fontFamily: "Inter,sans-serif", outline: "none" }}
                />
                <button type="submit" disabled={adaThinking || !adaInput.trim()}
                  style={{ padding: "10px 16px", borderRadius: 9, background: adaThinking || !adaInput.trim() ? "rgba(255,255,255,.15)" : BLUE, border: "none", color: "white", fontSize: 12.5, fontWeight: 700, cursor: adaThinking || !adaInput.trim() ? "default" : "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                  {adaThinking ? "Thinking…" : "Ask Ada →"}
                </button>
              </form>
              <button onClick={letAdaEstimate} type="button" disabled={adaThinking}
                style={{ marginTop: 8, background: "none", border: "none", color: "rgba(255,255,255,.55)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "Inter,sans-serif" }}>
                Or let Ada estimate for me →
              </button>
            </div>
            {adaMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: "#374151", background: "#F0F4FF", border: "1px solid #DBE4FF", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5, display: "flex", gap: 8 }}>
              <span style={{ fontWeight: 800, color: BLUE }}>Ada:</span><span>{adaMsg}</span>
            </div>}
          </div>

          {/* RIGHT — plan summary (sticky) */}
          <div style={{ position: "sticky", top: 16 }}>
            <div style={{ background: DARK, borderRadius: 16, padding: 22, color: "white" }}>
              {/* Ada — live consultant, reacts as you adjust goals & sliders */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                <img src="/ada-avatar.jpg" alt="Ada" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                  style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0, border: "1.5px solid rgba(147,197,253,.4)" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#93C5FD", textTransform: "uppercase", letterSpacing: 0.6 }}>Ada · Research Consultant</div>
                  <AnimatePresence mode="wait">
                    <motion.div key={adaDisplay} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      style={{ fontSize: 12, color: "rgba(255,255,255,.82)", lineHeight: 1.5, marginTop: 4 }}>
                      {adaDisplay}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
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
                const on = activeMetric(m.key);
                const fits = !on || volumes[m.key] <= cap;
                return (
                  <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", opacity: on ? 1 : 0.4 }}>
                    <span style={{ color: "rgba(255,255,255,.7)" }}>{m.icon} {m.label.split(" ")[0]}</span>
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

        {/* IMPACT STATS — derived from the user's own volumes, move with the sliders */}
        <div style={{ marginTop: 48 }}>
          <div style={{ ...LABEL, textAlign: "center", marginBottom: 14 }}>Your estimated monthly impact</div>
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E8EDF5", padding: "28px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 20 }}>
            {[
              { n: `~${Math.round(impact.hours).toLocaleString()}`, d: "Analyst hours saved each month", c: BLUE },
              { n: impactValueStr, d: "Estimated value created each month", c: GREEN },
              { n: `~${Math.round(impact.records).toLocaleString()}`, d: "Records verified & analysed each month", c: PURPLE },
            ].map(s => (
              <div key={s.d} style={{ textAlign: "center" }}>
                <AnimatePresence mode="wait">
                  <motion.div key={s.n} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                    style={{ fontSize: 32, fontWeight: 800, color: s.c, letterSpacing: -1.5 }}>{s.n}</motion.div>
                </AnimatePresence>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, marginTop: 4 }}>{s.d}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
            Estimated from typical manual effort at benchmark analyst rates — adjust the sliders above and these update live.
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E8EDF5", textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          Enterprise-grade security · Your data is always yours
        </div>
      </div>
    </div>
  );
}
