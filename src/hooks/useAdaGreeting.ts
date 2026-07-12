import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

interface UseAdaGreetingOptions {
  page: string;
  delay?: number;
}

const GREETINGS: Record<string, string> = {
  overview:            "This is your project overview — live stats, submission activity, and anything that needs attention. Ask me about any number you see and I'll explain how it's calculated.",
  submissions:         "Every submission here is scored the moment it arrives. Click any row for the full evidence breakdown, or ask me to filter — for example, \"show me the flagged ones\".",
  enumerators:         "This page ranks your field team by data quality. Click anyone to see their reputation score and submission history. Ask me if you want help interpreting a score.",
  map:                 "This map plots where each submission was collected. Use the verdict filter to spot geographic patterns — clusters of rejections often mean a site-level problem.",
  scorecard:           "The scorecard grades each enumerator across every quality dimension. Use it to decide who needs coaching and who deserves recognition — ask me how any grade is computed.",
  "data-cleaning":     "The Clean Room applies removal rules to your dataset before analysis — duplicates, impossible speeds, incomplete responses. Review each rule and toggle the ones you want enforced.",
  insights:            "This is where verified submissions become findings — theme extraction, sentiment, and outcome analysis. Pick a project and I'll run the analysis on its verified responses.",
  outcome:             "Outcome intelligence measures how well your collected data answers the study's research questions. Run it after verification to see signal strength per indicator.",
  reports:             "I generate client-ready reports from your verified data — executive summaries, technical quality reports, or full narratives. Pick a format and I'll build it.",
  integrations:        "This is where your data collection tools connect to FieldScore. Copy this project's webhook URL into your form platform and submissions start flowing in automatically.",
  questionnaire:       "This is the questionnaire workspace. I can help you design questions, check methodology, and export to your collection platform. Ask me to review anything you've drafted.",
  settings:            "You're in Settings. I can help you configure my personality, rename field labels to match your organisation's terminology, or adjust your data quality thresholds. What would you like to change?",
  "settings-research": "Research Defaults control the thresholds I use when scoring every submission — GPS tolerance, minimum interview duration, and the pass score cutoff. Changing these takes effect immediately on any submission detail you open. Want me to recommend values for a typical household survey in Nigeria?",
  "settings-engine":   "This is the Engine Config — the brain behind every FieldScore verdict. You can adjust how much each check contributes to the final score, skip expensive checks when a submission is already clearly fraudulent (engine gating), and calibrate how hard AI-generated content is penalised. The defaults are well-tuned for most fieldwork, but every project is different. Ask me if you're unsure what to change.",
  "settings-billing":  "Your credits balance is applied to your next invoice automatically — no manual redemption needed. You earn credits by completing milestones: issuing certificates, generating reports, and verifying submissions in bulk. Want me to show you the fastest ways to earn?",
  "settings-users":    "I can help you decide who should get which role. Field managers typically need Manager access — they can see all submissions and enumerators. Supervisors doing QC should have Viewer access. Client contacts who just need to read reports should be Observer. Want me to walk through what each role can and can't do?",
  projects:            "Your projects are the home for each research engagement. I can help you pick the right study design, connect your KoboToolbox form, and track quality from collection through to report. Ready to open an existing project, or shall we create a new one?",
  billing:             "Your plan controls how many submissions you can verify each month, how many team members you can invite, and which AI features you have access to. I can explain the difference between plans, help you understand your current usage, or walk you through upgrading. What would you like to know?",
};

export function useAdaGreeting({ page, delay = 1200 }: UseAdaGreetingOptions) {
  const { setState, addMessage, store } = useAda();
  const greetedRef = useRef(false);

  useEffect(() => {
    greetedRef.current = false;
  }, [page]);

  useEffect(() => {
    if (greetedRef.current) return;
    if (store.messages.length > 0) return;

    const greeting = GREETINGS[page];
    if (!greeting) return;

    const timer = setTimeout(() => {
      greetedRef.current = true;
      setState("thinking");
      setTimeout(() => {
        setState("speaking");
        addMessage({
          id: Date.now().toString(),
          role: "assistant",
          content: greeting,
          timestamp: new Date().toISOString(),
          page,
        });
        setTimeout(() => setState("idle"), 4000);
      }, 600);
    }, delay);

    return () => clearTimeout(timer);
  }, [page, delay, setState, addMessage, store.messages.length]);
}
