import assert from "node:assert/strict";
import test from "node:test";

import {
  extractActivityWatchBucketHeader,
  normalizeExportFilename,
  resolveBucketIdentity,
} from "./core.ts";

// ACTIVITYWATCH CLI IMPORT round -- focused tests for import-cli.ts's own
// logic. The heavier, genuinely I/O-bound behaviors (spawning the real CLI
// process, opening a real local D1 via getPlatformProxy, verifying remote
// mode never falls back to local) are exercised directly against the real
// two Desktop export files and a live `npx wrangler d1 migrations list
// --remote` call as part of this round's actual execution, not re-run here
// as slow child_process tests -- see the final report's DRY RUN section for
// that real-data proof. What belongs in the fast unit suite is everything
// import-cli.ts relies on that is pure and deterministic: filename
// normalization for both real naming conventions, real on-disk bucket
// metadata extraction (both the flat and "buckets"-wrapped shapes actually
// observed on Emmanuel's Desktop), and the identity-resolution logic that
// treats filename as a hint only -- never as canonical truth, per the
// brief's own explicit instruction.

// ─── normalizeExportFilename: both real filename conventions ──────────────

test("normalizeExportFilename: plain aw-watcher-window_* is unchanged", () => {
  assert.equal(
    normalizeExportFilename("aw-watcher-window_Mac-mini-de-Emmanuel.local.json"),
    "aw-watcher-window_Mac-mini-de-Emmanuel.local.json",
  );
});

test("normalizeExportFilename: plain aw-watcher-afk_* is unchanged", () => {
  assert.equal(
    normalizeExportFilename("aw-watcher-afk_Mac-mini-de-Emmanuel.local.json"),
    "aw-watcher-afk_Mac-mini-de-Emmanuel.local.json",
  );
});

test("normalizeExportFilename: strips aw-bucket-export_ prefix for window", () => {
  assert.equal(
    normalizeExportFilename("aw-bucket-export_aw-watcher-window_Mac-mini-de-Emmanuel.local.json"),
    "aw-watcher-window_Mac-mini-de-Emmanuel.local.json",
  );
});

test("normalizeExportFilename: strips aw-bucket-export_ prefix for afk", () => {
  assert.equal(
    normalizeExportFilename("aw-bucket-export_aw-watcher-afk_Mac-mini-de-Emmanuel.local.json"),
    "aw-watcher-afk_Mac-mini-de-Emmanuel.local.json",
  );
});

test("normalizeExportFilename: preserves a leading directory path", () => {
  assert.equal(
    normalizeExportFilename("/Users/e/Desktop/aw-bucket-export_aw-watcher-window_Host.json"),
    "/Users/e/Desktop/aw-watcher-window_Host.json",
  );
});

// ─── extractActivityWatchBucketHeader: real shapes ─────────────────────────

test("extractActivityWatchBucketHeader: nested buckets-wrapper shape (ActivityWatch's own export-all-buckets download -- the real shape found on Emmanuel's Desktop)", () => {
  const text =
    '{"buckets": {"aw-watcher-window_Mac-mini-de-Emmanuel.local": {"id": "aw-watcher-window_Mac-mini-de-Emmanuel.local", "created": "2025-11-02T00:47:19.467286+00:00", "name": null, "type": "currentwindow", "client": "aw-watcher-window", "hostname": "Mac-mini-de-Emmanuel.local", "data": {}, "events": [';
  const header = extractActivityWatchBucketHeader(text);
  assert.deepEqual(header, {
    id: "aw-watcher-window_Mac-mini-de-Emmanuel.local",
    client: "aw-watcher-window",
    type: "currentwindow",
    hostname: "Mac-mini-de-Emmanuel.local",
  });
});

test("extractActivityWatchBucketHeader: nested buckets-wrapper shape for AFK", () => {
  const text =
    '{"buckets": {"aw-watcher-afk_Mac-mini-de-Emmanuel.local": {"id": "aw-watcher-afk_Mac-mini-de-Emmanuel.local", "created": "2025-11-02T00:47:19.210198+00:00", "name": null, "type": "afkstatus", "client": "aw-watcher-afk", "hostname": "Mac-mini-de-Emmanuel.local", "data": {}, "events": [';
  const header = extractActivityWatchBucketHeader(text);
  assert.equal(header.client, "aw-watcher-afk");
  assert.equal(header.type, "afkstatus");
  assert.equal(header.hostname, "Mac-mini-de-Emmanuel.local");
});

test("extractActivityWatchBucketHeader: flat single-bucket shape (bucket_id, no wrapper)", () => {
  const text =
    '{"bucket_id": "aw-watcher-window_Host", "hostname": "Host", "client": "aw-watcher-window", "type": "currentwindow", "events": [';
  const header = extractActivityWatchBucketHeader(text);
  assert.deepEqual(header, {
    id: "aw-watcher-window_Host",
    client: "aw-watcher-window",
    type: "currentwindow",
    hostname: "Host",
  });
});

test("extractActivityWatchBucketHeader: missing fields come back null, not throw", () => {
  const header = extractActivityWatchBucketHeader('{"events": [');
  assert.deepEqual(header, { id: null, client: null, type: null, hostname: null });
});

test("extractActivityWatchBucketHeader: only scans the text before events (a window title containing the word events elsewhere in the array is irrelevant since header text stops at the array start)", () => {
  const header = extractActivityWatchBucketHeader(
    '{"client": "aw-watcher-window", "type": "currentwindow", "hostname": "H", "events": [{"data": {"title": "no events here"}}',
  );
  assert.equal(header.client, "aw-watcher-window");
  assert.equal(header.hostname, "H");
});

// ─── resolveBucketIdentity: filename is a hint, real metadata is truth ────

test("resolveBucketIdentity: real metadata + matching filename -> ok, real id/hostname preferred over filename-derived", () => {
  const header = {
    id: "aw-watcher-window_Mac-mini-de-Emmanuel.local",
    client: "aw-watcher-window",
    type: "currentwindow",
    hostname: "Mac-mini-de-Emmanuel.local",
  };
  const result = resolveBucketIdentity("aw-watcher-window_Mac-mini-de-Emmanuel.local.json", header);
  assert.deepEqual(result, {
    ok: true,
    bucketType: "WINDOW",
    bucketId: "aw-watcher-window_Mac-mini-de-Emmanuel.local",
    hostname: "Mac-mini-de-Emmanuel.local",
  });
});

test("resolveBucketIdentity: aw-bucket-export_ prefixed filename + real metadata -> ok (both naming conventions accepted)", () => {
  const header = {
    id: "aw-watcher-afk_Mac-mini-de-Emmanuel.local",
    client: "aw-watcher-afk",
    type: "afkstatus",
    hostname: "Mac-mini-de-Emmanuel.local",
  };
  const result = resolveBucketIdentity(
    "aw-bucket-export_aw-watcher-afk_Mac-mini-de-Emmanuel.local.json",
    header,
  );
  assert.equal(result.ok, true);
  assert.equal(result.bucketType, "AFK");
});

test("resolveBucketIdentity: filename says WINDOW but real client/type say AFK -> rejected, content wins over filename per brief ('filename is not canonical truth')", () => {
  const header = { id: "x", client: "aw-watcher-afk", type: "afkstatus", hostname: "H" };
  const result = resolveBucketIdentity("aw-watcher-window_H.json", header);
  assert.equal(result.ok, false);
  assert.match(result.reason, /filename and content disagree/);
});

test("resolveBucketIdentity: real metadata does not match any known WINDOW/AFK combination -> rejected outright, never guessed from filename alone", () => {
  const header = { id: "x", client: "some-other-watcher", type: "somethingelse", hostname: "H" };
  const result = resolveBucketIdentity("aw-watcher-window_H.json", header);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not.*canonical/i);
});

test("resolveBucketIdentity: header omits hostname -> falls back to filename-derived hostname", () => {
  const header = { id: null, client: "aw-watcher-window", type: "currentwindow", hostname: null };
  const result = resolveBucketIdentity("aw-watcher-window_Fallback-Host.local.json", header);
  assert.equal(result.ok, true);
  assert.equal(result.hostname, "Fallback-Host.local");
});

test("resolveBucketIdentity: an unrecognized filename (neither convention) with valid real metadata still resolves from metadata alone", () => {
  const header = {
    id: "aw-watcher-window_Whatever",
    client: "aw-watcher-window",
    type: "currentwindow",
    hostname: "Whatever",
  };
  const result = resolveBucketIdentity("totally-renamed-export.json", header);
  assert.equal(result.ok, true);
  assert.equal(result.bucketType, "WINDOW");
  assert.equal(result.bucketId, "aw-watcher-window_Whatever");
});
