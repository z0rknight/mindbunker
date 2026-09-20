const option = (value, title, description, patch) => ({ value, title, description, patch });

export const EXPERIENCE_SCREENS = [
  {
    id: "shape",
    stage: "Getting started",
    title: "What are you trying to make?",
    hint: "Choose the closest starting point. It does not need to be final.",
    options: [
      option("one", "One video", "I have one specific piece I need edited.", { deliverableCountBand: "one", recurrence: "one_off" }),
      option("small", "A few videos", "I want a small set produced together.", { deliverableCountBand: "small_batch", recurrence: "campaign" }),
      option("batch", "A larger batch", "I expect around five to ten related pieces.", { deliverableCountBand: "batch_5_10", recurrence: "campaign" }),
      option("ongoing", "Ongoing content", "I expect to need videos regularly.", { deliverableCountBand: "ongoing", recurrence: "recurring" }),
      option("unsure", "I'm not sure yet", "Help me find the best starting point.", { deliverableCountBand: "unsure", recurrence: "unsure" }),
    ],
  },
  {
    id: "content",
    stage: "Your content",
    title: "What kind of videos are they?",
    hint: "A rough length is enough to place the work in context.",
    options: [
      option("short", "Short clips", "Social videos, reels, or pieces under about 90 seconds.", { contentType: "short", durationBand: "under_90s" }),
      option("mid", "A few minutes", "Videos, lessons, or stories around 2–10 minutes.", { contentType: "long", durationBand: "2_to_10m" }),
      option("long", "Longer videos", "YouTube, interviews, or lessons over about 10 minutes.", { contentType: "long", durationBand: "over_10m" }),
      option("mix", "A mix", "Longer content plus short clips or excerpts.", { contentType: "both", durationBand: "mixed" }),
      option("unsure", "I'm not sure yet", "I need help choosing the right format.", { contentType: "unsure", durationBand: "unsure" }),
    ],
  },
  {
    id: "format",
    stage: "Your content",
    title: "Do you already have a video style that works?",
    hint: "This can be a template, an approved example, or a repeatable look.",
    options: [
      option("yes", "Yes", "We have a format or template we want to keep using.", { formatMaturity: "established" }),
      option("sort_of", "Sort of", "We have references, but the approach still needs shaping.", { formatMaturity: "references" }),
      option("no", "No", "We need to create the visual approach.", { formatMaturity: "discover" }),
      option("unsure", "I'm not sure", "I need Emmanuel to help evaluate what we have.", { formatMaturity: "unsure" }),
    ],
  },
  {
    id: "materials",
    stage: "What is ready",
    title: "What do you already have?",
    hint: "Think about footage, recordings, scripts, and the main idea—not a production inventory.",
    options: [
      option("ready", "Everything is ready", "The material is available and I know what should be included.", { sourceReadiness: "ready", editorialReadiness: "defined" }),
      option("shape", "The material is ready", "The recordings exist, but I want help shaping the story or choosing cuts.", { sourceReadiness: "ready", editorialReadiness: "editor_selects" }),
      option("partial", "Some things are still coming", "We are still recording, gathering, or organizing material.", { sourceReadiness: "partial", editorialReadiness: "mixed" }),
      option("unsure", "I'm not sure what I need", "I would like a simple checklist or conversation first.", { sourceReadiness: "needs_help", editorialReadiness: "unsure" }),
    ],
  },
  {
    id: "working-style",
    stage: "How we'd work",
    title: "How defined is the work?",
    hint: "Clear work is easier to define upfront. Flexible work leaves room to discover and adjust.",
    options: [
      option("clear", "Clear direction", "I know what I want and would rather define it upfront.", { creativeFlexibility: "formula" }),
      option("flexible", "Some flexibility", "I know the direction, but I want room to adjust as we work.", { creativeFlexibility: "some" }),
      option("discover", "Let's figure it out together", "The format or creative direction still needs to be discovered.", { creativeFlexibility: "high" }),
      option("unsure", "I'm not sure yet", "I need help choosing the right way to begin.", { creativeFlexibility: "unsure" }),
    ],
  },
  {
    id: "special",
    stage: "How we'd work",
    title: "Does the edit need anything special?",
    hint: "Choose the main thing that stands out. Details can be clarified with Emmanuel later.",
    conditional: "complexity",
    options: [
      option("none", "Nothing unusual", "The expected treatment is straightforward.", { technicalComplexityFlags: ["none"] }),
      option("motion", "Graphics or animation", "Custom titles, diagrams, or moving visual elements matter.", { technicalComplexityFlags: ["motion"] }),
      option("research", "Extra footage or visuals", "The story may need supporting clips, images, or other visuals.", { technicalComplexityFlags: ["research"] }),
      option("sources", "Several recordings or versions", "There may be multiple cameras, speakers, or different versions to deliver.", { technicalComplexityFlags: ["multicam", "versions"] }),
      option("unsure", "I'm not sure / something else", "Emmanuel can inspect the material and ask the right follow-up.", { technicalComplexityFlags: ["unsure"] }),
    ],
  },
  {
    id: "approval",
    stage: "Timing and review",
    title: "Who gives the final go-ahead?",
    hint: "This helps set a realistic review process, not a corporate workflow.",
    options: [
      option("one", "Just me", "One person gives clear feedback and approval.", { reviewComplexity: "one", dependencyFlags: ["none"] }),
      option("two", "Me and one other person", "Two people will be involved in the final decision.", { reviewComplexity: "several", dependencyFlags: ["approval"] }),
      option("team", "A team", "Several people may need to review or approve.", { reviewComplexity: "several", dependencyFlags: ["approval", "feedback"] }),
      option("unsure", "I'm not sure yet", "The approval process still needs clarifying.", { reviewComplexity: "unclear", dependencyFlags: ["unsure"] }),
    ],
  },
  {
    id: "timing",
    stage: "Timing and review",
    title: "When would you like the work to move?",
    hint: "This helps Emmanuel review feasibility. It does not promise availability or a delivery date.",
    options: [
      option("specific", "I have a specific date", "A launch, event, or commitment sets the target.", { deadlineType: "specific" }),
      option("soon", "Within a couple of weeks", "I have a near-term target, with some room to plan.", { deadlineType: "window" }),
      option("flexible", "The timing is flexible", "Finding the right process matters more than one exact date.", { deadlineType: "window" }),
      option("cadence", "I need an ongoing schedule", "Consistency matters more than a single delivery.", { deadlineType: "cadence" }),
      option("urgent", "It feels urgent", "I need Emmanuel to check what is realistically possible.", { deadlineType: "urgent" }),
    ],
  },
  {
    id: "contact",
    stage: "Almost done",
    title: "Where should Emmanuel reach you?",
    hint: "You've already clarified the starting point. This prototype still sends nothing.",
    contact: true,
  },
];

export const PUBLIC_STARTING_PATHS = {
  REPEATABLE_PRODUCTION: {
    label: "Repeatable production",
    description: "A clear format and reliable inputs make a consistent production rhythm the strongest place to begin.",
    why: "Your format and materials are clear enough to focus on making the work consistently.",
  },
  PILOT_SETUP: {
    label: "Define the format first",
    description: "One small first version can establish the look and workflow before the work becomes recurring.",
    why: "You want ongoing content, but the format or workflow still needs a useful first version.",
  },
  FLEXIBLE_COLLABORATION: {
    label: "Flexible collaboration",
    description: "Keep the first scope adjustable while the story, format, or creative direction takes shape.",
    why: "Exploration is part of the work, so the direction should stay adjustable at the start.",
  },
  DEFINED_PROJECT: {
    label: "Defined project",
    description: "The outcome and working process are clear enough to define before production begins.",
    why: "The outcome, materials, and decision process are clear enough to define the work upfront.",
  },
  HUMAN_REVIEW: {
    label: "Conversation first",
    description: "A short conversation is the most honest next step before choosing a production path.",
    why: "A few important choices are still open, so forcing a package would be premature.",
  },
};

export function shouldShowComplexity(answers) {
  return (
    answers.formatMaturity !== "established" ||
    answers.sourceReadiness !== "ready" ||
    answers.editorialReadiness !== "defined" ||
    answers.creativeFlexibility !== "formula"
  );
}

export function getVisibleExperienceScreens(answers) {
  return EXPERIENCE_SCREENS.filter((screen) => {
    if (screen.conditional === "complexity") return shouldShowComplexity(answers);
    return true;
  });
}

export function applyExperienceAnswer(answers, screenId, optionValue) {
  const screen = EXPERIENCE_SCREENS.find((candidate) => candidate.id === screenId);
  const selected = screen?.options?.find((candidate) => candidate.value === optionValue);
  if (!selected) return answers;
  const next = { ...answers, ...selected.patch };
  return shouldShowComplexity(next) ? next : { ...next, technicalComplexityFlags: [] };
}

export function selectedExperienceValue(answers, screen) {
  return screen.options?.find((candidate) => Object.entries(candidate.patch).every(([key, expected]) => {
    const actual = answers[key];
    return Array.isArray(expected)
      ? JSON.stringify(actual || []) === JSON.stringify(expected)
      : actual === expected;
  }))?.value || null;
}

export function optionLabel(screenId, value) {
  return EXPERIENCE_SCREENS.find((screen) => screen.id === screenId)?.options?.find((candidate) => candidate.value === value)?.title || "Not answered";
}

export function buildClientSummary(answers) {
  const selected = Object.fromEntries(EXPERIENCE_SCREENS.filter((screen) => screen.options).map((screen) => [screen.id, selectedExperienceValue(answers, screen)]));
  const timing = answers.deadlineType === "specific" ? "A specific date"
    : answers.deadlineType === "window" ? "A flexible timing window"
      : answers.deadlineType === "cadence" ? "An ongoing schedule"
        : answers.deadlineType === "urgent" ? "Urgent feasibility review"
          : "Not decided yet";
  return {
    making: optionLabel("shape", selected.shape),
    content: optionLabel("content", selected.content),
    frequency: answers.recurrence === "recurring" ? "Regularly" : answers.recurrence === "campaign" ? "As a batch or campaign" : answers.recurrence === "one_off" ? "One-time project" : "Not decided yet",
    ready: optionLabel("materials", selected.materials),
    definition: optionLabel("working-style", selected["working-style"]),
    timing,
  };
}
