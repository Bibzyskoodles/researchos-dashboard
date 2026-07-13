// The demo must never show a verdict the real engine wouldn't produce —
// these tests run the scripted fixtures through the ACTUAL trust engine.
import { computeTrustIndex } from "../services/trustEngine";
import { DEFAULT_ENGINE_CONFIG } from "../services/engineConfig";
import { DEMO_SHOWCASE, DEMO_FRAUD, DEMO_RUSHED, DEMO_SUBMISSIONS, DEMO_KPIS } from "./demoData";

test("demo showcase submission PASSes through the real engine", () => {
  const r = computeTrustIndex(DEMO_SHOWCASE as any, DEFAULT_ENGINE_CONFIG);
  expect(r.verdict).toBe("PASS");
  expect(r.trustIndex).toBeGreaterThanOrEqual(80);
});

test("demo fraud submission hard-gates to REJECT through the real engine", () => {
  const r = computeTrustIndex(DEMO_FRAUD as any, DEFAULT_ENGINE_CONFIG);
  expect(r.verdict).toBe("REJECT");
});

test("demo rushed submission FLAGs through the real engine", () => {
  const r = computeTrustIndex(DEMO_RUSHED as any, DEFAULT_ENGINE_CONFIG);
  expect(["FLAG", "REJECT"]).toContain(r.verdict);
});

test("demo dataset internal consistency: 48 total = 46 pass + 1 flag + 1 reject", () => {
  expect(DEMO_SUBMISSIONS.length).toBe(48);
  expect(DEMO_KPIS.pass).toBe(46);
  expect(DEMO_KPIS.flag).toBe(1);
  expect(DEMO_KPIS.reject).toBe(1);
});
