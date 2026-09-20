export const SCHEMA_VERSION = "rmedia-guided-intake-v0";

export const STARTING_PATHS = {
  REPEATABLE_PRODUCTION: {
    label: "Repeatable production",
    description: "A recurring or batched workflow built around a format that is already understood.",
  },
  PILOT_SETUP: {
    label: "Pilot / setup",
    description: "A small first piece or batch to define the format before committing to a larger rhythm.",
  },
  FLEXIBLE_COLLABORATION: {
    label: "Flexible, exploratory collaboration",
    description: "A collaborative start with room to discover the creative or technical approach.",
  },
  DEFINED_PROJECT: {
    label: "Defined project",
    description: "A bounded piece or small batch with a clear brief and known inputs.",
  },
  HUMAN_REVIEW_REQUIRED: {
    label: "Conversation first",
    description: "A short human review is the safest next step because key decisions are still open.",
  },
};

export const ACTUAL_DECISION_VARIABLES = [
  "deliverableCountBand",
  "recurrence",
  "contentType",
  "durationBand",
  "formatMaturity",
  "sourceReadiness",
  "editorialReadiness",
  "creativeFlexibility",
  "technicalComplexityFlags",
  "reviewComplexity",
  "deadlineType",
  "dependencyFlags",
  "referralSource",
  "freeformContext",
  "contact",
];

export const STEPS = [
  {
    id: "output",
    eyebrow: "The work",
    title: "What are you hoping to make?",
    hint: "A rough answer is enough. This is about shape, not a final scope.",
    fields: [
      {
        key: "contentType",
        legend: "Type of content",
        options: [
          ["short", "Short-form", "Social clips, reels, or other concise pieces."],
          ["long", "Long-form", "YouTube, lessons, interviews, or deeper stories."],
          ["both", "A mix of both", "Long-form plus shorter pieces or excerpts."],
          ["unsure", "I'm not sure yet", "I need help deciding what format fits."],
        ],
      },
      {
        key: "durationBand",
        legend: "Typical duration",
        compact: true,
        options: [
          ["under_90s", "Under 90 seconds", ""],
          ["2_to_10m", "2–10 minutes", ""],
          ["over_10m", "Over 10 minutes", ""],
          ["mixed", "Mixed", ""],
          ["unsure", "Not sure", ""],
        ],
      },
    ],
  },
  {
    id: "volume",
    eyebrow: "The rhythm",
    title: "Is this one piece or the start of a rhythm?",
    hint: "Volume alone does not determine difficulty. Repetition can make production simpler.",
    fields: [
      {
        key: "deliverableCountBand",
        legend: "How much content?",
        options: [
          ["one", "One video", "A single, defined piece."],
          ["small_batch", "A small batch", "Two to four related deliverables."],
          ["batch_5_10", "About 5–10", "A larger batch with shared context or style."],
          ["ongoing", "Ongoing production", "A continuing stream rather than a fixed count."],
          ["unsure", "I'm not sure yet", "We can work out a sensible starting size."],
        ],
      },
      {
        key: "recurrence",
        legend: "Does it repeat?",
        compact: true,
        options: [
          ["one_off", "One-off", ""],
          ["campaign", "Campaign / batch", ""],
          ["recurring", "Weekly or monthly", ""],
          ["unsure", "Not sure yet", ""],
        ],
      },
    ],
  },
  {
    id: "format",
    eyebrow: "Creative direction",
    title: "How established is the format?",
    hint: "A known visual language usually matters more than the raw video count.",
    fields: [
      {
        key: "formatMaturity",
        legend: "Current starting point",
        options: [
          ["established", "We already have a style that works", "There are approved examples, templates, or a repeatable formula."],
          ["references", "We have references, but no formula yet", "The direction exists; the system still needs shaping."],
          ["discover", "We need to discover the format", "The look, pace, or structure still needs exploration."],
          ["unsure", "I'm not sure", "I need Emmanuel to help evaluate what exists."],
        ],
      },
      {
        key: "creativeFlexibility",
        legend: "How much room should there be to explore?",
        compact: true,
        options: [
          ["formula", "Follow the formula", ""],
          ["some", "Some experimentation", ""],
          ["high", "Highly collaborative", ""],
          ["unsure", "Not sure", ""],
        ],
      },
    ],
  },
  {
    id: "materials",
    eyebrow: "What is ready",
    title: "What would Emmanuel receive to begin?",
    hint: "This reveals dependencies before anyone promises a deadline.",
    fields: [
      {
        key: "sourceReadiness",
        legend: "Footage and assets",
        options: [
          ["ready", "Everything is ready and organized", "Footage, logos, and access can be shared."],
          ["partial", "Some materials are ready", "Part of the footage or access is still coming."],
          ["gathering", "We're still recording or gathering", "Production inputs are not complete yet."],
          ["needs_help", "I need help knowing what's required", "A checklist or conversation would help."],
        ],
      },
      {
        key: "editorialReadiness",
        legend: "Story and cuts",
        options: [
          ["defined", "The story or cuts are defined", "A script, cut sheet, selects, or timecodes exist."],
          ["mixed", "Some decisions are made", "There is direction, with a few editorial choices remaining."],
          ["editor_selects", "Emmanuel should find the story or cuts", "The source exists, but editorial discovery is part of the work."],
          ["unsure", "I'm not sure", "I need help evaluating the material."],
        ],
      },
    ],
  },
  {
    id: "complexity",
    eyebrow: "Only when relevant",
    title: "Does anything need extra exploration or coordination?",
    hint: "Choose all that apply. Plain-language signals help Emmanuel spot hidden work.",
    conditional: true,
    fields: [
      {
        key: "technicalComplexityFlags",
        legend: "Production signals",
        multiple: true,
        options: [
          ["motion", "Custom graphics or animation", "A new visual system, diagrams, or motion work."],
          ["research", "Finding B-roll or supporting assets", "The source does not include everything the story needs."],
          ["multicam", "Several cameras or speakers", "Sources need syncing or careful selection."],
          ["versions", "Several formats or aspect ratios", "The same idea needs distinct platform versions."],
          ["text_heavy", "Captions or text carry the story", "Typography and on-screen information are central."],
          ["source_risk", "Footage or audio may need repair", "Color, LOG footage, audio, or unusual files need checking."],
          ["none", "None of these", "The material and expected treatment are straightforward."],
          ["unsure", "I'm not sure", "Emmanuel can inspect the material first."],
        ],
      },
      {
        key: "dependencyFlags",
        legend: "Things that must happen first",
        multiple: true,
        compact: true,
        options: [
          ["assets", "Assets or access still needed", ""],
          ["feedback", "Fast feedback will be needed", ""],
          ["approval", "Other people must approve", ""],
          ["none", "No known dependencies", ""],
          ["unsure", "Not sure", ""],
        ],
      },
    ],
  },
  {
    id: "timing",
    eyebrow: "Timing and decisions",
    title: "What does a good working process look like?",
    hint: "This does not promise a date. It helps Emmanuel review feasibility and coordination.",
    fields: [
      {
        key: "deadlineType",
        legend: "Timing",
        options: [
          ["specific", "There is a specific date", "A launch, event, or commitment sets the target."],
          ["window", "There is a flexible window", "A useful range matters more than one exact date."],
          ["cadence", "We need an ongoing cadence", "Consistency matters more than a single delivery."],
          ["urgent", "It feels urgent", "The timing needs a human feasibility check."],
          ["unsure", "I'm not sure yet", "Timing can be clarified together."],
        ],
      },
      {
        key: "reviewComplexity",
        legend: "Who decides when it is right?",
        compact: true,
        options: [
          ["one", "One decision maker", ""],
          ["several", "Several stakeholders", ""],
          ["unclear", "Still unclear", ""],
        ],
      },
    ],
  },
  {
    id: "contact",
    eyebrow: "Your starting point",
    title: "Where should Emmanuel continue the conversation?",
    hint: "Submitting would create one Lead and preserve this intake as evidence. This prototype sends nothing.",
    contact: true,
  },
];

export function emptyAnswers() {
  return {
    contentType: null,
    durationBand: null,
    deliverableCountBand: null,
    recurrence: null,
    formatMaturity: null,
    sourceReadiness: null,
    editorialReadiness: null,
    creativeFlexibility: null,
    technicalComplexityFlags: [],
    dependencyFlags: [],
    deadlineType: null,
    reviewComplexity: null,
    contact: { name: "", email: "", company: "" },
    freeformContext: "",
  };
}
export function shouldAskComplexity(answers) {
  return (
    answers.formatMaturity !== "established" ||
    answers.sourceReadiness !== "ready" ||
    answers.editorialReadiness !== "defined" ||
    ["batch_5_10", "ongoing"].includes(answers.deliverableCountBand) ||
    answers.recurrence === "recurring"
  );
}

export function visibleSteps(answers) {
  return STEPS.filter((step) => !step.conditional || shouldAskComplexity(answers));
}

const unknown = (value) => !value || value === "unsure" || value === "unclear" || value === "needs_help";
const hasAny = (values, wanted) => (values || []).some((value) => wanted.includes(value));

export function deriveIntake(answers) {
  const technicalFlags = (answers.technicalComplexityFlags || []).filter((item) => item !== "none");
  const dependencyFlags = (answers.dependencyFlags || []).filter((item) => item !== "none");
  const unknownCount = [
    answers.contentType,
    answers.deliverableCountBand,
    answers.recurrence,
    answers.formatMaturity,
    answers.sourceReadiness,
    answers.editorialReadiness,
    answers.creativeFlexibility,
    answers.deadlineType,
    answers.reviewComplexity,
  ].filter(unknown).length + (technicalFlags.includes("unsure") ? 1 : 0);
  const technicalSignals = technicalFlags.filter((item) => item !== "unsure").length;
  const unresolvedDependencies = dependencyFlags.filter((item) => item !== "unsure").length;
  const repeatableShape =
    ["small_batch", "batch_5_10", "ongoing"].includes(answers.deliverableCountBand) ||
    ["campaign", "recurring"].includes(answers.recurrence);
  const inputsReady = answers.sourceReadiness === "ready" && answers.editorialReadiness === "defined";
  const formatKnown = answers.formatMaturity === "established" && answers.creativeFlexibility === "formula";
  const likelyPilotNeed = repeatableShape && !formatKnown;

  let recommendedStartingPath = "HUMAN_REVIEW_REQUIRED";
  if (unknownCount >= 4 || (unknownCount >= 2 && answers.deadlineType === "urgent")) {
    recommendedStartingPath = "HUMAN_REVIEW_REQUIRED";
  } else if (likelyPilotNeed) {
    recommendedStartingPath = "PILOT_SETUP";
  } else if (
    answers.creativeFlexibility === "high" ||
    technicalSignals >= 2 ||
    hasAny(technicalFlags, ["motion", "source_risk"]) && !inputsReady
  ) {
    recommendedStartingPath = "FLEXIBLE_COLLABORATION";
  } else if (repeatableShape && formatKnown && inputsReady) {
    recommendedStartingPath = "REPEATABLE_PRODUCTION";
  } else if (
    ["one", "small_batch"].includes(answers.deliverableCountBand) &&
    !unknown(answers.contentType) &&
    formatKnown &&
    inputsReady &&
    answers.reviewComplexity === "one"
  ) {
    recommendedStartingPath = "DEFINED_PROJECT";
  }

  const productionReadiness = inputsReady ? "ready" : answers.sourceReadiness === "needs_help" ? "needs_definition" : "partial";
  const repeatabilityPotential = repeatableShape && formatKnown ? "high" : repeatableShape ? "emerging" : "not_primary";
  const decisionUncertainty = unknownCount >= 4 ? "high" : unknownCount >= 2 ? "medium" : "low";
  const technicalUncertainty = technicalFlags.includes("unsure") ? "unknown" : technicalSignals >= 2 ? "high" : technicalSignals === 1 ? "medium" : "low";
  const coordinationLoad = answers.reviewComplexity === "several" || unresolvedDependencies >= 2 ? "high" : unresolvedDependencies === 1 ? "medium" : "low";
  const schedulePressure = answers.deadlineType === "urgent" ? "high" : answers.deadlineType === "specific" ? "defined" : "flexible";
  const uncertaintyLevel = [decisionUncertainty, technicalUncertainty, coordinationLoad].includes("high") ? "high" : [decisionUncertainty, technicalUncertainty, coordinationLoad].includes("medium") ? "medium" : "low";

  return {
    productionReadiness,
    repeatabilityPotential,
    decisionUncertainty,
    technicalUncertainty,
    coordinationLoad,
    schedulePressure,
    likelyPilotNeed,
    uncertaintyLevel,
    recommendedStartingPath,
  };
}

export function buildPayload(answers, referralSource = null) {
  return {
    schemaVersion: SCHEMA_VERSION,
    leadIntent: "video_help",
    answers: {
      ...answers,
      contact: { ...answers.contact },
      technicalComplexityFlags: [...(answers.technicalComplexityFlags || [])],
      dependencyFlags: [...(answers.dependencyFlags || [])],
    },
    derived: deriveIntake(answers),
    referralSource,
    commercialDecision: null,
    price: null,
    discount: null,
    capacityDecision: null,
    requiresHumanReview: true,
  };
}
