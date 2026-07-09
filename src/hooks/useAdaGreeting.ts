import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

interface UseAdaGreetingOptions {
  page: string;
  delay?: number;
}

const GREETINGS: Record<string, string> = {
  submissions: "Hey! I've been looking at your submissions — there are 2 flagged entries, both from ENID0010 with duplicate media. Want me to walk you through what I found?",
  enumerators: "I've been keeping an eye on team performance! ENID0010 has the most interviews but has picked up 2 flags along the way. Want a detailed breakdown of what's happening there?",
  map: "I'm looking at your GPS coverage across Lagos right now. Everything checks out — all coordinates verified within Nigeria, no impossible travel detected. Pretty clean data!",
  insights: "Good news — I've found 16 verified interviews ready for analysis. From what I can see, I'm already picking up themes around community perceptions and service access. Want me to run the full analysis?",
  reports: "I've had a look at your 16 verified submissions and I'm ready to generate whenever you are. Want me to start with an executive summary, or go straight to the full report?",
  integrations: "Your KoboToolbox integration is looking healthy — 18 submissions have come through so far. Want to connect another platform, or shall I pull up your webhook details?",
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
