export type InstagramProfileInput = {
  username: string;
  biography: string | null;
  profilePictureUrl: string | null;
};

type InstagramProfileInputResult =
  | { success: true; data: InstagramProfileInput }
  | { success: false; error: string };

export function normalizeInstagramUsername(value: unknown) {
  if (typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate) return null;

  if (/^https?:\/\//iu.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (!/(^|\.)instagram\.com$/iu.test(url.hostname)) return null;
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/^@/u, "").trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/u.test(candidate) ? candidate : null;
}

export function normalizeProfilePictureUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 2_048);
  } catch {
    return undefined;
  }
}

export function validateInstagramProfileInput(values: {
  username: unknown;
  biography?: unknown;
  profilePictureUrl?: unknown;
}): InstagramProfileInputResult {
  const username = normalizeInstagramUsername(values.username);
  if (!username) {
    return { success: false, error: "Enter a valid Instagram username." };
  }

  const profilePictureUrl = normalizeProfilePictureUrl(
    values.profilePictureUrl,
  );
  if (profilePictureUrl === undefined) {
    return { success: false, error: "Profile photo must use a valid HTTPS URL." };
  }

  const biography = typeof values.biography === "string"
    ? values.biography.trim().slice(0, 2_200) || null
    : null;
  return {
    success: true,
    data: { username, biography, profilePictureUrl },
  };
}
