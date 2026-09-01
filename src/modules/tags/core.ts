// Wave 4E: simple string tags, no taxonomy table. A Video inherits its
// Project's tags by default; tagsOverride is JSON {added, removed} so a
// Project tag edit still propagates to every Video that hasn't locally
// touched it.
export type TagsOverride = { added: string[]; removed: string[] };

export function parseTagList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serializeTagList(tags: string[]): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }
  return result.join(", ");
}

export function parseTagsOverride(raw: string | null): TagsOverride {
  if (!raw) return { added: [], removed: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      added: Array.isArray(parsed?.added) ? parsed.added.filter((t: unknown) => typeof t === "string") : [],
      removed: Array.isArray(parsed?.removed) ? parsed.removed.filter((t: unknown) => typeof t === "string") : [],
    };
  } catch {
    return { added: [], removed: [] };
  }
}

// Resolution: (project tags - locally removed) + locally added, deduped,
// case-insensitive comparison for removal/dedup but original casing kept.
export function resolveVideoTags(projectTagsRaw: string | null, overrideRaw: string | null): string[] {
  const projectTags = parseTagList(projectTagsRaw);
  const override = parseTagsOverride(overrideRaw);
  const removedLower = new Set(override.removed.map((t) => t.toLowerCase()));
  const inherited = projectTags.filter((t) => !removedLower.has(t.toLowerCase()));
  const seen = new Set(inherited.map((t) => t.toLowerCase()));
  const result = [...inherited];
  for (const t of override.added) {
    if (!seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      result.push(t);
    }
  }
  return result;
}
