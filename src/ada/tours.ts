export interface GuidedStep {
  id: string;
  speech: string;
  route?: string;           // navigate here before showing this step
  target?: string;          // data-ada-target attribute value to highlight
  waitForUser?: boolean;    // show "Next" button, don't auto-advance
  autoAdvanceMs?: number;   // auto-advance after N ms (default: waitForUser)
}

export interface GuidedTour {
  id: 'executive' | 'complete';
  name: string;
  durationLabel: string;
  description: string;
  steps: GuidedStep[];
}

export const TOURS: GuidedTour[] = [
  {
    id: 'executive',
    name: 'Executive Tour',
    durationLabel: '5 minutes',
    description: 'The essential overview — what ResearchOS does and why it matters.',
    steps: [
      {
        id: 'exec-welcome',
        route: '/overview',
        speech: "Welcome to ResearchOS. I'm Ada — I run the intelligence layer of this platform. Over the next five minutes, I'll show you exactly what this system does and why it changes how research teams work. No slides. No manual. We'll do this inside the real application.",
        waitForUser: true,
      },
      {
        id: 'exec-overview',
        route: '/overview',
        target: 'overview-stats',
        speech: "These four numbers are your research heartbeat. Total submissions received, your pass rate, your average Trust Score, and how many enumerators are active. Every project you run flows into this dashboard in real time. If something goes wrong in the field, you see it here first.",
        waitForUser: true,
      },
      {
        id: 'exec-submissions',
        route: '/submissions',
        target: 'submissions-table',
        speech: "Every interview your team collects lands here. ResearchOS automatically verifies each one — checking audio integrity, image quality, GPS consistency, and interview duration. Each submission receives a Trust Score from zero to one hundred. The ones flagged in amber need your attention. The ones in red have been rejected.",
        waitForUser: true,
      },
      {
        id: 'exec-insights',
        route: '/insights',
        target: 'insights-projects',
        speech: "This is where raw data becomes research intelligence. InsightScore reads your verified interviews and extracts themes, contradictions, demographic patterns, and sentiment. What used to take an analyst two weeks happens in under a minute. The findings are referenced directly to the interviews that produced them.",
        waitForUser: true,
      },
      {
        id: 'exec-reports',
        route: '/reports',
        target: 'reports-list',
        speech: "Reports are generated directly from your verified data. Executive summaries, full analysis decks, raw data exports — all in one place. Every recommendation in the report is backed by evidence from the field. Nothing is invented. Nothing is estimated.",
        waitForUser: true,
      },
      {
        id: 'exec-complete',
        route: '/overview',
        speech: "That's the platform in five minutes. You've seen verification, intelligence, and reporting — all connected, all real-time, all evidence-driven. When you're ready to go deeper, the complete tour covers every capability in detail. Or ask me anything directly.",
        waitForUser: true,
      },
    ],
  },
  {
    id: 'complete',
    name: 'Complete Guided Experience',
    durationLabel: '15 minutes',
    description: 'Every capability, demonstrated live inside the platform.',
    steps: [
      {
        id: 'full-welcome',
        route: '/overview',
        speech: "Welcome. I'm going to walk you through every capability ResearchOS offers — not as a product demo, but as a working session inside the real platform. We'll go at whatever pace works for you. Ask me questions at any point. Let's begin with the overview.",
        waitForUser: true,
      },
      {
        id: 'full-overview-stats',
        route: '/overview',
        target: 'overview-stats',
        speech: "The overview dashboard consolidates everything happening across your projects. Pass rate, Trust Score, active enumerators, submission volume. These numbers update as submissions come in from the field. Nothing here is static.",
        waitForUser: true,
      },
      {
        id: 'full-overview-actions',
        route: '/overview',
        target: 'overview-actions',
        speech: "These are your recommended actions — things the system has identified that need your attention. They're generated automatically based on what the verification engine found. Click any of them and the system takes you directly to the relevant view.",
        waitForUser: true,
      },
      {
        id: 'full-submissions',
        route: '/submissions',
        target: 'submissions-table',
        speech: "Submissions are the foundation. Every interview that reaches the platform is automatically scored across four dimensions: audio quality, image integrity, GPS consistency, and duration analysis. The Trust Score is a weighted combination of these checks. A score above 75 typically passes. Below 50 is a rejection.",
        waitForUser: true,
      },
      {
        id: 'full-enumerators',
        route: '/enumerators',
        target: 'enumerators-list',
        speech: "This view shows individual enumerator performance. You can see how many interviews each person has collected, their average Trust Score, and whether their quality is trending up or down. If an enumerator consistently scores low, you can see exactly which checks they're failing — and why.",
        waitForUser: true,
      },
      {
        id: 'full-map',
        route: '/map',
        target: 'coverage-map',
        speech: "The coverage map shows GPS coordinates for every submission. If a submission claims to be from one location but the GPS says otherwise, the system flags it. You can also see whether your sample is geographically balanced — whether you're getting coverage across all the areas your study requires.",
        waitForUser: true,
      },
      {
        id: 'full-questionnaire',
        route: '/questionnaire',
        target: 'questionnaire-builder',
        speech: "Before data collection begins, ResearchOS can build your questionnaire. Describe your research objectives — the populations, the topics, the hypotheses — and the system generates a structured interview guide. You can refine it, add sections, reorder questions, and export directly to KoboToolbox or ODK.",
        waitForUser: true,
      },
      {
        id: 'full-insights-intro',
        route: '/insights',
        target: 'insights-projects',
        speech: "AI Analysis is where the platform's intelligence is most visible. Each project here represents a completed set of verified interviews. Select a project and ResearchOS analyses every response — not just the structured questions, but the open-ended answers that contain the real insights.",
        waitForUser: true,
      },
      {
        id: 'full-mti',
        route: '/insights',
        speech: "Inside each project, you'll find the Multi-Theme Intelligence panel. MTI identifies the recurring themes across your interviews — what people are consistently talking about, what they're consistently avoiding, and what contradictions exist between what they say and what other data suggests.",
        waitForUser: true,
      },
      {
        id: 'full-question-intel',
        route: '/insights',
        speech: "Question Intelligence scores every question in your questionnaire. It tells you which questions produced useful data, which generated confused or inconsistent responses, and which should be redesigned before the next wave of data collection. This feedback loop is what makes research programmes improve over time.",
        waitForUser: true,
      },
      {
        id: 'full-demographics',
        route: '/insights',
        speech: "Demographic Intelligence shows how responses vary across gender, age, location, and any other demographic variable your questionnaire captured. If women in urban areas consistently give different answers than men in rural areas, the system surfaces that automatically — without you having to cross-tabulate manually.",
        waitForUser: true,
      },
      {
        id: 'full-reports',
        route: '/reports',
        target: 'reports-list',
        speech: "Reports consolidate everything into deliverable format. You can generate an executive summary, a full analysis report, or a raw data workbook. Each report references the specific interviews and submissions it draws from. When a client asks 'where does this finding come from', you can show them exactly.",
        waitForUser: true,
      },
      {
        id: 'full-integrations',
        route: '/integrations',
        speech: "ResearchOS connects to the tools your team already uses. KoboToolbox integration means submissions flow in automatically. Webhooks let you push data to your own systems. More platforms are being added. You're not locked into a walled garden.",
        waitForUser: true,
      },
      {
        id: 'full-complete',
        route: '/overview',
        speech: "You've seen the full platform — from questionnaire design through data collection, verification, analysis, and reporting. Every step is connected. Every piece of evidence is traceable. When you're ready to run your first project, I'm here. Tell me what you're researching and we'll build it together.",
        waitForUser: true,
      },
    ],
  },
];

export function getTour(id: string): GuidedTour | undefined {
  return TOURS.find(t => t.id === id);
}
