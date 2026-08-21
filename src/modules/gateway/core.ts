import {
  GATEWAY_TOKEN_BYTES,
  OPPORTUNITY_STAGES,
  SERVICE_INTEREST_OPTIONS,
  type OpportunityStage,
  type ServiceInterest,
} from "./config.ts";

const encoder = new TextEncoder();
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createGatewayToken() {
  return bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(GATEWAY_TOKEN_BYTES)),
  );
}

export function isGatewayToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export async function hashGatewayToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export type GatewayAccessStatus = "active" | "expired" | "revoked";

export function getGatewayAccessStatus(
  invitation: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
): GatewayAccessStatus {
  if (invitation.revokedAt) {
    return "revoked";
  }
  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

export function isOpportunityStage(value: unknown): value is OpportunityStage {
  return (
    typeof value === "string" &&
    (OPPORTUNITY_STAGES as readonly string[]).includes(value)
  );
}

export function isServiceInterest(value: unknown): value is ServiceInterest {
  return (
    typeof value === "string" &&
    SERVICE_INTEREST_OPTIONS.some((option) => option.value === value)
  );
}

export function stageAfterGatewayInvitation(
  currentStage: OpportunityStage,
): OpportunityStage {
  return currentStage === "new" || currentStage === "qualified"
    ? "invited"
    : currentStage;
}

function readText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export type BriefingInput = {
  serviceInterest: ServiceInterest;
  projectSummary: string;
  objective: string;
  contentVolume: string;
  references: string;
  timeline: string;
  existingAssets: string;
  notes: string;
};

export type BriefingValidation =
  | { success: true; data: BriefingInput }
  | { success: false; errors: Record<string, string> };

export function validateBriefingInput(
  values: Record<string, unknown>,
): BriefingValidation {
  const errors: Record<string, string> = {};
  const serviceInterest = values.serviceInterest;
  const projectSummary = readText(values.projectSummary, 800);
  const objective = readText(values.objective, 800);
  const contentVolume = readText(values.contentVolume, 300);
  const references = readText(values.references, 1_200);
  const timeline = readText(values.timeline, 300);
  const existingAssets = readText(values.existingAssets, 800);
  const notes = readText(values.notes, 1_200);

  if (!isServiceInterest(serviceInterest)) {
    errors.serviceInterest = "Choose the closest service.";
  }
  if (projectSummary.length < 3) {
    errors.projectSummary = "Tell us what you are creating.";
  }
  if (objective.length < 3) {
    errors.objective = "Tell us the main objective.";
  }

  if (Object.keys(errors).length > 0 || !isServiceInterest(serviceInterest)) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      serviceInterest,
      projectSummary,
      objective,
      contentVolume,
      references,
      timeline,
      existingAssets,
      notes,
    },
  };
}
