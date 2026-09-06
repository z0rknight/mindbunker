export const AUTH_COOKIE_NAME = "mb_session";
export const CLIENT_AUTH_COOKIE_NAME = "mb_client_session";
export const APP_BASE_PATH = "/mindbunker";
export const LOGIN_ROUTE = "/login";
export const LOGIN_PATH = `${APP_BASE_PATH}${LOGIN_ROUTE}`;

// CRM CONTROL PLANE MIGRATION (Sep 2026): the canonical, publicly reachable
// Client Portal login -- the dedicated white-wave-1af9 Worker at
// emmanueldarosa.com/client*, NOT the legacy /mindbunker/client/[token]
// Vault (see CLIENT_PORTAL_PATH_PREFIX in modules/gateway/config.ts, a
// deliberately separate mechanism this constant does not touch or
// replace). A full, absolute, cross-origin URL is required here, not a
// relative "/client/login" -- next/link's own addBasePath (verified in
// node_modules/next/dist/client/link.js and add-base-path.js) rewrites
// EVERY relative Link href using the CURRENT build's basePath before it
// ever reaches the browser. Any operator-side CRM page (basePath
// "/mindbunker") that used a relative Link to "/client/login" would
// silently render as "/mindbunker/client/login" -- the exact obsolete URL
// this migration exists to stop pointing at. An absolute, fully-qualified
// URL is untouched by addPathPrefix regardless of which target renders
// the page it's used from.
export const CANONICAL_CLIENT_PORTAL_LOGIN_URL = "https://emmanueldarosa.com/client/login";

// Release config (Sep 2026 separate-Worker release) -----------------------
//
// process.env.MB_DEPLOY_TARGET is a build-time-only literal ("client" or
// "operator"), inlined by next.config.ts's `env` option -- see the long
// comment there for why this specific mechanism was chosen over a
// Cloudflare Worker runtime var. "client" means this build is the
// dedicated public Client Worker (canonical URL served at bare /client);
// anything else means the private MindBunker operator Worker, where
// nothing below changes from before this release.
export const IS_CLIENT_DEPLOY_TARGET = process.env.MB_DEPLOY_TARGET === "client";

// The client session cookie (mb_client_session) must be scoped to
// whichever path this Worker actually serves the Client Portal at --
// /client on the public Client Worker, /mindbunker on the private
// operator Worker (where the legacy token-based /client/[token] Vault
// still lives). Getting this wrong doesn't fail loudly: the browser
// silently never sends the cookie back on requests to a path it doesn't
// match.
export const CLIENT_COOKIE_PATH = IS_CLIENT_DEPLOY_TARGET ? "/client" : APP_BASE_PATH;

// Static assets under public/ (referenced via next/image `src` or
// metadata like `manifest`) are NOT automatically basePath-prefixed by
// Next for local references the way internal navigation (redirect/Link)
// is -- every existing reference in this app already hardcodes
// APP_BASE_PATH manually for exactly this reason (see
// src/app/client/login/page.tsx's logo, src/app/layout.tsx's manifest
// link). This constant makes that prefix correct for whichever build is
// currently compiling, instead of assuming /mindbunker always.
//
// PIPELINE FIX ROUND 2 (live blank-body rescue): this used to be "" for
// the client target. That was wrong and is the proven root cause of the
// live blank body -- emmanueldarosa.com/client* is the ONLY Cloudflare
// route forwarded to this Worker (verified live, must never be
// broadened), so a request for anything at a bare root path (an asset,
// a cover image) never reaches this Worker at all; Cloudflare's edge
// returns its own empty-body 404 before the Worker's code, middleware
// included, ever runs. Every asset this build references now has to
// physically resolve under /client/... instead. next.config.ts's
// assetPrefix handles Next's own _next/static/* output; this constant
// handles the app's own explicit references (login logo, cover images
// in media/core.ts). scripts/prepare-client-assets.mjs is the other half
// -- it physically relocates the built files to match.
export const STATIC_BASE_PATH = IS_CLIENT_DEPLOY_TARGET ? "/client" : APP_BASE_PATH;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const CLIENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_VERSION = "v1";
// Distinct version tag (not just a distinct cookie) so a client session
// token and an admin session token can never be swapped/replayed against
// the wrong verifier even if a cookie name were ever confused.
const CLIENT_SESSION_VERSION = "cs1";
const PASSWORD_HASH_VERSION = "pbkdf2-sha256";
// P0 ENABLE PORTAL CRASH PATCH (Sep 2026): this was 310_000 (OWASP's
// PBKDF2-SHA256 recommendation) until this round. Cloudflare Workers'
// crypto.subtle.deriveBits hard-caps PBKDF2 at 100,000 iterations --
// confirmed via workerd's own error text ("NotSupportedError: Pbkdf2
// failed: iteration counts above 100000 are not supported (requested
// 310000)"), not guessed. Node's WebCrypto (what every unit test in this
// repo runs under) enforces no such cap, so createPasswordHash/
// verifyPassword's own tests passed at 310_000 the whole time -- the
// throw only ever happened on the real Workers runtime, every single
// time setClientPortalPassword called createPasswordHash, before any D1
// write. 100_000 is the practical ceiling on this platform; see also
// DUMMY_PASSWORD_HASH in modules/client-portal/auth-data.ts, which
// embeds this same number and had the identical latent bug on the
// client-login timing-safe-reject path.
const PASSWORD_HASH_ITERATIONS = 100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importHmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

async function signHmac(value: string, secret: string) {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return new Uint8Array(signature);
}

async function verifyHmac(value: string, signature: Uint8Array, secret: string) {
  const key = await importHmacKey(secret, ["verify"]);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature as unknown as BufferSource,
    encoder.encode(value),
  );
}

export async function createSessionToken(
  secret: string,
  nowMilliseconds = Date.now(),
) {
  const expiresAt =
    Math.floor(nowMilliseconds / 1000) + SESSION_MAX_AGE_SECONDS;
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = `${SESSION_VERSION}.${expiresAt}.${bytesToBase64Url(nonce)}`;
  const signature = await signHmac(payload, secret);

  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowMilliseconds = Date.now(),
) {
  if (!token || !secret) {
    return false;
  }

  const [version, expiresValue, nonce, encodedSignature, ...extra] =
    token.split(".");
  const expiresAt = Number(expiresValue);

  if (
    extra.length > 0 ||
    version !== SESSION_VERSION ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(nowMilliseconds / 1000) ||
    !nonce ||
    !encodedSignature
  ) {
    return false;
  }

  try {
    const payload = `${version}.${expiresValue}.${nonce}`;
    return await verifyHmac(
      payload,
      base64UrlToBytes(encodedSignature),
      secret,
    );
  } catch {
    return false;
  }
}

// Client Portal Identity (Sprint 1.2.2) -----------------------------------
//
// Same signed-opaque-token construction as the admin session token above,
// with two differences: the clientId is embedded IN the signed payload (so
// it can never be trusted until the HMAC verifies -- a client cannot forge
// or edit which clientId their cookie claims), and the version tag is
// distinct ("cs1" vs "v1") so the two token families can never be confused
// or cross-verified even though they may share the same signing secret.
export async function createClientSessionToken(
  clientId: number,
  secret: string,
  nowMilliseconds = Date.now(),
) {
  const expiresAt =
    Math.floor(nowMilliseconds / 1000) + CLIENT_SESSION_MAX_AGE_SECONDS;
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = `${CLIENT_SESSION_VERSION}.${clientId}.${expiresAt}.${bytesToBase64Url(nonce)}`;
  const signature = await signHmac(payload, secret);

  return `${payload}.${bytesToBase64Url(signature)}`;
}

export type VerifiedClientSession = {
  clientId: number;
  /** Unix seconds this token expires at -- expiresAt - CLIENT_SESSION_MAX_AGE_SECONDS
   * recovers when it was issued, without needing a separate field in the payload. */
  expiresAtSeconds: number;
};

/**
 * Returns the verified session on success, or `false` on any failure
 * (missing/expired/malformed/forged token). The returned clientId is only
 * ever produced after the HMAC signature over the full payload -- including
 * the clientId itself -- has verified, so callers can trust it directly for
 * authorization without a second lookup. Callers that need to detect a
 * password change/revocation that happened AFTER this token was issued
 * (see client-portal-session.ts) can reconstruct the issue time from
 * expiresAtSeconds - CLIENT_SESSION_MAX_AGE_SECONDS.
 */
export async function verifyClientSessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowMilliseconds = Date.now(),
): Promise<VerifiedClientSession | false> {
  if (!token || !secret) {
    return false;
  }

  const [version, clientIdValue, expiresValue, nonce, encodedSignature, ...extra] =
    token.split(".");
  const clientId = Number(clientIdValue);
  const expiresAt = Number(expiresValue);

  if (
    extra.length > 0 ||
    version !== CLIENT_SESSION_VERSION ||
    !Number.isSafeInteger(clientId) ||
    clientId <= 0 ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(nowMilliseconds / 1000) ||
    !nonce ||
    !encodedSignature
  ) {
    return false;
  }

  try {
    const payload = `${version}.${clientIdValue}.${expiresValue}.${nonce}`;
    const valid = await verifyHmac(
      payload,
      base64UrlToBytes(encodedSignature),
      secret,
    );
    return valid ? { clientId, expiresAtSeconds: expiresAt } : false;
  } catch {
    return false;
  }
}

export async function createPasswordHash(
  password: string,
  iterations = PASSWORD_HASH_ITERATIONS,
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256,
  );

  return [
    PASSWORD_HASH_VERSION,
    iterations,
    bytesToBase64Url(salt),
    bytesToBase64Url(new Uint8Array(derived)),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [version, iterationValue, encodedSalt, encodedHash, ...extra] =
    storedHash.split("$");
  const iterations = Number(iterationValue);

  if (
    extra.length > 0 ||
    version !== PASSWORD_HASH_VERSION ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !encodedSalt ||
    !encodedHash
  ) {
    return false;
  }

  try {
    const salt = base64UrlToBytes(encodedSalt);
    const expected = base64UrlToBytes(encodedHash);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derived = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations },
        keyMaterial,
        expected.byteLength * 8,
      ),
    );

    if (derived.byteLength !== expected.byteLength) {
      return false;
    }

    let mismatch = 0;
    for (let index = 0; index < derived.length; index += 1) {
      mismatch |= derived[index] ^ expected[index];
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}

export function decodePasswordHash(encodedHash: string) {
  try {
    return decoder.decode(base64UrlToBytes(encodedHash));
  } catch {
    return undefined;
  }
}

export async function verifyPasswordHmac(
  password: string,
  encodedExpected: string,
  encodedPepper: string,
) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      base64UrlToBytes(encodedPepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const provided = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`password:${password}`),
      ),
    );
    const expected = base64UrlToBytes(encodedExpected);

    if (provided.byteLength !== expected.byteLength) {
      return false;
    }

    let mismatch = 0;
    for (let index = 0; index < provided.length; index += 1) {
      mismatch |= provided[index] ^ expected[index];
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}

export async function createLoginFingerprint(value: string, secret: string) {
  return bytesToBase64Url(await signHmac(`login:${value}`, secret));
}
