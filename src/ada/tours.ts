export interface GuidedStep {
  id: string;
  speech: string;
  route?: string;
  target?: string;
  targetLabel?: string;
  waitForUser?: boolean;
  autoAdvanceMs?: number;
}

export interface GuidedTour {
  id: 'executive' | 'complete';
  name: string;
  durationLabel: string;
  description: string;
  steps: GuidedStep[];
  demoIntro?: GuidedStep; // prepended in demo mode — Ada introduces herself to the room
}

export const TOURS: GuidedTour[] = [
  {
    id: 'executive',
    name: 'Executive Tour',
    durationLabel: '5 minutes',
    description: 'The essential overview — what ResearchOS does and why it matters.',

    demoIntro: {
      id: 'demo-exec-intro',
      route: '/overview',
      speech: "Good afternoon, everyone. I'm Ada — FieldScore's AI Research Partner. For those of you joining us today, thank you for your time. I've already reviewed the platform's active projects and current data before this session. What you're about to see is not a recorded walkthrough. I'm going to navigate the real application live, explain what each capability does, and answer your questions as we go. Please feel free to interrupt me at any point — I genuinely welcome it. Let's begin.",
      waitForUser: true,
    },

    steps: [
      {
        id: 'exec-welcome',
        route: '/overview',
        speech: "Hey, welcome! I'm Ada — your research intelligence layer. I'm really glad you're here. Over the next five minutes, I'm going to show you exactly what ResearchOS can do — and I promise, no slides, no videos. We're doing this live, right inside the real application. Ready? Let's go.",
        waitForUser: true,
      },
      {
        id: 'exec-overview',
        route: '/overview',
        target: 'overview-stats',
        targetLabel: 'Live Dashboard',
        speech: "So this right here — this is your research heartbeat. Four numbers that tell you everything at a glance: how many submissions have come in, what your pass rate looks like, your average Trust Score, and how many enumerators are active in the field right now. Everything updates in real time. If something goes sideways on the ground, you'll see it here first.",
        waitForUser: true,
      },
      {
        id: 'exec-submissions',
        route: '/submissions',
        target: 'submissions-table',
        targetLabel: 'Verified Submissions',
        speech: "Every interview your team collects lands right here. What I love about this view is that ResearchOS doesn't just store the data — it actually verifies it. Audio integrity, image quality, GPS consistency, interview duration — all checked automatically. Each submission gets a Trust Score from zero to a hundred. Amber means it needs a second look. Red means it's been rejected. Simple as that.",
        waitForUser: true,
      },
      {
        id: 'exec-insights',
        route: '/insights',
        target: 'insights-projects',
        targetLabel: 'AI Analysis Projects',
        speech: "Okay, this is honestly my favourite part to show people. This is where raw field data becomes actual research intelligence. I read through your verified interviews and pull out the themes, the contradictions, demographic patterns, sentiment — all of it. What used to take an analyst two weeks? I can do it in under a minute. And every finding links straight back to the interviews that produced it.",
        waitForUser: true,
      },
      {
        id: 'exec-reports',
        route: '/reports',
        target: 'reports-list',
        targetLabel: 'Report Generator',
        speech: "And then everything comes together here. Executive summaries, full analysis decks, raw data exports — generated directly from your verified data. Every recommendation is backed by real evidence from the field. Nothing invented, nothing estimated. When a client asks where a finding came from, you can show them exactly.",
        waitForUser: true,
      },
      {
        id: 'exec-complete',
        route: '/overview',
        speech: "And that's it — the whole platform in five minutes! You've seen verification, intelligence, and reporting, all connected and all real-time. Honestly, we've just scratched the surface. When you're ready to go deeper, I'd love to walk you through the complete experience — it covers every single capability in detail. Or if you have questions right now, just ask me. I'm always here.",
        waitForUser: true,
      },
    ],
  },

  {
    id: 'complete',
    name: 'Complete Guided Experience',
    durationLabel: '15 minutes',
    description: 'Every capability, demonstrated live inside the platform.',

    demoIntro: {
      id: 'demo-full-intro',
      route: '/overview',
      speech: "Good afternoon. I'm Ada — the intelligence layer powering FieldScore. Over the next fifteen minutes or so, I'm going to walk you through every capability this platform has to offer. This is a live demonstration, not a recording. Every page you see me navigate, every data point I reference — it's all real. If you'd like to explore something in more depth at any point, please ask. I'm here to demonstrate and to answer. Let's begin with the overview.",
      waitForUser: true,
    },

    steps: [
      {
        id: 'full-welcome',
        route: '/overview',
        speech: "Welcome — I'm so glad you're taking the time for this. I'm Ada, and I'm going to walk you through every capability ResearchOS has to offer. Not as a product demo, but as a real working session inside the actual platform. We'll go at whatever pace works for you, and please — ask me anything along the way. Let's start with the overview.",
        waitForUser: true,
      },
      {
        id: 'full-overview-stats',
        route: '/overview',
        target: 'overview-stats',
        targetLabel: 'Live Dashboard',
        speech: "Here's your overview dashboard — the heartbeat of everything happening across your projects. Pass rate, Trust Score, active enumerators, submission volume, all in one place. And these aren't static snapshots — they update live as submissions come in from the field. I genuinely love this view because it gives you total clarity in seconds.",
        waitForUser: true,
      },
      {
        id: 'full-overview-actions',
        route: '/overview',
        target: 'overview-actions',
        targetLabel: 'Recommended Actions',
        speech: "These are your recommended actions — things I've spotted that need your attention. I generate these automatically based on what the verification engine has flagged. Click any one of them and I'll take you straight to the right place. Think of it as me curating your to-do list so you don't have to go hunting.",
        waitForUser: true,
      },
      {
        id: 'full-submissions',
        route: '/submissions',
        target: 'submissions-table',
        targetLabel: 'Verified Submissions',
        speech: "Submissions are the foundation of everything. Every interview that reaches the platform gets scored across four dimensions: audio quality, image integrity, GPS consistency, and duration analysis. The Trust Score is a weighted combination of all four checks. Generally, above 75 is a pass, below 50 is a rejection. You can click into any submission to see exactly what flagged — and why.",
        waitForUser: true,
      },
      {
        id: 'full-enumerators',
        route: '/enumerators',
        target: 'enumerators-list',
        targetLabel: 'Enumerator Performance',
        speech: "This view is one of the most powerful for field managers. You can see exactly how each enumerator is performing — how many interviews they've collected, their average Trust Score, and whether their quality is trending up or down over time. If someone is consistently scoring low, I'll show you precisely which checks they're failing. That's real, actionable feedback you can use in training.",
        waitForUser: true,
      },
      {
        id: 'full-map',
        route: '/map',
        target: 'coverage-map',
        targetLabel: 'Coverage Map',
        speech: "The coverage map is brilliant for spotting problems before they become expensive. GPS coordinates for every submission are plotted here, so if someone claims to be interviewing in one location but their phone says otherwise, it shows up immediately. You can also check whether your sample is geographically balanced — whether you're getting coverage across all the areas your study actually requires.",
        waitForUser: true,
      },
      {
        id: 'full-questionnaire',
        route: '/questionnaire',
        target: 'questionnaire-builder',
        targetLabel: 'Questionnaire Builder',
        speech: "Before data collection even begins, I can help you build your questionnaire. Tell me about your research objectives — the populations, the topics, what you're trying to understand — and I'll generate a structured interview guide. You can refine it, add sections, reorder questions, and when you're happy, export it directly to KoboToolbox or ODK. It's a much faster starting point than a blank page.",
        waitForUser: true,
      },
      {
        id: 'full-insights-intro',
        route: '/insights',
        target: 'insights-projects',
        targetLabel: 'AI Analysis Projects',
        speech: "And now we get to the part I'm most excited to show you. AI Analysis is where the platform's real intelligence comes through. Each project here is a completed set of verified interviews. Select one and I'll analyse every response — not just the structured questions, but especially the open-ended answers. That's where the real insights live, and that's where I do my best work.",
        waitForUser: true,
      },
      {
        id: 'full-mti',
        route: '/insights',
        speech: "Inside each project you'll find the Multi-Theme Intelligence panel. MTI is something I'm genuinely proud of — it identifies the recurring themes across your interviews: what people are consistently talking about, what they're carefully avoiding, and where there are contradictions between what they say and what other data suggests. It surfaces things a human analyst would take days to find.",
        waitForUser: true,
      },
      {
        id: 'full-question-intel',
        route: '/insights',
        speech: "Question Intelligence scores every question in your questionnaire. Which questions produced really useful data? Which ones confused respondents or got inconsistent answers? Which ones should be redesigned before the next wave? This feedback loop is what makes research programmes actually improve over time rather than repeating the same mistakes.",
        waitForUser: true,
      },
      {
        id: 'full-demographics',
        route: '/insights',
        speech: "Demographic Intelligence shows how responses vary across gender, age, location, and any other variable your questionnaire captured. If women in urban areas are consistently answering differently from men in rural areas, I surface that automatically — without you having to cross-tabulate manually. You just get the insight, clearly laid out.",
        waitForUser: true,
      },
      {
        id: 'full-reports',
        route: '/reports',
        target: 'reports-list',
        speech: "Reports pull everything together into a deliverable format. Executive summary, full analysis, raw data workbook — whatever you need. And every report references the specific interviews and submissions it draws from. So when a client asks where a finding came from, you don't have to scramble. You can show them the exact evidence, right there.",
        waitForUser: true,
      },
      {
        id: 'full-integrations',
        route: '/integrations',
        speech: "Finally, ResearchOS connects to the tools your team already uses. KoboToolbox integration means submissions flow in automatically — no manual uploads. Webhooks let you push data to your own systems. More platforms are being added all the time. You're not locked into a walled garden, and your existing workflows don't have to change.",
        waitForUser: true,
      },
      {
        id: 'full-complete',
        route: '/overview',
        speech: "And that's the full picture! From questionnaire design all the way through to reporting — every step connected, every piece of evidence traceable. I genuinely think this changes how research teams work, and I'm really excited for you to experience that firsthand. Whenever you're ready to start your first project, just tell me what you're researching and we'll build it together. I'm always here.",
        waitForUser: true,
      },
    ],
  },
];

export function getTour(id: string): GuidedTour | undefined {
  return TOURS.find(t => t.id === id);
}
