import { cleanEmail } from "../booking/core.ts";
import type { ReferralProgram } from "../referrals/core.ts";

export const GUIDED_INTAKE_V2_MODEL_VERSION = "rmedia-guided-intake-v2";

const VALUES = {
  situation: ["steady_flow", "defined_project", "backlog", "specialist", "exploring"],
  contentShape: ["short", "long", "both", "campaign", "other", "unsure"],
  workload: ["one", "small_batch", "backlog", "ongoing_weekly", "ongoing_monthly", "ongoing_flexible", "unsure"],
  priority: ["speed", "consistency", "flexibility", "quality_polish", "clarity_accuracy", "unsure"],
  formatMaturity: ["defined", "developing", "discovery", "unsure"],
  specialistContext: ["none", "technical_content", "footage_audio_repair", "workflow_system", "creative_unusual", "other", "unsure"],
} as const;

type ValueOf<K extends keyof typeof VALUES> = (typeof VALUES)[K][number];

export type GuidedIntakeV2Answers = {
  situation: ValueOf<"situation">;
  contentShape: ValueOf<"contentShape">;
  workload: ValueOf<"workload">;
  priority: ValueOf<"priority">;
  formatMaturity: ValueOf<"formatMaturity">;
  specialistContext: ValueOf<"specialistContext">;
  contact: { name: string; email: string; company: string | null };
};

export type GuidedIntakeV2StartingPath =
  | "REPEATABLE_PRODUCTION"
  | "DEFINED_PROJECT"
  | "PILOT_SETUP"
  | "SPECIALIST_COLLABORATION"
  | "FLEXIBLE_COLLABORATION"
  | "HUMAN_REVIEW_REQUIRED";

export const GUIDED_INTAKE_V2_PATH_LABELS: Record<GuidedIntakeV2StartingPath, string> = {
  REPEATABLE_PRODUCTION: "Repeatable production",
  DEFINED_PROJECT: "Defined project",
  PILOT_SETUP: "Pilot / setup",
  SPECIALIST_COLLABORATION: "Specialist collaboration",
  FLEXIBLE_COLLABORATION: "Flexible collaboration",
  HUMAN_REVIEW_REQUIRED: "Conversation first",
};

export type LeadIntentV2 = {
  relationshipShape: "RECURRING" | "PROJECT" | "EXPLORATORY" | "UNKNOWN";
  needCharacter: "STANDARD_PRODUCTION" | "BACKLOG_CLEARANCE" | "CREATIVE_DEVELOPMENT" | "TECHNICAL_SPECIALIST" | "SYSTEM_SETUP" | "OTHER" | "UNKNOWN";
  contentShape: "SHORT" | "LONG" | "BOTH" | "CAMPAIGN_COMMERCIAL" | "OTHER" | "UNKNOWN";
  workload: "ONE" | "SMALL_BATCH" | "BACKLOG" | "ONGOING_WEEKLY" | "ONGOING_MONTHLY" | "ONGOING_FLEXIBLE" | "UNKNOWN";
  primaryNeed: "CAPACITY" | "CONSISTENCY" | "BACKLOG_CLEARANCE" | "CREATIVE_DEVELOPMENT" | "TECHNICAL_PROBLEM" | "SYSTEM_SETUP" | "OTHER" | "UNKNOWN";
  priority: "SPEED" | "CONSISTENCY" | "FLEXIBILITY" | "QUALITY_POLISH" | "CLARITY_ACCURACY" | "NOT_SURE";
  formatMaturity: "DEFINED" | "DEVELOPING" | "DISCOVERY" | "UNKNOWN";
  specialistSignal: "NONE" | "TECHNICAL_CONTENT" | "FOOTAGE_AUDIO_REPAIR" | "WORKFLOW_SYSTEM" | "CREATIVE_UNUSUAL" | "OTHER" | "UNKNOWN";
  likelyPath: GuidedIntakeV2StartingPath;
  confidence: "SUPPORTED" | "PARTIAL";
  evidence: string[];
};

export type GuidedIntakePayloadV2 = {
  schemaVersion: 1;
  modelVersion: typeof GUIDED_INTAKE_V2_MODEL_VERSION;
  answers: GuidedIntakeV2Answers;
  leadIntent: LeadIntentV2;
  referralContext: { key: string; source: string } | null;
  freeformContext: string | null;
  submissionContext: {
    channel: "startvideo";
    surface: "startvideo";
    flowVersion: 2;
    answerSchemaVersion: 2;
    derivedIntentVersion: "lead-intent-v2";
  };
};

export type ValidatedGuidedIntakeV2Submission = {
  answers: GuidedIntakeV2Answers;
  freeformContext: string | null;
  idempotencyKey: string;
  ref: string | null;
};

export type GuidedIntakeV2Validation =
  | { success: true; data: ValidatedGuidedIntakeV2Submission }
  | { success: false; errors: Record<string, string> };

const REQUEST_KEYS = ["answers", "idempotencyKey", "ref", "company_website"] as const;
const ANSWER_KEYS = ["situation", "contentShape", "workload", "priority", "formatMaturity", "specialistContext", "contact", "freeformContext"] as const;
const CONTACT_KEYS = ["name", "email", "company"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function enumValue<K extends keyof typeof VALUES>(key: K, value: unknown): ValueOf<K> | null {
  return typeof value === "string" && (VALUES[key] as readonly string[]).includes(value)
    ? (value as ValueOf<K>)
    : null;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim() || null;
}

export function validateGuidedIntakeV2Submission(value: unknown): GuidedIntakeV2Validation {
  const errors: Record<string, string> = {};
  if (!isRecord(value) || !hasOnlyKeys(value, REQUEST_KEYS)) {
    return { success: false, errors: { request: "Unexpected submission structure." } };
  }
  if (!isRecord(value.answers) || !hasOnlyKeys(value.answers, ANSWER_KEYS)) {
    return { success: false, errors: { answers: "Unexpected answer structure." } };
  }
  const raw = value.answers;
  if (!isRecord(raw.contact) || !hasOnlyKeys(raw.contact, CONTACT_KEYS)) {
    return { success: false, errors: { contact: "Unexpected contact structure." } };
  }

  const scalars = {
    situation: enumValue("situation", raw.situation),
    contentShape: enumValue("contentShape", raw.contentShape),
    workload: enumValue("workload", raw.workload),
    priority: enumValue("priority", raw.priority),
    formatMaturity: enumValue("formatMaturity", raw.formatMaturity),
    specialistContext: enumValue("specialistContext", raw.specialistContext),
  };
  for (const [key, answer] of Object.entries(scalars)) {
    if (answer === null) errors[key] = "Choose one of the available answers.";
  }

  const name = typeof raw.contact.name === "string" ? raw.contact.name.trim().slice(0, 160) : "";
  if (!name) errors.name = "Your name is required.";
  const email = cleanEmail(raw.contact.email);
  if (!email) errors.email = "Enter a valid email address.";
  const company = optionalText(raw.contact.company, 160);
  if (raw.contact.company && company === null) errors.company = "Business or website is too long.";
  const freeformContext = optionalText(raw.freeformContext, 1_200);
  if (raw.freeformContext && freeformContext === null) errors.freeformContext = "Additional context is too long.";

  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/u.test(idempotencyKey)) errors.idempotencyKey = "Invalid submission identity.";
  const ref = value.ref === null || value.ref === undefined || value.ref === ""
    ? null
    : typeof value.ref === "string" && value.ref.length <= 40
      ? value.ref
      : null;

  if (Object.keys(errors).length > 0 || Object.values(scalars).some((answer) => answer === null) || !email) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      answers: {
        ...(scalars as Omit<GuidedIntakeV2Answers, "contact">),
        contact: { name, email, company },
      },
      freeformContext,
      idempotencyKey,
      ref,
    },
  };
}

export function deriveLeadIntentV2(answers: GuidedIntakeV2Answers): LeadIntentV2 {
  const evidence: string[] = [];
  const unknownCount = [answers.situation, answers.contentShape, answers.workload, answers.priority, answers.formatMaturity, answers.specialistContext]
    .filter((value) => value === "unsure" || value === "exploring").length;

  let relationshipShape: LeadIntentV2["relationshipShape"] = "UNKNOWN";
  if (["ongoing_weekly", "ongoing_monthly", "ongoing_flexible"].includes(answers.workload) || answers.situation === "steady_flow") {
    relationshipShape = "RECURRING";
    evidence.push("They selected an ongoing production situation or cadence.");
  } else if (["one", "small_batch", "backlog"].includes(answers.workload) || ["defined_project", "backlog"].includes(answers.situation)) {
    relationshipShape = "PROJECT";
    evidence.push("They described a bounded piece, batch, or backlog.");
  } else if (answers.situation === "exploring") {
    relationshipShape = "EXPLORATORY";
    evidence.push("They are still working out what kind of help is needed.");
  }

  const contentShape: LeadIntentV2["contentShape"] =
    answers.contentShape === "short" ? "SHORT"
      : answers.contentShape === "long" ? "LONG"
        : answers.contentShape === "both" ? "BOTH"
          : answers.contentShape === "campaign" ? "CAMPAIGN_COMMERCIAL"
            : answers.contentShape === "other" ? "OTHER"
              : "UNKNOWN";

  const workload: LeadIntentV2["workload"] =
    answers.workload === "one" ? "ONE"
      : answers.workload === "small_batch" ? "SMALL_BATCH"
        : answers.workload === "backlog" ? "BACKLOG"
          : answers.workload === "ongoing_weekly" ? "ONGOING_WEEKLY"
            : answers.workload === "ongoing_monthly" ? "ONGOING_MONTHLY"
              : answers.workload === "ongoing_flexible" ? "ONGOING_FLEXIBLE"
                : "UNKNOWN";

  const specialistSignal: LeadIntentV2["specialistSignal"] =
    answers.specialistContext === "technical_content" ? "TECHNICAL_CONTENT"
      : answers.specialistContext === "footage_audio_repair" ? "FOOTAGE_AUDIO_REPAIR"
        : answers.specialistContext === "workflow_system" ? "WORKFLOW_SYSTEM"
          : answers.specialistContext === "creative_unusual" ? "CREATIVE_UNUSUAL"
            : answers.specialistContext === "other" ? "OTHER"
              : answers.specialistContext === "unsure" ? "UNKNOWN"
                : "NONE";
  if (!["NONE", "UNKNOWN"].includes(specialistSignal)) {
    evidence.push(`Specific collaboration signal: ${specialistSignal.toLowerCase().replaceAll("_", " ")}.`);
  }

  let needCharacter: LeadIntentV2["needCharacter"] = "UNKNOWN";
  let primaryNeed: LeadIntentV2["primaryNeed"] = "UNKNOWN";
  if (answers.specialistContext === "workflow_system") {
    needCharacter = "SYSTEM_SETUP";
    primaryNeed = "SYSTEM_SETUP";
  } else if (!["none", "unsure"].includes(answers.specialistContext)) {
    needCharacter = "TECHNICAL_SPECIALIST";
    primaryNeed = "TECHNICAL_PROBLEM";
  } else if (answers.situation === "backlog" || answers.workload === "backlog") {
    needCharacter = "BACKLOG_CLEARANCE";
    primaryNeed = "BACKLOG_CLEARANCE";
  } else if (answers.formatMaturity === "discovery") {
    needCharacter = "CREATIVE_DEVELOPMENT";
    primaryNeed = "CREATIVE_DEVELOPMENT";
  } else if (relationshipShape === "RECURRING") {
    needCharacter = "STANDARD_PRODUCTION";
    primaryNeed = answers.priority === "consistency" ? "CONSISTENCY" : "CAPACITY";
  } else if (relationshipShape === "PROJECT") {
    needCharacter = "STANDARD_PRODUCTION";
    primaryNeed = "OTHER";
  } else if (answers.situation === "specialist") {
    needCharacter = "OTHER";
    primaryNeed = "OTHER";
  }

  const priority: LeadIntentV2["priority"] =
    answers.priority === "speed" ? "SPEED"
      : answers.priority === "consistency" ? "CONSISTENCY"
        : answers.priority === "flexibility" ? "FLEXIBILITY"
          : answers.priority === "quality_polish" ? "QUALITY_POLISH"
            : answers.priority === "clarity_accuracy" ? "CLARITY_ACCURACY"
              : "NOT_SURE";
  if (priority !== "NOT_SURE") evidence.push(`Their stated priority is ${priority.toLowerCase().replaceAll("_", " ")}.`);

  const formatMaturity: LeadIntentV2["formatMaturity"] =
    answers.formatMaturity === "defined" ? "DEFINED"
      : answers.formatMaturity === "developing" ? "DEVELOPING"
        : answers.formatMaturity === "discovery" ? "DISCOVERY"
          : "UNKNOWN";

  let likelyPath: GuidedIntakeV2StartingPath = "HUMAN_REVIEW_REQUIRED";
  if (unknownCount >= 4) {
    likelyPath = "HUMAN_REVIEW_REQUIRED";
  } else if (!["NONE", "UNKNOWN"].includes(specialistSignal)) {
    likelyPath = "SPECIALIST_COLLABORATION";
  } else if (relationshipShape === "RECURRING" && formatMaturity === "DEFINED") {
    likelyPath = "REPEATABLE_PRODUCTION";
  } else if (relationshipShape === "PROJECT" && formatMaturity !== "DISCOVERY") {
    likelyPath = "DEFINED_PROJECT";
  } else if (formatMaturity === "DISCOVERY" && relationshipShape !== "UNKNOWN") {
    likelyPath = "PILOT_SETUP";
  } else if (relationshipShape === "EXPLORATORY" || formatMaturity === "DEVELOPING") {
    likelyPath = "FLEXIBLE_COLLABORATION";
  }

  const confidence: LeadIntentV2["confidence"] = unknownCount >= 2 || relationshipShape === "UNKNOWN" ? "PARTIAL" : "SUPPORTED";
  if (confidence === "PARTIAL") evidence.push("Several choices remain open, so the interpretation needs human review.");

  return {
    relationshipShape,
    needCharacter,
    contentShape,
    workload,
    primaryNeed,
    priority,
    formatMaturity,
    specialistSignal,
    likelyPath,
    confidence,
    evidence,
  };
}

export function buildGuidedIntakeV2Payload(
  data: ValidatedGuidedIntakeV2Submission,
  referral: ReferralProgram | null,
): GuidedIntakePayloadV2 {
  return {
    schemaVersion: 1,
    modelVersion: GUIDED_INTAKE_V2_MODEL_VERSION,
    answers: data.answers,
    leadIntent: deriveLeadIntentV2(data.answers),
    referralContext: referral ? { key: referral.key, source: referral.source } : null,
    freeformContext: data.freeformContext,
    submissionContext: {
      channel: "startvideo",
      surface: "startvideo",
      flowVersion: 2,
      answerSchemaVersion: 2,
      derivedIntentVersion: "lead-intent-v2",
    },
  };
}

export function isGuidedIntakePayloadV2(value: unknown): value is GuidedIntakePayloadV2 {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.modelVersion !== GUIDED_INTAKE_V2_MODEL_VERSION) return false;
  if (!isRecord(value.submissionContext) || value.submissionContext.channel !== "startvideo" || value.submissionContext.surface !== "startvideo" || value.submissionContext.flowVersion !== 2) return false;
  if (!isRecord(value.leadIntent) || !isRecord(value.answers)) return false;
  const validated = validateGuidedIntakeV2Submission({
    answers: { ...value.answers, freeformContext: value.freeformContext },
    idempotencyKey: "historical-v2-intake",
    ref: null,
    company_website: "",
  });
  return validated.success && JSON.stringify(deriveLeadIntentV2(validated.data.answers)) === JSON.stringify(value.leadIntent);
}

export function serviceInterestForGuidedIntakeV2(contentShape: GuidedIntakeV2Answers["contentShape"]): "short-form" | "long-form" | "other" | null {
  if (contentShape === "short") return "short-form";
  if (contentShape === "long") return "long-form";
  if (["both", "campaign", "other"].includes(contentShape)) return "other";
  return null;
}

export function buildGuidedIntakeV2Description(payload: GuidedIntakePayloadV2) {
  return [
    "Guided intake V2 submitted",
    GUIDED_INTAKE_V2_PATH_LABELS[payload.leadIntent.likelyPath],
    payload.leadIntent.relationshipShape.toLowerCase(),
    payload.leadIntent.workload.toLowerCase().replaceAll("_", " "),
  ].join(" · ");
}
