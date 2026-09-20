// Client Production Memory V1 -- pure rules. No DB, no framework imports, so
// every invariant is testable with plain node:test.
//
// Semantics (see config.ts): a memory is reusable, client-scoped knowledge.
// It never stands in for a job brief, source media, delivery or review.
// Optional means optional: an unknown fact stays NULL, never a placeholder.

import {
  PRODUCTION_MEMORY_STATUSES,
  type ProductionMemoryStatus,
} from "./config.ts";

export type ProductionMemoryInput = {
  name: string;
  useCase: string | null;
  status: ProductionMemoryStatus | null;
  approvalEvidence: string | null;
  preferenceNotes: string | null;
  recipeNotes: string | null;
  templateLocation: string | null;
  referenceVideoId: number | null;
  referenceUrl: string | null;
};

export type ProductionMemoryValidation =
  | { success: true; data: ProductionMemoryInput }
  | { success: false; errors: Record<string, string> };

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

export function isProductionMemoryStatus(value: unknown): value is ProductionMemoryStatus {
  return typeof value === "string" && (PRODUCTION_MEMORY_STATUSES as readonly string[]).includes(value);
}

// HTTPS-only, no credentials -- the same rule every other URL field in this
// codebase uses (video delivery/review URLs, source media), so a stored
// reference can always be rendered as a link.
export function normalizeReferenceUrl(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const candidate = value.trim();
  if (candidate === "") return { ok: true, value: null };
  if (candidate.length > 2_048) return { ok: false };
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return { ok: false };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false };
  }
}

/** Renders a template location as a link only when it is a safe HTTPS URL. */
export function templateLocationHref(location: string | null): string | null {
  if (!location) return null;
  const result = normalizeReferenceUrl(location);
  return result.ok ? result.value : null;
}

export function validateProductionMemoryInput(values: Record<string, unknown>): ProductionMemoryValidation {
  const errors: Record<string, string> = {};

  const name = typeof values.name === "string" ? values.name.trim().slice(0, 120) : "";
  if (name === "") errors.name = "Give this format a name.";

  let status: ProductionMemoryStatus | null = null;
  if (values.status !== undefined && values.status !== null && values.status !== "") {
    if (isProductionMemoryStatus(values.status)) status = values.status;
    else errors.status = "Choose one of the listed statuses, or leave it blank.";
  }

  const approvalEvidence = optionalText(values.approvalEvidence, 400);
  // Approval truth: "client approved" must say where that came from.
  if (status === "CLIENT_APPROVED" && approvalEvidence === null) {
    errors.approvalEvidence = "Client approved needs a short note on where the approval came from.";
  }

  const referenceUrl = normalizeReferenceUrl(values.referenceUrl);
  if (!referenceUrl.ok) errors.referenceUrl = "Reference link must be a valid HTTPS URL.";

  let referenceVideoId: number | null = null;
  const rawVideo = values.referenceVideoId;
  if (rawVideo !== undefined && rawVideo !== null && rawVideo !== "") {
    const id = typeof rawVideo === "number" ? rawVideo : Number(rawVideo);
    if (Number.isInteger(id) && id > 0) referenceVideoId = id;
    else errors.referenceVideoId = "Reference video must be a valid video.";
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      name,
      useCase: optionalText(values.useCase, 400),
      status,
      approvalEvidence,
      preferenceNotes: optionalText(values.preferenceNotes, 1_500),
      recipeNotes: optionalText(values.recipeNotes, 1_500),
      templateLocation: optionalText(values.templateLocation, 500),
      referenceVideoId,
      referenceUrl: referenceUrl.ok ? referenceUrl.value : null,
    },
  };
}

/**
 * A memory may only point at an example video that (a) exists, (b) belongs to
 * the SAME client, and (c) is a real deliverable -- never another client's
 * video and never an order's operational-container pseudo-video.
 */
export function checkReferenceVideo(
  video: { clientId: number | null; isOperationalContainer: boolean } | null,
  memoryClientId: number,
): string | null {
  if (!video) return "That reference video doesn't exist.";
  if (video.clientId !== memoryClientId) return "That video belongs to a different client.";
  if (video.isOperationalContainer) return "A batch container can't be a reference example.";
  return null;
}

/** Friendly pre-check; the DB unique index on (client_id, name) is the hard guarantee. */
export function isDuplicateMemoryName(
  existing: readonly { id: number; name: string }[],
  name: string,
  excludeId: number | null = null,
): boolean {
  const wanted = name.trim().toLowerCase();
  return existing.some((row) => row.id !== excludeId && row.name.trim().toLowerCase() === wanted);
}
