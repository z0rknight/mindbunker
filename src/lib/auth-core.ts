export const AUTH_COOKIE_NAME = "mb_session";
export const APP_BASE_PATH = "/mindbunker";
export const LOGIN_ROUTE = "/login";
export const LOGIN_PATH = `${APP_BASE_PATH}${LOGIN_ROUTE}`;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_VERSION = "v1";
const PASSWORD_HASH_VERSION = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 310_000;
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
