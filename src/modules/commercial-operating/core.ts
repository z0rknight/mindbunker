import {
  COMMERCIAL_OFFER_LABELS,
  COMMERCIAL_OFFER_TYPES,
  type CommercialOfferType,
} from "../quotes/config.ts";
import {
  COMMERCIAL_CAPACITY_STATES,
  type CommercialCapacityState,
} from "./config.ts";

const encoder = new TextEncoder();
const OFFER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function isCommercialOfferType(value: unknown): value is CommercialOfferType {
  return typeof value === "string" && (COMMERCIAL_OFFER_TYPES as readonly string[]).includes(value);
}

export function isCommercialCapacityState(value: unknown): value is CommercialCapacityState {
  return typeof value === "string" && (COMMERCIAL_CAPACITY_STATES as readonly string[]).includes(value);
}

export function offerLabel(value: CommercialOfferType | null): string {
  return value ? COMMERCIAL_OFFER_LABELS[value] : "Not confirmed";
}

export function validateHttpsUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 1_000) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isPublicOfferToken(value: unknown): value is string {
  return typeof value === "string" && OFFER_TOKEN_PATTERN.test(value);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function createPublicOfferToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashPublicOfferToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type CommercialOfferDecision = {
  offerType: CommercialOfferType;
  reason: string | null;
  decidedAt: string;
  actor: "admin";
};

export function parseCommercialOfferDecision(payloadJson: string | null): CommercialOfferDecision | null {
  if (!payloadJson) return null;
  try {
    const value: unknown = JSON.parse(payloadJson);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (!isCommercialOfferType(row.offerType) || typeof row.decidedAt !== "string" || row.actor !== "admin") return null;
    return {
      offerType: row.offerType,
      reason: typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : null,
      decidedAt: row.decidedAt,
      actor: "admin",
    };
  } catch {
    return null;
  }
}
