// Client Portal Identity -- pure token/reset helpers (Sprint 1.2.2).
//
// Mirrors the shape of gateway/core.ts's token helpers (random token ->
// base64url, SHA-256 hex hash for storage/lookup) rather than inventing a
// new pattern -- this is the same "opaque bearer token, only its hash ever
// touches the database" construction already used for gateway_invitations.
// No DB access here; see data.ts for the D1-touching operations that use
// these.

const encoder = new TextEncoder();
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
export const PORTAL_RESET_TOKEN_TTL_MS = 60 * 60 * 1_000; // 1 hour

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
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createPortalResetToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(RESET_TOKEN_BYTES)));
}

export function isPortalResetToken(value: unknown): value is string {
  return typeof value === "string" && RESET_TOKEN_PATTERN.test(value);
}

export async function hashPortalResetToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * A minimal, deliberately conservative email normalizer used ONLY to key
 * portal login/reset lookups -- trims and lowercases. Does not attempt full
 * RFC validation; clients.email is free-text CRM data entered by the
 * operator, not a self-serve signup field.
 */
export function normalizePortalEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isPortalPasswordCandidate(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}
