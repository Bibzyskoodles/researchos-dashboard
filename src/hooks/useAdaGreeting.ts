import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

interface UseAdaGreetingOptions {
  page: string;
  delay?: number;
}

const GREETINGS: Record<string, string> = {
  overview:       "I've scanned today's data — here's where things stand. A handful of submissions are worth a closer look, and one enumerator's flag rate is climbing. Want me to walk you through it?",
  submissions:    "Hey! I've been looking at your submissions — there are a few flagged entries worth reviewing. Want me to walk you through what I found?",
  enumerators:    "I've been keeping an eye on team performance! A few enumerators have picked up flags along the way. Want a detailed breakdown of what's happening there?",
  map:            "I'm looking at your GPS coverage right now. Everything checks out — all coordinates verified, no impossible travel detected. Pretty clean data!",
  scorecard:      "I've run the quality scorecard across your team. There are a few enumerators whose scores are trending in the wrong direction — want me to flag the ones that need attention?",
  "data-cleaning":"The Clean Room is ready. I can see some submissions that should probably be removed before analysis. Want me to walk you through the recommended rules, or shall we start with the speed-of-light violations?",
  insights:       "Good news — I've found verified interviews ready for analysis. Themes are already emerging around community perceptions and service access. Want me to run the full analysis?",
  outcome:        "I'm reviewing the outcome indicators now. Some responses are showing strong signal, but a few variables have low fidelity and might need to be excluded. Shall I give you a quick summary?",
  reports:        "I've had a look at your verified submissions and I'm ready to generate whenever you are. Want me to start with an executive summary, or go straight to the full report?",
  integrations:   "Your KoBoToolbox integration is looking healthy — submissions have been coming through steadily. Want to connect another platform, or shall I pull up your webhook details?",
  questionnaire:  "I've reviewed your questionnaire. The structure is solid, but a few questions might cause confusion for respondents. Want me to flag them, or shall I run a full methodology check?",
  settings:       "You're in Settings. I can help you configure my personality, rename field labels to match your organisation's terminology, or adjust your data quality thresholds. What would you like to change?",
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
