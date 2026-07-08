# ResearchOS — Demo Run-Through

A tight, repeatable script for showing ResearchOS end to end. ~6–8 minutes.

## 0. Before you start (once)
1. **Seed demo data** (backend, with normal env):
   ```bash
   python scripts/seed_demo_data.py
   ```
   Creates the demo org + 15 realistic submissions (12 PASS, 2 FLAG, 1 REJECT).
2. Confirm the deployments are live:
   - Dashboard: `https://researchos-dashboard.vercel.app`
   - FieldScore API: `https://web-production-f5bab.up.railway.app/` (health check returns `ok`)
   - InsightScore: `https://insightscore-production.up.railway.app/health`
3. (Optional) Set `MULTITENANCY_ENABLED=true` on Railway so the demo org sees only its own data.
4. Add `researchos-logo.png` to each repo's `/public` so the brand mark shows.

**Demo login:** `demo@ipsos-demo.com` / `IpsosDemo2026`

---

## 1. Login → Overview (60s)
- Log in. Land on the **Overview**.
- Point out: KPI row (Total Submissions, Avg Trust Score, Pass Rate, Active *[industry term]*), the score trend, and **Ada** greeting in the hero with her pulse ring.
- Note the dashboard **auto-refreshes every 30s** — new field submissions appear without reloading.

## 2. Industry-aware experience (30s)
- Settings → **Organization → Industry**: switch to *FMCG / Consumer Goods*.
- Return to Overview: labels adapt ("Active Merchandisers", "Stores"), and Ada's language follows the sector. Switch back to *Research Agency* if preferred.

## 3. Ada does things for you (45s)
- Open Ada (bottom-right) or tap the **mic** and say: **"show me only the flagged submissions."**
- Ada filters the Submissions list to FLAG. Then: **"take me to reports."** Ada zips to the edge and navigates.

## 4. A flagged submission → Ada's assessment (90s)
- Go to **Submissions**. The notifications **bell** (top bar) shows the alert count; open it and click a flagged one — or click a FLAG row directly.
- On the **detail page**, walk through:
  - **GPS** map + accuracy + zone status.
  - **Image evidence** (loads via the backend media proxy — no Kobo 403).
  - **Audio evidence** + transcript, word count, "genuine interview".
  - **Ada's assessment** and the per-engine breakdown (GPS / Duration / Image / Audio / Duplicate).
  - The **flags** in plain English (e.g. "Impossible Back-to-Back", "Duplicate Image").
- Use the **Approve / Reject / Flag** buttons — the decision is recorded and shown as a status banner.

## 5. Qualitative analysis in InsightScore (60s)
- Go to **AI Analysis** (Insights) → open the project → **Intelligence** tab.
- If not analysed, click **Begin Analysis**; Ada reviews the interviews and produces themes, quotes, and recommendations.

## 6. Generate a report (45s)
- On the completed report, use **Download Word / PowerPoint / Excel**.
  - Word: full narrative report with themes and quotes.
  - PowerPoint: board-ready deck (title, exec summary, data-quality chart, per-theme slides, recommendations).
  - Excel: Submissions, Enumerator Summary, Themes, Flags sheets.

## 7. Questionnaire intelligence (45s)
- Go to **Questionnaire**. Fill the brief (purpose, respondents, sector, length, method) → **Generate Questions**.
- Ada drafts sections; edit/reorder questions, watch the completion-time estimate and the leading-question warnings. Export JSON.

## 8. Wrap (30s)
- Billing & Capacity (Settings → Billing) shows plan usage, RIU gauge, and invoices — the commercial story.
- Public **/pricing** page (no login) for prospects: sliders → live plan recommendation.

---

### Reset between demos
Re-run `python scripts/seed_demo_data.py` — it's idempotent (skips submissions already present). If `/data` on Railway isn't a persistent volume, the org may need recreating after a redeploy; the Sheets submissions persist.
