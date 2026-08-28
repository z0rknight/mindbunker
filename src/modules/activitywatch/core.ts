// Pre-Operation Reality Hardening — ActivityWatch Import round.
//
// Pure, framework-independent logic for importing raw ActivityWatch export
// files (aw-watcher-window_* and aw-watcher-afk_*). No DB, no R2, no
// Next.js/Cloudflare imports here -- see actions.ts / the upload route
// handler for the I/O glue. Everything here is deterministic and unit
// testable with plain strings.
//
// Why a hand-written streaming scanner instead of JSON.parse(wholeFile):
// real ActivityWatch window-watcher exports can be ~64MB and AFK exports
// ~12MB. A standard Cloudflare Worker isolate has roughly 128MB of memory;
// JSON.parse() needs the raw UTF-8 text AND the fully materialized parsed
// object graph in memory simultaneously, and JS strings are UTF-16
// internally, so a 64MB UTF-8 file can already occupy ~128MB as a JS
// string alone before parsing even starts. Buffering the whole file (via
// request.json(), request.text(), or JSON.parse on a fully-read R2 object)
// is not a safe assumption at this file size -- see the ARCHITECTURE
// comment in actions.ts for the full upload/preview/confirm design this
// scanner is built for.
//
// ActivityWatch's own per-bucket export shape (from `aw-client export` or
// the web UI's per-bucket JSON export) is one JSON object with metadata
// keys (id/bucket_id, hostname, client, type, created, ...) and one large
// "events" array as its last/only bulk field:
//   {"bucket_id": "...", "hostname": "...", "events": [ {...}, {...} ]}
// This scanner does not attempt to parse those metadata keys at all --
// bucket type and hostname are derived from the uploaded FILENAME instead
// (aw-watcher-window_<hostname>.json / aw-watcher-afk_<hostname>.json),
// exactly the glob pattern the brief specifies. This keeps the scanner to
// one job: find the "events" array and yield each element's raw JSON text
// one at a time, in true streaming fashion, so memory use is bounded by
// one event's text (typically well under 1KB) plus a small resumable
// buffer -- never by file size.

export type ActivityWatchBucketType = "WINDOW" | "AFK";

const BUCKET_PREFIXES: Record<ActivityWatchBucketType, string> = {
  WINDOW: "aw-watcher-window_",
  AFK: "aw-watcher-afk_",
};

// Matches the brief's glob spec exactly: aw-watcher-window_* / aw-watcher-afk_*.
// Anything else is out of scope for this round and must be rejected, not
// guessed at.
export function detectBucketTypeFromFilename(
  filename: string,
): ActivityWatchBucketType | null {
  const base = filename.replace(/^.*[/\\]/, "");
  if (base.startsWith(BUCKET_PREFIXES.WINDOW)) return "WINDOW";
  if (base.startsWith(BUCKET_PREFIXES.AFK)) return "AFK";
  return null;
}

// aw-watcher-window_MacBook-Pro.local.json -> "MacBook-Pro.local"
// aw-watcher-afk_MacBook-Pro.local.json -> "MacBook-Pro.local"
export function deriveBucketIdAndHostname(
  filename: string,
  bucketType: ActivityWatchBucketType,
): { bucketId: string; hostname: string | null } {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.json$/i, "");
  const prefix = BUCKET_PREFIXES[bucketType];
  const hostname = base.startsWith(prefix)
    ? base.slice(prefix.length) || null
    : null;
  return { bucketId: base, hostname };
}

// ─── Real export filename + on-disk bucket-metadata handling ──────────────
//
// ACTIVITYWATCH CLI IMPORT round: the brief's own CLI mission adds a second
// real-world file family on top of what this module already recognized --
// ActivityWatch's own "export all buckets" download names files
// `aw-bucket-export_aw-watcher-window_<hostname>.json` /
// `aw-bucket-export_aw-watcher-afk_<hostname>.json`, wrapping the exact same
// per-bucket object one level deeper as
// {"buckets": {"<bucketId>": {"id":..., "client":..., "type":...,
// "hostname":..., "events": [...]}}} instead of the flat
// {"bucket_id":..., "events": [...]} shape. None of that changes where the
// events array itself lives relative to "events" as a JSON key -- the
// scanner above finds it exactly the same way regardless of nesting depth,
// so no second parser is needed here, only two small additions: (1)
// recognizing the extra filename prefix before reusing
// detectBucketTypeFromFilename/deriveBucketIdAndHostname unchanged, and (2)
// treating the filename as a HINT ONLY -- the CLI's own explicit brief:
// "filename is not canonical truth" -- and cross-checking it against the
// bucket's own declared client/type fields read from the file's actual
// JSON content.

const KNOWN_EXPORT_WRAPPER_PREFIX = "aw-bucket-export_";

// aw-bucket-export_aw-watcher-window_Host.json -> aw-watcher-window_Host.json
// aw-watcher-window_Host.json -> aw-watcher-window_Host.json (unchanged)
// Operates on the basename only; any directory portion of the input is
// preserved as-is in front of the (possibly stripped) basename.
export function normalizeExportFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "");
  const dir = filename.slice(0, filename.length - base.length);
  const stripped = base.startsWith(KNOWN_EXPORT_WRAPPER_PREFIX)
    ? base.slice(KNOWN_EXPORT_WRAPPER_PREFIX.length)
    : base;
  return dir + stripped;
}

export type ActivityWatchBucketHeaderMetadata = {
  id: string | null;
  client: string | null;
  type: string | null;
  hostname: string | null;
};

// Pulls a real bucket's own declared identity fields out of whatever JSON
// text precedes its "events" array. Deliberately NOT a JSON.parse of the
// (possibly truncated -- callers only need to hand in a bounded prefix,
// never the whole file) header text: real exports put these as plain
// "key": "value" pairs somewhere before "events", whether the bucket
// object sits at the top level (a single `aw-client export`) or nested
// one level under "buckets": {"<id>": {...}} (ActivityWatch's own
// export-all-buckets download) -- a bounded regex scan finds them
// correctly either way without caring about the surrounding structure,
// exactly the same principle the scanner above already relies on for
// locating "events" itself.
export function extractActivityWatchBucketHeader(
  headerText: string,
): ActivityWatchBucketHeaderMetadata {
  const eventsIdx = headerText.indexOf('"events"');
  const scope = eventsIdx === -1 ? headerText : headerText.slice(0, eventsIdx);
  function field(key: string): string | null {
    const match = scope.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
    return match ? match[1] : null;
  }
  return {
    id: field("id") ?? field("bucket_id"),
    client: field("client"),
    type: field("type"),
    hostname: field("hostname"),
  };
}

export type BucketIdentityResolution =
  | {
      ok: true;
      bucketType: ActivityWatchBucketType;
      bucketId: string;
      hostname: string | null;
    }
  | { ok: false; reason: string };

// The single place that decides what bucket a file really is. Filename is
// only ever used as (a) a hint to sanity-check the real metadata against,
// and (b) a fallback for bucketId/hostname when the file's own header
// didn't declare them -- never as the sole source of truth for bucketType,
// per the brief's explicit instruction. Reuses
// detectBucketTypeFromFilename/deriveBucketIdAndHostname unchanged.
export function resolveBucketIdentity(
  filename: string,
  header: ActivityWatchBucketHeaderMetadata,
): BucketIdentityResolution {
  const normalizedFilename = normalizeExportFilename(filename);
  const filenameHint = detectBucketTypeFromFilename(normalizedFilename);

  let bucketType: ActivityWatchBucketType | null = null;
  if (header.client === "aw-watcher-window" && header.type === "currentwindow") {
    bucketType = "WINDOW";
  } else if (header.client === "aw-watcher-afk" && header.type === "afkstatus") {
    bucketType = "AFK";
  }

  if (!bucketType) {
    return {
      ok: false,
      reason:
        `Could not verify real bucket metadata (client=${JSON.stringify(header.client)}, ` +
        `type=${JSON.stringify(header.type)}) against a known WINDOW/AFK combination. ` +
        `Filename hint was ${filenameHint ?? "unrecognized"}, but filename is not canonical ` +
        `truth -- refusing to guess from it alone.`,
    };
  }

  if (filenameHint && filenameHint !== bucketType) {
    return {
      ok: false,
      reason:
        `Filename suggests ${filenameHint} but the file's own declared metadata ` +
        `(client=${header.client}, type=${header.type}) says ${bucketType}. Refusing to ` +
        `import -- filename and content disagree.`,
    };
  }

  const derivedFromFilename = deriveBucketIdAndHostname(normalizedFilename, bucketType);
  return {
    ok: true,
    bucketType,
    bucketId: header.id ?? derivedFromFilename.bucketId,
    hostname: header.hostname ?? derivedFromFilename.hostname,
  };
}

// ─── Streaming array-of-objects scanner ────────────────────────────────────
//
// Feed it text chunks in arrival order via push(); it returns the raw JSON
// text of every complete top-level element of the "events" array found so
// far. Handles chunk boundaries falling anywhere -- mid-key, mid-string,
// mid-escape, mid-object -- by carrying only the unconsumed tail forward.
//
// This is intentionally NOT a general JSON parser. It only needs to (a)
// locate the "events" array, and (b) find the boundaries of each top-level
// element inside it (which may itself contain arbitrarily nested
// objects/arrays/strings -- e.g. a window title containing literal braces
// or quotes). Bracket-depth tracking with string/escape awareness is
// sufficient for that and is what's implemented below.
export class ActivityWatchEventScanner {
  private mode: "seeking-events" | "in-array" | "done" | "error" = "seeking-events";
  private buffer = "";
  // Absolute count of characters permanently discarded from the front of
  // `buffer` so far -- not used for output, just keeps the "haven't found
  // events key" safety cap honest across many small push() calls.
  private seekingBytesScanned = 0;
  private errorMessage: string | null = null;

  private depth = 0;
  private objectStart = -1;
  private inString = false;
  private escapeNext = false;
  // Index into `buffer` where scanning should RESUME on the next push()
  // call. Without this, a push() spanning a partial object (the common
  // case whenever chunks are smaller than one event's JSON text) would
  // restart its scan at index 0 every call and re-process characters
  // already accounted for in depth/inString/escapeNext from a prior
  // call -- silently double-counting brace depth. This is what makes the
  // scanner correct across arbitrary chunk boundaries, not just
  // convenient ones.
  private scanPos = 0;

  push(chunk: string): string[] {
    if (this.mode === "done" || this.mode === "error") return [];
    this.buffer += chunk;
    const completed: string[] = [];

    if (this.mode === "seeking-events") {
      const keyIdx = this.buffer.indexOf('"events"');
      if (keyIdx === -1) {
        this.seekingBytesScanned += chunk.length;
        // Keep only a small tail in case "events" straddles a chunk
        // boundary; a real AW export's header is tiny (well under this
        // cap), so failing to find the key within it means this isn't a
        // recognizable AW bucket export.
        const SEEK_CAP = 200_000;
        if (this.buffer.length > 4096) {
          this.buffer = this.buffer.slice(-4096);
        }
        if (this.seekingBytesScanned > SEEK_CAP) {
          this.mode = "error";
          this.errorMessage =
            'Could not find an "events" array in this file -- not a recognizable ActivityWatch bucket export.';
        }
        return completed;
      }
      let i = keyIdx + '"events"'.length;
      while (i < this.buffer.length && /\s/.test(this.buffer[i])) i++;
      if (i >= this.buffer.length) {
        // ':' hasn't arrived yet -- wait for more text, but don't lose
        // what we have.
        this.buffer = this.buffer.slice(keyIdx);
        return completed;
      }
      if (this.buffer[i] !== ":") {
        this.mode = "error";
        this.errorMessage = 'Malformed "events" key in this file.';
        return completed;
      }
      i++;
      while (i < this.buffer.length && /\s/.test(this.buffer[i])) i++;
      if (i >= this.buffer.length) {
        this.buffer = this.buffer.slice(keyIdx);
        return completed;
      }
      if (this.buffer[i] !== "[") {
        this.mode = "error";
        this.errorMessage = '"events" is not a JSON array in this file.';
        return completed;
      }
      this.buffer = this.buffer.slice(i + 1);
      this.mode = "in-array";
    }

    if (this.mode === "in-array") {
      let i = this.scanPos;
      while (i < this.buffer.length) {
        const ch = this.buffer[i];

        if (this.objectStart === -1) {
          // Between elements: skip whitespace/commas, look for '{' (next
          // element) or ']' (array closed).
          if (/\s/.test(ch) || ch === ",") {
            i++;
            continue;
          }
          if (ch === "]") {
            this.mode = "done";
            this.buffer = "";
            return completed;
          }
          if (ch === "{") {
            this.objectStart = i;
            this.depth = 1;
            i++;
            continue;
          }
          // Anything else between elements (e.g. a non-object element) is
          // outside what a real AW export produces -- bail out rather than
          // silently mis-parsing.
          this.mode = "error";
          this.errorMessage = "Unexpected content inside the events array.";
          return completed;
        }

        // Inside an object: track string/escape state and bracket depth.
        if (this.inString) {
          if (this.escapeNext) {
            this.escapeNext = false;
          } else if (ch === "\\") {
            this.escapeNext = true;
          } else if (ch === '"') {
            this.inString = false;
          }
          i++;
          continue;
        }
        if (ch === '"') {
          this.inString = true;
          i++;
          continue;
        }
        if (ch === "{" || ch === "[") {
          this.depth++;
          i++;
          continue;
        }
        if (ch === "}" || ch === "]") {
          this.depth--;
          i++;
          if (this.depth === 0) {
            completed.push(this.buffer.slice(this.objectStart, i));
            this.buffer = this.buffer.slice(i);
            i = 0;
            this.objectStart = -1;
          }
          continue;
        }
        i++;
      }
      // Persist how far we've scanned so the next push() resumes exactly
      // here instead of re-reading already-processed characters.
      this.scanPos = i;
      // Between elements (no object in progress), nothing needs to be
      // retained -- trim the buffer down to just the unconsumed tail
      // (typically empty) and reset the resume pointer to match, which
      // also keeps buffer size bounded rather than growing across many
      // small pushes.
      if (this.objectStart === -1) {
        this.buffer = this.buffer.slice(this.scanPos);
        this.scanPos = 0;
      }
    }

    return completed;
  }

  // Call once the input stream ends. Returns an error if the array was
  // never properly closed (truncated/corrupted file) -- distinct from a
  // recognized-but-empty events array, which is valid.
  finish(): { ok: true } | { ok: false; error: string } {
    if (this.mode === "error") {
      return { ok: false, error: this.errorMessage ?? "Invalid file." };
    }
    if (this.mode === "seeking-events") {
      return {
        ok: false,
        error:
          'Could not find an "events" array in this file -- not a recognizable ActivityWatch bucket export.',
      };
    }
    if (this.mode === "in-array") {
      return {
        ok: false,
        error: "File ended before the events array was closed (truncated export?).",
      };
    }
    return { ok: true };
  }
}

// ─── Per-event normalization + fingerprinting ──────────────────────────────

export type RawActivityWatchEvent = {
  id?: number | string;
  timestamp?: unknown;
  duration?: unknown;
  data?: Record<string, unknown> | null;
};

export type NormalizedActivityWatchEvent = {
  bucketId: string;
  bucketType: ActivityWatchBucketType;
  hostname: string | null;
  startedAt: Date;
  durationSeconds: number;
  appName: string | null;
  windowTitle: string | null;
  afkStatus: string | null;
  fingerprint: string;
};

export type NormalizeResult =
  | { ok: true; event: NormalizedActivityWatchEvent }
  | { ok: false; reason: string };

type NormalizeContext = {
  bucketId: string;
  bucketType: ActivityWatchBucketType;
  hostname: string | null;
};

// Deliberately minimal validation, per the brief: no historical
// classification is invented here. An event is only rejected when it is
// too malformed to be a real observation at all (unparseable timestamp,
// non-finite/negative duration) -- never because a field the brief didn't
// ask for is missing.
export function normalizeActivityWatchEvent(
  raw: RawActivityWatchEvent,
  context: NormalizeContext,
): NormalizeResult {
  if (typeof raw.timestamp !== "string") {
    return { ok: false, reason: "Missing or invalid timestamp." };
  }
  const startedAt = new Date(raw.timestamp);
  if (Number.isNaN(startedAt.getTime())) {
    return { ok: false, reason: `Unparseable timestamp: ${raw.timestamp}` };
  }
  const durationSeconds = Number(raw.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return { ok: false, reason: `Invalid duration: ${String(raw.duration)}` };
  }

  const data = raw.data ?? {};
  const appName =
    context.bucketType === "WINDOW" && typeof data.app === "string" ? data.app : null;
  const windowTitle =
    context.bucketType === "WINDOW" && typeof data.title === "string"
      ? data.title
      : null;
  const afkStatus =
    context.bucketType === "AFK" && typeof data.status === "string"
      ? data.status
      : null;

  const fingerprint = deriveEventFingerprint({
    bucketId: context.bucketId,
    bucketType: context.bucketType,
    startedAt,
    durationSeconds,
    appName,
    windowTitle,
    afkStatus,
  });

  return {
    ok: true,
    event: {
      bucketId: context.bucketId,
      bucketType: context.bucketType,
      hostname: context.hostname,
      startedAt,
      durationSeconds,
      appName,
      windowTitle,
      afkStatus,
      fingerprint,
    },
  };
}

// Synchronous by design (no crypto.subtle await) -- this runs in a tight
// loop over potentially hundreds of thousands of events per file, and a
// deterministic string hash is exactly as effective as a cryptographic one
// for a collision-resistant-enough dedupe key at this scale. FNV-1a-64 (a
// well-known, simple, dependency-free hash) over a canonical pipe-joined
// representation of every field that defines "the same real event."
// Titles are truncated before hashing (not stored truncated -- only the
// hash input) purely to bound per-event CPU work; a collision between two
// events differing only after 500 characters of an identical window title
// at an identical timestamp is not a realistic risk.
function fnv1a64Hex(input: string): string {
  // BigInt() calls rather than "...n" literal syntax -- literal BigInt
  // syntax requires an ES2020+ TS compile target, and this repo's
  // tsconfig targets lower than that. BigInt() at runtime works
  // regardless of compile target since it's just a function call.
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function deriveEventFingerprint(input: {
  bucketId: string;
  bucketType: ActivityWatchBucketType;
  startedAt: Date;
  durationSeconds: number;
  appName: string | null;
  windowTitle: string | null;
  afkStatus: string | null;
}): string {
  const canonical = [
    input.bucketId,
    input.bucketType,
    input.startedAt.toISOString(),
    input.durationSeconds.toFixed(6),
    (input.appName ?? "").slice(0, 500),
    (input.windowTitle ?? "").slice(0, 500),
    input.afkStatus ?? "",
  ].join("|");
  return `aw:${fnv1a64Hex(canonical)}`;
}

// ─── End-to-end streaming: bytes in, normalized events out ────────────────
//
// Ties the scanner + JSON.parse-per-element + normalizeActivityWatchEvent
// together into one async generator over a standard Web ReadableStream.
// Deliberately built on the Web Streams API only (no R2/D1/Next import) so
// it can be driven by a real R2Object's .body in production and by a
// plain in-memory ReadableStream in tests -- see core.test.mjs.
export async function* scanActivityWatchEventsFromStream(
  stream: ReadableStream<Uint8Array>,
  context: {
    bucketId: string;
    bucketType: ActivityWatchBucketType;
    hostname: string | null;
  },
): AsyncGenerator<NormalizeResult> {
  const scanner = new ActivityWatchEventScanner();
  const reader = stream.getReader();
  // A manually-driven TextDecoder (stream: true keeps a multi-byte UTF-8
  // sequence that straddles a chunk boundary intact until the next
  // decode() call) rather than piping through TextDecoderStream --
  // TextDecoderStream's WritableStream<BufferSource> typing doesn't line
  // up with R2Object.body's ReadableStream<Uint8Array> under this repo's
  // combined Cloudflare Workers + DOM lib types, and this is exactly
  // equivalent in behavior without fighting that mismatch.
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const raw of scanner.push(text)) {
        yield parseAndNormalize(raw, context);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const finish = scanner.finish();
  if (!finish.ok) {
    yield { ok: false, reason: finish.error };
  }
}

function parseAndNormalize(
  raw: string,
  context: {
    bucketId: string;
    bucketType: ActivityWatchBucketType;
    hostname: string | null;
  },
): NormalizeResult {
  let parsed: RawActivityWatchEvent;
  try {
    parsed = JSON.parse(raw) as RawActivityWatchEvent;
  } catch {
    return { ok: false, reason: "Malformed event JSON in file." };
  }
  return normalizeActivityWatchEvent(parsed, context);
}

// ─── Preview/confirm summary accumulation ──────────────────────────────────
// Pure reducer used identically by both the preview pass (read-only) and
// the confirm pass (after the actual DB write) -- so the two numbers are
// guaranteed to be computed the same way, never two parallel
// implementations that could silently drift apart.

export type ActivityWatchImportSummary = {
  totalEventsInFile: number;
  newCount: number;
  duplicateCount: number;
  rejectedCount: number;
  rangeStart: Date | null;
  rangeEnd: Date | null;
};

export function emptyActivityWatchImportSummary(): ActivityWatchImportSummary {
  return {
    totalEventsInFile: 0,
    newCount: 0,
    duplicateCount: 0,
    rejectedCount: 0,
    rangeStart: null,
    rangeEnd: null,
  };
}

export function foldNormalizedEventIntoSummary(
  summary: ActivityWatchImportSummary,
  event: NormalizedActivityWatchEvent,
  isDuplicate: boolean,
): ActivityWatchImportSummary {
  return {
    totalEventsInFile: summary.totalEventsInFile + 1,
    newCount: summary.newCount + (isDuplicate ? 0 : 1),
    duplicateCount: summary.duplicateCount + (isDuplicate ? 1 : 0),
    rejectedCount: summary.rejectedCount,
    rangeStart:
      !summary.rangeStart || event.startedAt < summary.rangeStart
        ? event.startedAt
        : summary.rangeStart,
    rangeEnd:
      !summary.rangeEnd || event.startedAt > summary.rangeEnd
        ? event.startedAt
        : summary.rangeEnd,
  };
}

export function foldRejectionIntoSummary(
  summary: ActivityWatchImportSummary,
): ActivityWatchImportSummary {
  return {
    ...summary,
    totalEventsInFile: summary.totalEventsInFile + 1,
    rejectedCount: summary.rejectedCount + 1,
  };
}
