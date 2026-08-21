import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  APP_BASE_PATH,
  AUTH_COOKIE_NAME,
  createLoginFingerprint,
  createSessionToken,
  decodePasswordHash,
  LOGIN_ROUTE,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
  verifyPasswordHmac,
  verifySessionToken,
} from "@/lib/auth-core";

type AuthEnv = CloudflareEnv & {
  AUTH_PASSWORD_HASH?: string;
  AUTH_PASSWORD_HASH_B64?: string;
  MB_AUTH_PASSWORD_HASH?: string;
  AUTH_PASSWORD_HMAC?: string;
  AUTH_PASSWORD_PEPPER?: string;
  AUTH_SESSION_SECRET?: string;
};

type AttemptRow = {
  attempts: number;
  window_started: number;
  blocked_until: number | null;
};

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

async function getAuthRuntime() {
  const { env } = await getCloudflareContext({ async: true });
  const authEnv = env as AuthEnv;

  const passwordHash = authEnv.AUTH_PASSWORD_HASH_B64
    ? decodePasswordHash(authEnv.AUTH_PASSWORD_HASH_B64)
    : (authEnv.MB_AUTH_PASSWORD_HASH ?? authEnv.AUTH_PASSWORD_HASH);

  const hasHmacVerifier = Boolean(
    authEnv.AUTH_PASSWORD_HMAC && authEnv.AUTH_PASSWORD_PEPPER,
  );

  if ((!hasHmacVerifier && !passwordHash) || !authEnv.AUTH_SESSION_SECRET) {
    throw new Error("MindBunker authentication secrets are not configured.");
  }

  return {
    db: authEnv.DB,
    passwordHmac: authEnv.AUTH_PASSWORD_HMAC,
    passwordHash,
    passwordPepper: authEnv.AUTH_PASSWORD_PEPPER,
    sessionSecret: authEnv.AUTH_SESSION_SECRET,
  };
}

async function getLoginKey(sessionSecret: string) {
  const requestHeaders = await headers();
  const forwardedIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = requestHeaders.get("cf-connecting-ip") ?? forwardedIp ?? "unknown";
  return createLoginFingerprint(ip, sessionSecret);
}

export async function isAuthenticated() {
  const { sessionSecret } = await getAuthRuntime();
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token, sessionSecret);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect(LOGIN_ROUTE);
  }
}

export async function getLoginGate() {
  const { db, sessionSecret } = await getAuthRuntime();
  const key = await getLoginKey(sessionSecret);
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      "SELECT attempts, window_started, blocked_until FROM auth_attempts WHERE fingerprint = ?1",
    )
    .bind(key)
    .first<AttemptRow>();

  return {
    allowed: !row?.blocked_until || row.blocked_until <= now,
    db,
    key,
    now,
    row,
  };
}

export async function recordLoginFailure(
  gate: Awaited<ReturnType<typeof getLoginGate>>,
) {
  const previous = gate.row;
  let attempts = 1;
  let windowStarted = gate.now;

  if (previous && gate.now - previous.window_started < WINDOW_SECONDS) {
    attempts = previous.attempts + 1;
    windowStarted = previous.window_started;
  }
  const blockedUntil =
    attempts >= MAX_ATTEMPTS ? gate.now + WINDOW_SECONDS : null;

  await gate.db
    .prepare(
      `INSERT INTO auth_attempts (fingerprint, attempts, window_started, blocked_until)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(fingerprint) DO UPDATE SET
         attempts = excluded.attempts,
         window_started = excluded.window_started,
         blocked_until = excluded.blocked_until`,
    )
    .bind(gate.key, attempts, windowStarted, blockedUntil)
    .run();
}

export async function clearLoginFailures(
  gate: Awaited<ReturnType<typeof getLoginGate>>,
) {
  await gate.db
    .prepare("DELETE FROM auth_attempts WHERE fingerprint = ?1")
    .bind(gate.key)
    .run();
}

export async function passwordMatches(password: string) {
  const { passwordHash, passwordHmac, passwordPepper } = await getAuthRuntime();

  if (passwordHmac && passwordPepper) {
    return verifyPasswordHmac(password, passwordHmac, passwordPepper);
  }

  if (!passwordHash) {
    return false;
  }

  return verifyPassword(password, passwordHash);
}

export async function createAuthSession() {
  const { sessionSecret } = await getAuthRuntime();
  const token = await createSessionToken(sessionSecret);
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: APP_BASE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export async function deleteAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: APP_BASE_PATH,
    maxAge: 0,
  });
}
