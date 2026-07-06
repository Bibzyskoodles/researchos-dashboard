import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

interface UseAdaGreetingOptions {
  page: string;
  delay?: number;
}

const GREETINGS: Record<string, string> = {
  submissions: "I have reviewed your submissions. I noticed 2 flagged entries — both from ENID0010 with duplicate media. Want me to walk you through them?",
  enumerators: "I have analysed enumerator performance. ENID0010 has completed the most interviews but has 2 flags. Want a detailed breakdown?",
  map: "I can see your submission coverage across Lagos. All GPS coordinates verified within Nigeria. No impossible travel detected.",
  insights: "I am ready to analyse your verified data. You have 16 passed submissions ready for qualitative analysis. What would you like to explore?",
  reports: "I have already prepared a draft executive summary from your 16 verified submissions. Want me to generate the full report?",
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
