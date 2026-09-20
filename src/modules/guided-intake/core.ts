import { cleanEmail } from "../booking/core.ts";
import type { ReferralProgram } from "../referrals/core.ts";

export const GUIDED_INTAKE_EVENT_TYPE = "guided_intake.submitted";
export const GUIDED_INTAKE_PAYLOAD_SCHEMA_VERSION = 1 as const;
export const GUIDED_INTAKE_MODEL_VERSION = "rmedia-guided-intake-v0";

export const GUIDED_STARTING_PATHS = [
  "REPEATABLE_PRODUCTION",
  "PILOT_SETUP",
  "FLEXIBLE_COLLABORATION",
  "DEFINED_PROJECT",
  "HUMAN_REVIEW_REQUIRED",
] as const;

export type GuidedStartingPath = (typeof GUIDED_STARTING_PATHS)[number];

export const GUIDED_STARTING_PATH_LABELS: Record<GuidedStartingPath, string> = {
  REPEATABLE_PRODUCTION: "Repeatable production",
  PILOT_SETUP: "Define the format first",
  FLEXIBLE_COLLABORATION: "Flexible collaboration",
  DEFINED_PROJECT: "Defined project",
  HUMAN_REVIEW_REQUIRED: "Conversation first",
};

const VALUES = {
  contentType: ["short", "long", "both", "unsure"],
  durationBand: ["under_90s", "2_to_10m", "over_10m", "mixed", "unsure"],
  deliverableCountBand: ["one", "small_batch", "batch_5_10", "ongoing", "unsure"],
  recurrence: ["one_off", "campaign", "recurring", "unsure"],
  formatMaturity: ["established", "references", "discover", "unsure"],
  sourceReadiness: ["ready", "partial", "gathering", "needs_help"],
  editorialReadiness: ["defined", "mixed", "editor_selects", "unsure"],
  creativeFlexibility: ["formula", "some", "high", "unsure"],
  technicalComplexityFlags: ["motion", "research", "multicam", "versions", "text_heavy", "source_risk", "none", "unsure"],
  reviewComplexity: ["one", "several", "unclear"],
  deadlineType: ["specific", "window", "cadence", "urgent", "unsure"],
  dependencyFlags: ["assets", "feedback", "approval", "none", "unsure"],
} as const;

type ValueOf<K extends keyof typeof VALUES> = (typeof VALUES)[K][number];

export type GuidedIntakeAnswers = {
  contentType: ValueOf<"contentType">;
  durationBand: ValueOf<"durationBand">;
  deliverableCountBand: ValueOf<"deliverableCountBand">;
  recurrence: ValueOf<"recurrence">;
  formatMaturity: ValueOf<"formatMaturity">;
  sourceReadiness: ValueOf<"sourceReadiness">;
  editorialReadiness: ValueOf<"editorialReadiness">;
  creativeFlexibility: ValueOf<"creativeFlexibility">;
  technicalComplexityFlags: ValueOf<"technicalComplexityFlags">[];
  reviewComplexity: ValueOf<"reviewComplexity">;
  deadlineType: ValueOf<"deadlineType">;
  dependencyFlags: ValueOf<"dependencyFlags">[];
  contact: { name: string; email: string; company: string | null };
};

export type GuidedDerivedDimensions = {
  productionReadiness: "ready" | "partial" | "needs_definition";
  repeatabilityPotential: "high" | "emerging" | "not_primary";
  decisionUncertainty: "low" | "medium" | "high";
  technicalUncertainty: "low" | "medium" | "high" | "unknown";
  coordinationLoad: "low" | "medium" | "high";
  schedulePressure: "flexible" | "defined" | "high";
  likelyPilotNeed: boolean;
  uncertaintyLevel: "low" | "medium" | "high";
};

export type GuidedIntakePayloadV1 = {
  schemaVersion: 1;
  modelVersion: typeof GUIDED_INTAKE_MODEL_VERSION;
  answers: GuidedIntakeAnswers;
  derivedDimensions: GuidedDerivedDimensions;
  recommendedStartingPath: GuidedStartingPath;
  referralContext: { key: string; source: string } | null;
  freeformContext: string | null;
  submissionContext: { channel: "start" };
};

export type ValidatedGuidedIntakeSubmission = {
  answers: GuidedIntakeAnswers;
  freeformContext: string | null;
  idempotencyKey: string;
  ref: string | null;
};

export type GuidedIntakeValidation =
  | { success: true; data: ValidatedGuidedIntakeSubmission }
  | { success: false; errors: Record<string, string> };

const ANSWER_KEYS = [
  "contentType", "durationBand", "deliverableCountBand", "recurrence",
  "formatMaturity", "sourceReadiness", "editorialReadiness",
  "creativeFlexibility", "technicalComplexityFlags", "reviewComplexity",
  "deadlineType", "dependencyFlags", "contact", "freeformContext",
] as const;
const REQUEST_KEYS = ["answers", "idempotencyKey", "ref", "company_website"] as const;
const CONTACT_KEYS = ["name", "email", "company"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function enumValue<K extends keyof typeof VALUES>(
  key: K,
  value: unknown,
): ValueOf<K> | null {
  return typeof value === "string" && (VALUES[key] as readonly string[]).includes(value)
    ? (value as ValueOf<K>)
    : null;
}

function enumArray<K extends "technicalComplexityFlags" | "dependencyFlags">(
  key: K,
  value: unknown,
): ValueOf<K>[] | null {
  if (!Array.isArray(value) || value.length > VALUES[key].length) return null;
  const unique = [...new Set(value)];
  if (unique.length !== value.length) return null;
  return unique.every((item) => enumValue(key, item) !== null)
    ? (unique as ValueOf<K>[])
    : null;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim() || null;
}

export function validateGuidedIntakeSubmission(value: unknown): GuidedIntakeValidation {
  const errors: Record<string, string> = {};
  if (!isRecord(value) || !hasOnlyKeys(value, REQUEST_KEYS)) {
    return { success: false, errors: { request: "Unexpected submission structure." } };
  }
  if (!isRecord(value.answers) || !hasOnlyKeys(value.answers, ANSWER_KEYS)) {
    return { success: false, errors: { answers: "Unexpected answer structure." } };
  }
  const raw = value.answers;
  const contact = raw.contact;
  if (!isRecord(contact) || !hasOnlyKeys(contact, CONTACT_KEYS)) {
    return { success: false, errors: { contact: "Unexpected contact structure." } };
  }

  const scalars = {
    contentType: enumValue("contentType", raw.contentType),
    durationBand: enumValue("durationBand", raw.durationBand),
    deliverableCountBand: enumValue("deliverableCountBand", raw.deliverableCountBand),
    recurrence: enumValue("recurrence", raw.recurrence),
    formatMaturity: enumValue("formatMaturity", raw.formatMaturity),
    sourceReadiness: enumValue("sourceReadiness", raw.sourceReadiness),
    editorialReadiness: enumValue("editorialReadiness", raw.editorialReadiness),
    creativeFlexibility: enumValue("creativeFlexibility", raw.creativeFlexibility),
    reviewComplexity: enumValue("reviewComplexity", raw.reviewComplexity),
    deadlineType: enumValue("deadlineType", raw.deadlineType),
  };
  for (const [key, answer] of Object.entries(scalars)) {
    if (answer === null) errors[key] = "Choose one of the available answers.";
  }
  const technicalComplexityFlags = enumArray("technicalComplexityFlags", raw.technicalComplexityFlags);
  const dependencyFlags = enumArray("dependencyFlags", raw.dependencyFlags);
  if (technicalComplexityFlags === null) errors.technicalComplexityFlags = "Invalid technical answer.";
  if (dependencyFlags === null) errors.dependencyFlags = "Invalid dependency answer.";

  const name = typeof contact.name === "string" ? contact.name.trim().slice(0, 160) : "";
  if (!name) errors.name = "Your name is required.";
  const email = cleanEmail(contact.email);
  if (!email) errors.email = "Enter a valid email address.";
  const company = optionalText(contact.company, 160);
  if (contact.company && company === null) errors.company = "Business or website is too long.";
  const freeformContext = optionalText(raw.freeformContext, 1_200);
  if (raw.freeformContext && freeformContext === null) errors.freeformContext = "Additional context is too long.";

  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/u.test(idempotencyKey)) {
    errors.idempotencyKey = "Invalid submission identity.";
  }
  const ref = value.ref === null || value.ref === undefined || value.ref === ""
    ? null
    : typeof value.ref === "string" && value.ref.length <= 40
      ? value.ref
      : null;

  if (Object.keys(errors).length > 0 || Object.values(scalars).some((answer) => answer === null) || !technicalComplexityFlags || !dependencyFlags || !email) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      answers: {
        ...(scalars as Omit<GuidedIntakeAnswers, "technicalComplexityFlags" | "dependencyFlags" | "contact">),
        technicalComplexityFlags,
        dependencyFlags,
        contact: { name, email, company },
      },
      freeformContext,
      idempotencyKey,
      ref,
    },
  };
}

const unknown = (value: string | null | undefined) =>
  !value || value === "unsure" || value === "unclear" || value === "needs_help";
const hasAny = (values: readonly string[], wanted: readonly string[]) =>
  values.some((value) => wanted.includes(value));

export function deriveGuidedIntake(answers: GuidedIntakeAnswers): {
  derivedDimensions: GuidedDerivedDimensions;
  recommendedStartingPath: GuidedStartingPath;
} {
  const technicalFlags = answers.technicalComplexityFlags.filter((item) => item !== "none");
  const dependencyFlags = answers.dependencyFlags.filter((item) => item !== "none");
  const unknownCount = [
    answers.contentType, answers.deliverableCountBand, answers.recurrence,
    answers.formatMaturity, answers.sourceReadiness, answers.editorialReadiness,
    answers.creativeFlexibility, answers.deadlineType, answers.reviewComplexity,
  ].filter(unknown).length + (technicalFlags.includes("unsure") ? 1 : 0);
  const technicalSignals = technicalFlags.filter((item) => item !== "unsure").length;
  const unresolvedDependencies = dependencyFlags.filter((item) => item !== "unsure").length;
  const repeatableShape =
    ["small_batch", "batch_5_10", "ongoing"].includes(answers.deliverableCountBand) ||
    ["campaign", "recurring"].includes(answers.recurrence);
  const inputsReady = answers.sourceReadiness === "ready" && answers.editorialReadiness === "defined";
  const formatKnown = answers.formatMaturity === "established" && answers.creativeFlexibility === "formula";
  const likelyPilotNeed = repeatableShape && !formatKnown;

  let recommendedStartingPath: GuidedStartingPath = "HUMAN_REVIEW_REQUIRED";
  if (unknownCount >= 4 || (unknownCount >= 2 && answers.deadlineType === "urgent")) {
    recommendedStartingPath = "HUMAN_REVIEW_REQUIRED";
  } else if (likelyPilotNeed) {
    recommendedStartingPath = "PILOT_SETUP";
  } else if (
    answers.creativeFlexibility === "high" ||
    technicalSignals >= 2 ||
    (hasAny(technicalFlags, ["motion", "source_risk"]) && !inputsReady)
  ) {
    recommendedStartingPath = "FLEXIBLE_COLLABORATION";
  } else if (repeatableShape && formatKnown && inputsReady) {
    recommendedStartingPath = "REPEATABLE_PRODUCTION";
  } else if (
    ["one", "small_batch"].includes(answers.deliverableCountBand) &&
    !unknown(answers.contentType) && formatKnown && inputsReady &&
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
    derivedDimensions: {
      productionReadiness,
      repeatabilityPotential,
      decisionUncertainty,
      technicalUncertainty,
      coordinationLoad,
      schedulePressure,
      likelyPilotNeed,
      uncertaintyLevel,
    },
    recommendedStartingPath,
  };
}

export function buildGuidedIntakePayload(
  data: ValidatedGuidedIntakeSubmission,
  referral: ReferralProgram | null,
): GuidedIntakePayloadV1 {
  const derived = deriveGuidedIntake(data.answers);
  return {
    schemaVersion: GUIDED_INTAKE_PAYLOAD_SCHEMA_VERSION,
    modelVersion: GUIDED_INTAKE_MODEL_VERSION,
    answers: data.answers,
    derivedDimensions: derived.derivedDimensions,
    recommendedStartingPath: derived.recommendedStartingPath,
    referralContext: referral ? { key: referral.key, source: referral.source } : null,
    freeformContext: data.freeformContext,
    submissionContext: { channel: "start" },
  };
}

export function isGuidedIntakePayload(value: unknown): value is GuidedIntakePayloadV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.modelVersion !== GUIDED_INTAKE_MODEL_VERSION) return false;
  if (!GUIDED_STARTING_PATHS.includes(value.recommendedStartingPath as GuidedStartingPath)) return false;
  if (!isRecord(value.answers) || !isRecord(value.derivedDimensions)) return false;
  if (!isRecord(value.submissionContext) || value.submissionContext.channel !== "start") return false;
  return true;
}

const VOLUME_LABELS: Record<GuidedIntakeAnswers["deliverableCountBand"], string> = {
  one: "one video",
  small_batch: "a few videos",
  batch_5_10: "5–10 videos",
  ongoing: "ongoing videos",
  unsure: "volume not decided",
};

const RECURRENCE_LABELS: Record<GuidedIntakeAnswers["recurrence"], string> = {
  one_off: "one-time",
  campaign: "batch or campaign",
  recurring: "recurring",
  unsure: "cadence not decided",
};

export function buildGuidedIntakeDescription(payload: GuidedIntakePayloadV1): string {
  return [
    "Guided intake submitted",
    GUIDED_STARTING_PATH_LABELS[payload.recommendedStartingPath],
    VOLUME_LABELS[payload.answers.deliverableCountBand],
    RECURRENCE_LABELS[payload.answers.recurrence],
  ].join(" · ");
}

export function serviceInterestForGuidedIntake(
  contentType: GuidedIntakeAnswers["contentType"],
): "short-form" | "long-form" | "other" | null {
  if (contentType === "short") return "short-form";
  if (contentType === "long") return "long-form";
  if (contentType === "both") return "other";
  return null;
}

export type GuidedIntakeProjection = {
  whatTheyWant: string;
  volume: string;
  recurrence: string;
  readiness: string;
  definition: string;
  timing: string;
  startingPath: string;
  referralSource: string | null;
  freeformContext: string | null;
};

export function projectGuidedIntakePayload(payload: GuidedIntakePayloadV1): GuidedIntakeProjection {
  return {
    whatTheyWant: payload.answers.contentType === "short" ? "Short clips" : payload.answers.contentType === "long" ? "Long-form video" : payload.answers.contentType === "both" ? "Long-form and short clips" : "Needs help choosing a format",
    volume: VOLUME_LABELS[payload.answers.deliverableCountBand],
    recurrence: RECURRENCE_LABELS[payload.answers.recurrence],
    readiness: payload.derivedDimensions.productionReadiness === "ready" ? "Materials and editorial direction ready" : payload.derivedDimensions.productionReadiness === "needs_definition" ? "Needs help defining what is required" : "Some inputs or decisions are still open",
    definition: payload.answers.creativeFlexibility === "formula" ? "Clear, repeatable direction" : payload.answers.creativeFlexibility === "high" ? "Exploration is part of the work" : payload.answers.creativeFlexibility === "some" ? "Direction with room to adjust" : "Working style still open",
    timing: payload.answers.deadlineType === "specific" ? "Specific date" : payload.answers.deadlineType === "window" ? "Flexible window" : payload.answers.deadlineType === "cadence" ? "Ongoing cadence" : payload.answers.deadlineType === "urgent" ? "Urgent — feasibility review needed" : "Timing not decided",
    startingPath: GUIDED_STARTING_PATH_LABELS[payload.recommendedStartingPath],
    referralSource: payload.referralContext?.key === "pdbm"
      ? "Perfect Day Business Mentorship (PDBM)"
      : payload.referralContext?.source ?? null,
    freeformContext: payload.freeformContext,
  };
}
