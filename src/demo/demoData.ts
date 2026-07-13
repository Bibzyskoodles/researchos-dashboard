// FieldScore Public Demo — scripted dataset
// "Lagos Consumer Pulse — Retail Audit": one fictional FMCG field day.
// Everything on /demo renders from this fixture — no API calls, no auth.
// Internal consistency contract: the 48 submissions here ARE the map dots,
// the KPI counts, and the table rows. Change one place, everything follows.

// ─── Stylised shelf "photos" (inline SVG data URIs — clearly illustrative,
// consistent, and network-free). The duplicate pair reuses THE SAME URI so
// the fraud-catch comparison is literally pixel-identical. ─────────────────

function shelfSvg(seed: number, tint: string): string {
  const rows = 3, cols = 6;
  let items = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = 34 + ((seed * (r + 3) * (c + 7)) % 18);
      const hue = (seed * 47 + r * 90 + c * 33) % 360;
      items += `<rect x="${18 + c * 62}" y="${(r + 1) * 88 - h}" width="46" height="${h}" rx="4" fill="hsl(${hue},55%,55%)"/>`;
      items += `<rect x="${18 + c * 62}" y="${(r + 1) * 88 - h}" width="46" height="10" rx="3" fill="rgba(255,255,255,.35)"/>`;
    }
    items += `<rect x="8" y="${(r + 1) * 88 + 2}" width="384" height="7" rx="2" fill="#8a6f52"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${tint}"/>
    <rect x="4" y="8" width="392" height="272" rx="8" fill="#f3ede2"/>
    ${items}
    <rect x="0" y="282" width="400" height="18" fill="#d9d2c4"/>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

export const SHELF_PHOTOS = {
  clean: shelfSvg(11, "#e8e2d4"),
  duplicate: shelfSvg(23, "#e5ddcf"),   // used by BOTH the original and the recycled copy
  extra1: shelfSvg(7, "#eae4d6"),
  extra2: shelfSvg(31, "#e6dfd1"),
};

// ─── The cast ────────────────────────────────────────────────────────────────

export const DEMO_PROJECT = {
  id: "demo-lagos-pulse",
  name: "Lagos Consumer Pulse — Retail Audit",
  industry: "FMCG",
  target: 50,
  imageContext: "Photo of the store shelf showing branded product placement and stock levels",
};

export const DEMO_ENUMERATORS = [
  { id: "adebayo.o", name: "Adebayo Okonkwo", reputation: 88, band: "TRUSTED", visits: 12 },
  { id: "funke.a", name: "Funke Adeleke", reputation: 91, band: "TRUSTED", visits: 11 },
  { id: "c.eze", name: "Chinedu Eze", reputation: 71, band: "WATCH", visits: 9 },
  { id: "maryam.b", name: "Maryam Bello", reputation: 84, band: "TRUSTED", visits: 10 },
  { id: "tunde.f", name: "Tunde Fashola", reputation: 79, band: "TRUSTED", visits: 6 },
];

// ─── Lagos store-visit coordinates (real Lagos geography, fictional visits) ──

const LAGOS_SPOTS: Array<[number, number, string]> = [
  [6.6018, 3.3515, "Ikeja"], [6.4550, 3.3841, "Lagos Island"], [6.4986, 3.3539, "Surulere"],
  [6.4433, 3.4200, "Victoria Island"], [6.4281, 3.4219, "Ikoyi"], [6.5244, 3.3792, "Yaba"],
  [6.4698, 3.5852, "Ajah"], [6.6194, 3.5105, "Ikorodu Rd"], [6.5833, 3.9833, "Epe Rd"],
  [6.4650, 3.2842, "Festac"], [6.5480, 3.3220, "Agege"], [6.5100, 3.3900, "Mushin"],
];

function jitter(base: number, i: number, scale = 0.012) {
  return base + Math.sin(i * 12.9898) * scale;
}

// ─── The 48 submissions of the field day ─────────────────────────────────────
// 46 PASS · 1 FLAG (short duration) · 1 REJECT (duplicate image — the catch)

export interface DemoSubmission {
  submission_id: string;
  enumerator_id: string;
  submission_date: string;
  scored_at: string;
  duration_mins: number;
  overall_score: number;
  verdict: "PASS" | "FLAG" | "REJECT";
  flags: string[];
  store: string;
  area: string;
  gps: { lat: number; lon: number; accuracy_m: number; address: string };
  image_url?: string;
  audio_url?: string;
  checks: any;
}

const STORES = [
  "Shoprite", "Justrite", "Addide", "Blenco", "SPAR", "Prince Ebeano",
  "FoodCo", "Market Square", "Jendol", "Adiba", "Everyday Superstore", "Grand Square",
];

function mkChecks(opts: {
  score: number; lat: number; lon: number; address: string; mins: number;
  imgScore: number; imgFinding: string; audio?: { transcript: string; score: number };
  dupHit?: { originalId: string }; imgFlag?: string | null; durFlag?: string | null; durFinding?: string;
}) {
  return {
    gps: { status: "PASS", score: 85, flag: null, finding: "GPS valid", lat: opts.lat, lon: opts.lon, accuracy_m: 8, gps_address: opts.address, zone_status: "" },
    duration: { status: opts.durFlag ? "FLAG" : "PASS", score: opts.durFlag ? 35 : 100, flag: opts.durFlag || null, finding: opts.durFinding || `Duration: ${opts.mins} minutes`, duration_mins: opts.mins },
    duplicate: opts.dupHit
      ? { status: "REJECT", score: 5, flag: "DUPLICATE_IMAGE", finding: `Image previously submitted in ${opts.dupHit.originalId}`, is_duplicate: true }
      : { status: "PASS", score: 100, flag: null, finding: "No duplicate detected", is_duplicate: false },
    image: opts.dupHit
      ? {
          status: "REJECT", score: 5, flag: "DUPLICATE_IMAGE", is_genuine: true, is_relevant: true, ai_called: true,
          finding: `Identical to ${opts.dupHit.originalId} — this exact photo was already submitted 3 days ago`,
          original: opts.dupHit.originalId,
          ai_generated: false, ai_generated_confidence: "HIGH",
          ai_generated_signals: ["Natural sensor noise", "Consistent store lighting"],
          ai_generated_finding: "The photo itself is a genuine camera capture — the fraud is its reuse.",
          image_downloaded: false, image_downloaded_checked: true, image_downloaded_confidence: "LOW", image_downloaded_signals: [],
        }
      : {
          status: opts.imgFlag ? "FLAG" : "PASS", score: opts.imgScore, flag: opts.imgFlag || null,
          is_genuine: true, is_relevant: true, ai_called: true, finding: opts.imgFinding,
          ai_generated: false, ai_generated_confidence: "HIGH",
          ai_generated_signals: ["Natural motion blur", "Real sensor noise in shadows", "Shelf-edge labels legible and consistent"],
          ai_generated_finding: "Genuine smartphone capture — no generation artefacts.",
          image_downloaded: false, image_downloaded_checked: true, image_downloaded_confidence: "LOW", image_downloaded_signals: [],
        },
    audio: opts.audio
      ? { status: "PASS", score: opts.audio.score, flag: null, finding: "Genuine two-way conversation with the store manager verified.", transcript: opts.audio.transcript, is_genuine_interview: true, word_count: opts.audio.transcript.split(/\s+/).length }
      : { status: "NOT_AVAILABLE", score: 50, flag: null, finding: "No audio field in this submission" },
    text_ai: { status: "NOT_AVAILABLE", score: 50, flag: null, finding: "No open-ended text fields found in submission" },
  };
}

function buildDay(): DemoSubmission[] {
  const subs: DemoSubmission[] = [];
  const day = "2026-07-13";
  let n = 0;
  const enums = DEMO_ENUMERATORS;
  // 48 visits, 08:40 → 17:20
  for (let i = 0; i < 48; i++) {
    const e = enums[i % enums.length];
    const spot = LAGOS_SPOTS[i % LAGOS_SPOTS.length];
    const lat = jitter(spot[0], i), lon = jitter(spot[1], i + 40);
    const hour = 8 + Math.floor((i / 48) * 9);
    const minute = (i * 11) % 60;
    const t = `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`;
    const store = `${STORES[i % STORES.length]} ${spot[2]}`;
    const mins = 9 + ((i * 7) % 14);
    const id = `DM-${String(1000 + i)}`;
    n++;
    subs.push({
      submission_id: id,
      enumerator_id: e.id,
      submission_date: t,
      scored_at: t,
      duration_mins: mins,
      overall_score: 82 + ((i * 5) % 15),
      verdict: "PASS",
      flags: [],
      store, area: spot[2],
      gps: { lat, lon, accuracy_m: 8, address: `${store}, ${spot[2]}, Lagos` },
      image_url: i % 3 === 0 ? SHELF_PHOTOS.clean : i % 3 === 1 ? SHELF_PHOTOS.extra1 : SHELF_PHOTOS.extra2,
      checks: mkChecks({
        score: 85, lat, lon, address: `${store}, ${spot[2]}, Lagos`, mins,
        imgScore: 84 + (i % 12),
        imgFinding: "Shelf photo shows branded product placement clearly — matches the project's image context.",
      }),
    });
  }

  // — The clean showcase submission (Chapter 2): Adebayo, Shoprite Ikeja, audio included
  const showcase = subs[3];
  showcase.enumerator_id = "adebayo.o";
  showcase.store = "Shoprite Ikeja"; showcase.area = "Ikeja";
  showcase.submission_date = `${day}T09:14:00+01:00`; showcase.scored_at = showcase.submission_date;
  showcase.duration_mins = 14;
  showcase.overall_score = 92;
  showcase.gps = { lat: 6.6018, lon: 3.3515, accuracy_m: 6, address: "Shoprite, Ikeja City Mall, Lagos" };
  showcase.image_url = SHELF_PHOTOS.clean;
  showcase.checks = mkChecks({
    score: 92, lat: 6.6018, lon: 3.3515, address: "Shoprite, Ikeja City Mall, Lagos", mins: 14,
    imgScore: 91,
    imgFinding: "Shelf photo shows branded product placement and stock levels clearly — matches the project's image context.",
    audio: {
      score: 88,
      transcript: "Interviewer: Good morning ma, we're checking availability of the promo packs this week. Manager: Yes, the new promo packs arrived Tuesday — they're moving fast, we've almost sold out of the 500ml. Interviewer: And the competitor display beside it?",
    },
  });

  // — The fraud catch (Chapter 3): C. Eze recycles a photo from 3 days ago
  const fraud = subs[27];
  fraud.submission_id = "DM-1027";
  fraud.enumerator_id = "c.eze";
  fraud.store = "Justrite Surulere"; fraud.area = "Surulere";
  fraud.submission_date = `${day}T11:32:00+01:00`; fraud.scored_at = fraud.submission_date;
  fraud.duration_mins = 11;
  fraud.overall_score = 31;
  fraud.verdict = "REJECT";
  fraud.flags = ["DUPLICATE_IMAGE"];
  fraud.gps = { lat: 6.4986, lon: 3.3539, accuracy_m: 9, address: "Justrite, Adeniran Ogunsanya St, Surulere, Lagos" };
  fraud.image_url = SHELF_PHOTOS.duplicate;
  fraud.checks = mkChecks({
    score: 31, lat: 6.4986, lon: 3.3539, address: "Justrite, Adeniran Ogunsanya St, Surulere, Lagos", mins: 11,
    imgScore: 5, imgFinding: "",
    dupHit: { originalId: "SUB-0041 (10 July)" },
  });

  // — One soft flag for texture: rushed visit
  const rushed = subs[40];
  rushed.verdict = "FLAG";
  rushed.overall_score = 58;
  rushed.flags = ["DURATION_TOO_SHORT"];
  rushed.duration_mins = 3;
  rushed.checks = mkChecks({
    score: 58, lat: rushed.gps.lat, lon: rushed.gps.lon, address: rushed.gps.address, mins: 3,
    imgScore: 80, imgFinding: "Shelf photo acceptable — visit duration is the concern, not the image.",
    durFlag: "DURATION_TOO_SHORT", durFinding: "Interview too short: 3 min (minimum: 8 min)",
  });

  void n;
  return subs;
}

export const DEMO_SUBMISSIONS: DemoSubmission[] = buildDay();
export const DEMO_SHOWCASE = DEMO_SUBMISSIONS[3];
export const DEMO_FRAUD = DEMO_SUBMISSIONS[27];
export const DEMO_RUSHED = DEMO_SUBMISSIONS[40];

// KPIs derived from the same array — internal consistency by construction
export const DEMO_KPIS = (() => {
  const total = DEMO_SUBMISSIONS.length;
  const pass = DEMO_SUBMISSIONS.filter(s => s.verdict === "PASS").length;
  const avg = Math.round(DEMO_SUBMISSIONS.reduce((a, s) => a + s.overall_score, 0) / total);
  return { total, pass, flag: DEMO_SUBMISSIONS.filter(s => s.verdict === "FLAG").length, reject: DEMO_SUBMISSIONS.filter(s => s.verdict === "REJECT").length, passRate: Math.round((pass / total) * 100), avgScore: avg };
})();

// Chapter 6 — scripted insight themes (clearly demo content, consistent with the day)
export const DEMO_THEMES = [
  { name: "Price sensitivity on premium SKUs", evidence: 19, quote: "Customers pick up the premium pack, check the price, and put it back — the 500ml moves three times faster.", sentiment: "negative" },
  { name: "Stock-outs concentrated in Surulere", evidence: 8, quote: "We haven't received the family size since last Thursday — customers keep asking.", sentiment: "negative" },
  { name: "Competitor promotion visibility rising", evidence: 12, quote: "Their promo girls were here twice this week — end-cap display went up Monday.", sentiment: "mixed" },
];
