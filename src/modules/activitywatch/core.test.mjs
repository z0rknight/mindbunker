import assert from "node:assert/strict";
import test from "node:test";

import {
  ActivityWatchEventScanner,
  deriveBucketIdAndHostname,
  deriveEventFingerprint,
  detectBucketTypeFromFilename,
  emptyActivityWatchImportSummary,
  foldNormalizedEventIntoSummary,
  foldRejectionIntoSummary,
  normalizeActivityWatchEvent,
  scanActivityWatchEventsFromStream,
} from "./core.ts";

function streamFromChunks(chunks) {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode(chunks[i]));
      i++;
    },
  });
}

async function collect(asyncIterable) {
  const out = [];
  for await (const item of asyncIterable) out.push(item);
  return out;
}

// ─── Filename / bucket detection ───────────────────────────────────────────

test("detectBucketTypeFromFilename: recognizes aw-watcher-window_*", () => {
  assert.equal(detectBucketTypeFromFilename("aw-watcher-window_MacBook-Pro.local.json"), "WINDOW");
});

test("detectBucketTypeFromFilename: recognizes aw-watcher-afk_*", () => {
  assert.equal(detectBucketTypeFromFilename("aw-watcher-afk_MacBook-Pro.local.json"), "AFK");
});

test("detectBucketTypeFromFilename: rejects unrelated files", () => {
  assert.equal(detectBucketTypeFromFilename("aw-watcher-web_chrome.json"), null);
  assert.equal(detectBucketTypeFromFilename("random-export.json"), null);
});

test("deriveBucketIdAndHostname: extracts hostname after the known prefix", () => {
  const result = deriveBucketIdAndHostname("aw-watcher-window_MacBook-Pro.local.json", "WINDOW");
  assert.equal(result.hostname, "MacBook-Pro.local");
  assert.equal(result.bucketId, "aw-watcher-window_MacBook-Pro.local");
});

// ─── Streaming scanner ──────────────────────────────────────────────────────

function scanAll(fullText, chunkSize) {
  const scanner = new ActivityWatchEventScanner();
  const found = [];
  for (let i = 0; i < fullText.length; i += chunkSize) {
    found.push(...scanner.push(fullText.slice(i, i + chunkSize)));
  }
  const finish = scanner.finish();
  return { found, finish };
}

const SAMPLE_WINDOW_FILE = JSON.stringify({
  bucket_id: "aw-watcher-window_host",
  hostname: "host",
  type: "currentwindow",
  events: [
    { id: 1, timestamp: "2026-08-01T10:00:00.000Z", duration: 12.5, data: { app: "Safari", title: "Docs" } },
    { id: 2, timestamp: "2026-08-01T10:00:12.500Z", duration: 4.25, data: { app: "Terminal", title: 'grep "events" file' } },
    { id: 3, timestamp: "2026-08-01T10:00:16.750Z", duration: 0, data: { app: "VS Code", title: "core.ts" } },
  ],
});

test("scanner extracts every event across a single large chunk", () => {
  const { found, finish } = scanAll(SAMPLE_WINDOW_FILE, SAMPLE_WINDOW_FILE.length);
  assert.equal(finish.ok, true);
  assert.equal(found.length, 3);
  assert.deepEqual(JSON.parse(found[0]).data.app, "Safari");
});

test("scanner produces the same events regardless of chunk boundary position (1-char chunks)", () => {
  const { found, finish } = scanAll(SAMPLE_WINDOW_FILE, 1);
  assert.equal(finish.ok, true);
  assert.equal(found.length, 3);
  assert.deepEqual(found.map((f) => JSON.parse(f).id), [1, 2, 3]);
});

test("scanner handles a chunk boundary landing inside an escaped quote in a title", () => {
  // Force the split to land exactly inside `\"events\"` in event #2's title.
  const idx = SAMPLE_WINDOW_FILE.indexOf('grep \\"events\\"') + 8;
  const scanner = new ActivityWatchEventScanner();
  const found = [
    ...scanner.push(SAMPLE_WINDOW_FILE.slice(0, idx)),
    ...scanner.push(SAMPLE_WINDOW_FILE.slice(idx)),
  ];
  assert.equal(scanner.finish().ok, true);
  assert.equal(found.length, 3);
  assert.equal(JSON.parse(found[1]).data.title, 'grep "events" file');
});

test("scanner handles an empty events array", () => {
  const file = JSON.stringify({ bucket_id: "x", events: [] });
  const { found, finish } = scanAll(file, 5);
  assert.equal(finish.ok, true);
  assert.equal(found.length, 0);
});

test("scanner reports an error for a file with no events array", () => {
  const file = JSON.stringify({ bucket_id: "x", not_events: [1, 2, 3] });
  const { finish } = scanAll(file, 3);
  assert.equal(finish.ok, false);
});

test("scanner reports an error for a truncated file (unclosed events array)", () => {
  const truncated = SAMPLE_WINDOW_FILE.slice(0, SAMPLE_WINDOW_FILE.indexOf('"title":"core.ts"'));
  const { finish } = scanAll(truncated, 17);
  assert.equal(finish.ok, false);
});

test("scanner tolerates nested objects/arrays inside event data without losing depth tracking", () => {
  const trickyValue = "}]{"; // deliberately brace/bracket characters INSIDE a string value
  const events = [
    {
      id: 1,
      timestamp: "2026-08-01T00:00:00Z",
      duration: 1,
      data: { app: "X", nested: { a: [1, 2, { b: trickyValue }] } },
    },
    { id: 2, timestamp: "2026-08-01T00:00:01Z", duration: 1, data: { app: "Y" } },
  ];
  const file = JSON.stringify({ events });
  const { found, finish } = scanAll(file, 6);
  assert.equal(finish.ok, true);
  assert.equal(found.length, 2);
  assert.equal(JSON.parse(found[0]).data.nested.a[2].b, trickyValue);
});

// ─── Normalization / rejection ─────────────────────────────────────────────

const WINDOW_CTX = { bucketId: "aw-watcher-window_host", bucketType: "WINDOW", hostname: "host" };
const AFK_CTX = { bucketId: "aw-watcher-afk_host", bucketType: "AFK", hostname: "host" };

test("normalizeActivityWatchEvent: parses a valid WINDOW event", () => {
  const result = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 12.5, data: { app: "Safari", title: "Docs" } },
    WINDOW_CTX,
  );
  assert.equal(result.ok, true);
  assert.equal(result.event.appName, "Safari");
  assert.equal(result.event.windowTitle, "Docs");
  assert.equal(result.event.afkStatus, null);
  assert.equal(result.event.durationSeconds, 12.5);
});

test("normalizeActivityWatchEvent: parses a valid AFK event", () => {
  const result = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 300, data: { status: "afk" } },
    AFK_CTX,
  );
  assert.equal(result.ok, true);
  assert.equal(result.event.afkStatus, "afk");
  assert.equal(result.event.appName, null);
});

test("normalizeActivityWatchEvent: rejects a missing/unparseable timestamp", () => {
  assert.equal(normalizeActivityWatchEvent({ duration: 1, data: {} }, WINDOW_CTX).ok, false);
  assert.equal(
    normalizeActivityWatchEvent({ timestamp: "not-a-date", duration: 1, data: {} }, WINDOW_CTX).ok,
    false,
  );
});

test("normalizeActivityWatchEvent: rejects a negative or non-finite duration", () => {
  assert.equal(
    normalizeActivityWatchEvent({ timestamp: "2026-08-01T00:00:00Z", duration: -5, data: {} }, WINDOW_CTX).ok,
    false,
  );
  assert.equal(
    normalizeActivityWatchEvent({ timestamp: "2026-08-01T00:00:00Z", duration: "not-a-number", data: {} }, WINDOW_CTX).ok,
    false,
  );
});

test("normalizeActivityWatchEvent: a zero-duration event is valid, not rejected", () => {
  const result = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T00:00:00Z", duration: 0, data: { app: "X" } },
    WINDOW_CTX,
  );
  assert.equal(result.ok, true);
});

test("normalizeActivityWatchEvent: missing app/title data is honestly null, not fabricated", () => {
  const result = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T00:00:00Z", duration: 1 },
    WINDOW_CTX,
  );
  assert.equal(result.ok, true);
  assert.equal(result.event.appName, null);
  assert.equal(result.event.windowTitle, null);
});

// ─── Fingerprint / idempotency ─────────────────────────────────────────────

test("deriveEventFingerprint: identical events produce identical fingerprints (reimport = dedupe)", () => {
  const a = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 12.5, data: { app: "Safari", title: "Docs" } },
    WINDOW_CTX,
  );
  const b = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 12.5, data: { app: "Safari", title: "Docs" } },
    WINDOW_CTX,
  );
  assert.equal(a.event.fingerprint, b.event.fingerprint);
});

test("deriveEventFingerprint: a different timestamp, duration, app, or title changes the fingerprint", () => {
  const base = { timestamp: "2026-08-01T10:00:00Z", duration: 12.5, data: { app: "Safari", title: "Docs" } };
  const baseFp = normalizeActivityWatchEvent(base, WINDOW_CTX).event.fingerprint;
  assert.notEqual(
    normalizeActivityWatchEvent({ ...base, timestamp: "2026-08-01T10:00:01Z" }, WINDOW_CTX).event.fingerprint,
    baseFp,
  );
  assert.notEqual(
    normalizeActivityWatchEvent({ ...base, duration: 12.6 }, WINDOW_CTX).event.fingerprint,
    baseFp,
  );
  assert.notEqual(
    normalizeActivityWatchEvent({ ...base, data: { app: "Chrome", title: "Docs" } }, WINDOW_CTX).event.fingerprint,
    baseFp,
  );
  assert.notEqual(
    normalizeActivityWatchEvent({ ...base, data: { app: "Safari", title: "Sheets" } }, WINDOW_CTX).event.fingerprint,
    baseFp,
  );
});

test("deriveEventFingerprint: the same instant/duration on WINDOW vs AFK never collides", () => {
  const windowFp = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 5, data: { app: "X" } },
    WINDOW_CTX,
  ).event.fingerprint;
  const afkFp = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 5, data: { status: "afk" } },
    { ...AFK_CTX, bucketId: WINDOW_CTX.bucketId },
  ).event.fingerprint;
  assert.notEqual(windowFp, afkFp);
});

// ─── Summary accumulation (used by both preview and confirm) ──────────────

test("summary: new vs duplicate counted correctly, range tracks min/max", () => {
  let summary = emptyActivityWatchImportSummary();
  const e1 = normalizeActivityWatchEvent(
    { timestamp: "2026-08-01T10:00:00Z", duration: 1, data: { app: "A" } },
    WINDOW_CTX,
  ).event;
  const e2 = normalizeActivityWatchEvent(
    { timestamp: "2026-08-03T10:00:00Z", duration: 1, data: { app: "B" } },
    WINDOW_CTX,
  ).event;
  summary = foldNormalizedEventIntoSummary(summary, e1, false);
  summary = foldNormalizedEventIntoSummary(summary, e2, true);
  assert.equal(summary.totalEventsInFile, 2);
  assert.equal(summary.newCount, 1);
  assert.equal(summary.duplicateCount, 1);
  assert.equal(summary.rangeStart.toISOString(), e1.startedAt.toISOString());
  assert.equal(summary.rangeEnd.toISOString(), e2.startedAt.toISOString());
});

test("summary: rejected events increment total and rejected, nothing else", () => {
  let summary = emptyActivityWatchImportSummary();
  summary = foldRejectionIntoSummary(summary);
  assert.equal(summary.totalEventsInFile, 1);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.newCount, 0);
  assert.equal(summary.rangeStart, null);
});

test("scanner stress test: hundreds of events survive arbitrary small chunk sizes intact", () => {
  const events = Array.from({ length: 500 }, (_, idx) => ({
    id: idx,
    timestamp: new Date(Date.UTC(2026, 0, 1) + idx * 15_000).toISOString(),
    duration: (idx % 30) + 0.25,
    data: { app: `App${idx % 7}`, title: `Window title #${idx} with "quotes" and {braces}` },
  }));
  const file = JSON.stringify({ bucket_id: "aw-watcher-window_host", hostname: "host", events });

  for (const chunkSize of [1, 3, 17, 37, 4096]) {
    const { found, finish } = scanAll(file, chunkSize);
    assert.equal(finish.ok, true, `chunk size ${chunkSize} should finish cleanly`);
    assert.equal(found.length, 500, `chunk size ${chunkSize} should find all 500 events`);
    const parsed = found.map((f) => JSON.parse(f));
    assert.deepEqual(parsed.map((e) => e.id), events.map((e) => e.id), `chunk size ${chunkSize} preserves order/identity`);
    assert.equal(parsed[250].data.title, events[250].data.title, `chunk size ${chunkSize} preserves title text exactly`);
  }
});

// ─── End-to-end stream -> normalized events ────────────────────────────────

test("scanActivityWatchEventsFromStream: yields normalized events from a chunked stream", async () => {
  const file = JSON.stringify({
    bucket_id: "aw-watcher-window_host",
    events: [
      { timestamp: "2026-08-01T10:00:00Z", duration: 5, data: { app: "Safari", title: "Docs" } },
      { timestamp: "2026-08-01T10:00:05Z", duration: 3, data: { app: "Terminal", title: "zsh" } },
    ],
  });
  // Split into small arbitrary chunks to exercise real streaming.
  const chunks = [];
  for (let i = 0; i < file.length; i += 9) chunks.push(file.slice(i, i + 9));

  const results = await collect(
    scanActivityWatchEventsFromStream(streamFromChunks(chunks), WINDOW_CTX),
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[0].event.appName, "Safari");
  assert.equal(results[1].event.appName, "Terminal");
});

test("scanActivityWatchEventsFromStream: a malformed individual event is reported as rejected without aborting the stream", async () => {
  // Hand-construct raw text with one structurally invalid element mixed in
  // (a bare number instead of an object) to prove one bad element doesn't
  // take down the whole import -- the scanner itself would reject this at
  // the "unexpected content" check, ending the stream with a trailing
  // rejection rather than silently losing later valid events. This test
  // documents that behavior: the file-level error surfaces, valid events
  // parsed before it are NOT discarded.
  const events = [
    { timestamp: "2026-08-01T10:00:00Z", duration: 5, data: { app: "Safari" } },
    { timestamp: "not-a-real-timestamp", duration: 5, data: { app: "Broken" } },
    { timestamp: "2026-08-01T10:00:10Z", duration: 5, data: { app: "Terminal" } },
  ];
  const file = JSON.stringify({ events });
  const results = await collect(
    scanActivityWatchEventsFromStream(streamFromChunks([file]), WINDOW_CTX),
  );
  assert.equal(results.length, 3);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[2].ok, true);
  assert.equal(results[2].event.appName, "Terminal");
});

test("scanActivityWatchEventsFromStream: an empty events array yields zero results, not an error", async () => {
  const file = JSON.stringify({ events: [] });
  const results = await collect(
    scanActivityWatchEventsFromStream(streamFromChunks([file]), WINDOW_CTX),
  );
  assert.deepEqual(results, []);
});

test("scanActivityWatchEventsFromStream: a truncated stream surfaces a trailing rejection instead of hanging or crashing", async () => {
  const file = JSON.stringify({
    events: [{ timestamp: "2026-08-01T10:00:00Z", duration: 5, data: { app: "Safari" } }],
  });
  // Cut off the closing "]}" so the one event object is fully intact but
  // the array/root object never close -- a realistic truncated-download
  // shape.
  const truncated = file.slice(0, file.length - 2);
  assert.ok(truncated.endsWith('"Safari"}}'), "sanity check on the truncation point");
  const results = await collect(
    scanActivityWatchEventsFromStream(streamFromChunks([truncated]), WINDOW_CTX),
  );
  // The one complete event before truncation is NOT lost, plus one
  // trailing rejection reporting the file was cut off.
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  // no crash, no hang -- the generator terminates cleanly.
});
