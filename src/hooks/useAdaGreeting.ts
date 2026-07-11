import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

interface UseAdaGreetingOptions {
  page: string;
  delay?: number;
}

const GREETINGS: Record<string, string> = {
  overview:            "I've scanned today's data — here's where things stand. A handful of submissions are worth a closer look, and one enumerator's flag rate is climbing. Want me to walk you through it?",
  submissions:         "Hey! I've been looking at your submissions — there are a few flagged entries worth reviewing. Want me to walk you through what I found?",
  enumerators:         "I've been keeping an eye on team performance! A few enumerators have picked up flags along the way. Want a detailed breakdown of what's happening there?",
  map:                 "I'm looking at your GPS coverage right now. Everything checks out — all coordinates verified, no impossible travel detected. Pretty clean data!",
  scorecard:           "I've run the quality scorecard across your team. There are a few enumerators whose scores are trending in the wrong direction — want me to flag the ones that need attention?",
  "data-cleaning":     "The Clean Room is ready. I can see some submissions that should probably be removed before analysis. Want me to walk you through the recommended rules, or shall we start with the speed-of-light violations?",
  insights:            "Good news — I've found verified interviews ready for analysis. Themes are already emerging around community perceptions and service access. Want me to run the full analysis?",
  outcome:             "I'm reviewing the outcome indicators now. Some responses are showing strong signal, but a few variables have low fidelity and might need to be excluded. Shall I give you a quick summary?",
  reports:             "I've had a look at your verified submissions and I'm ready to generate whenever you are. Want me to start with an executive summary, or go straight to the full report?",
  integrations:        "Your KoBoToolbox integration is looking healthy — submissions have been coming through steadily. Want to connect another platform, or shall I pull up your webhook details?",
  questionnaire:       "I've reviewed your questionnaire. The structure is solid, but a few questions might cause confusion for respondents. Want me to flag them, or shall I run a full methodology check?",
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
