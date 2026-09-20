// Brief C ("Final Local Ingest / Live Readiness") §8: a Project -> Video ->
// save/close must return to that Project, while a Productivity -> Video ->
// close regression must keep returning to Productivity. The mechanism is a
// `returnTo` query/prop carrying an internal path -- this function is the
// single gate every caller must pass a candidate through before honoring
// it as a redirect target. SECURITY: only ever treat a value as a safe
// internal path when this returns true. Rejects anything that could be
// interpreted as pointing off-site (protocol-relative "//host", an
// embedded "scheme://", a backslash which some browsers still treat as a
// path separator, or a value that doesn't even start with a single "/").
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 300) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("://")) return false;
  // Control characters (including embedded newlines/tabs, sometimes used to
  // smuggle a second scheme past naive checks) are never valid in a path.
  if (/[\x00-\x1f]/.test(value)) return false;
  return true;
}

/**
 * A validated internal origin path from a pathname + query string (no leading
 * "?"), or undefined when it would not be a safe/short internal path. Used by
 * links that open the Video Workspace from an inspection surface so the close
 * action returns to that exact view.
 */
export function originPathFrom(pathname: string, search: string): string | undefined {
  const origin = search ? `${pathname}?${search}` : pathname;
  return isSafeInternalPath(origin) ? origin : undefined;
}
