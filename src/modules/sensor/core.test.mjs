import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSOR_SCOPES,
  createSensorCredential,
  extractBearerToken,
  hashSensorToken,
  parseScopes,
  parseSensorToken,
  resolveSensorConnectivityStatus,
  selectLongSessionCandidates,
  validateObservationBatch,
  validateSensorSessionInput,
  validateSensorStopInput,
} from "./core.ts";

const NOW = new Date("2026-09-15T12:00:00Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1_000);

test("long-session review: a staging session under the threshold is not flagged", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Short clip", startedAt: NOW_SECONDS - 3 * 3600, endedAt: NOW_SECONDS - 1 * 3600, approvalState: "PENDING" }],
    [],
    NOW,
  );
  assert.deepEqual(candidates, []);
});

test("long-session review: a staging session over 6h is flagged, editable while still PENDING and stopped", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Forgotten stop", startedAt: NOW_SECONDS - 10 * 3600, endedAt: NOW_SECONDS - 1 * 3600, approvalState: "PENDING" }],
    [],
    NOW,
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "STAGING");
  assert.equal(candidates[0].editable, true);
  assert.equal(candidates[0].approved, false);
  assert.equal(candidates[0].durationSeconds, 9 * 3600);
});

test("long-session review: a STILL-OPEN staging session over 6h is flagged but never editable (it's live)", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Still running", startedAt: NOW_SECONDS - 10 * 3600, endedAt: null, approvalState: "PENDING" }],
    [],
    NOW,
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].editable, false);
});

test("long-session review: an already-approved staging row is flagged but not editable, and not double-counted as unapproved", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Already handled", startedAt: NOW_SECONDS - 8 * 3600, endedAt: NOW_SECONDS - 1 * 3600, approvalState: "APPROVED" }],
    [],
    NOW,
  );
  assert.equal(candidates[0].editable, false);
  assert.equal(candidates[0].approved, true);
});

test("long-session review: a canonical Work Session over 6h is flagged, editable once stopped, always approved=true", () => {
  const candidates = selectLongSessionCandidates(
    [],
    [{ id: 5, videoId: 20, videoTitle: "Canonical marathon", startedAt: NOW_SECONDS - 12 * 3600, endedAt: NOW_SECONDS - 1 * 3600 }],
    NOW,
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "CANONICAL");
  assert.equal(candidates[0].editable, true);
  assert.equal(candidates[0].approved, true);
});

test("long-session review: staging and canonical candidates are combined and sorted newest-first", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Older staging", startedAt: NOW_SECONDS - 20 * 3600, endedAt: NOW_SECONDS - 10 * 3600, approvalState: "PENDING" }],
    [{ id: 5, videoId: 20, videoTitle: "Newer canonical", startedAt: NOW_SECONDS - 9 * 3600, endedAt: NOW_SECONDS - 1 * 3600 }],
    NOW,
  );
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].target, "Newer canonical");
  assert.equal(candidates[1].target, "Older staging");
});

test("long-session review is display-only: never mutates, never truncates a duration, never invents an end time", () => {
  const candidates = selectLongSessionCandidates(
    [{ id: 1, videoId: 10, videoTitle: "Exact math", startedAt: 0, endedAt: 36_001, approvalState: "PENDING" }],
    [],
    new Date(0),
  );
  assert.equal(candidates[0].durationSeconds, 36_001);
});

test("sensor connectivity: no device ever registered is its own distinct state", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  assert.equal(resolveSensorConnectivityStatus(0, null, now), "NO_DEVICE");
});

test("sensor connectivity: a device that has never phoned home is offline, not idle-but-connected", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  assert.equal(resolveSensorConnectivityStatus(1, null, now), "OFFLINE");
});

test("sensor connectivity: a device seen recently is connected regardless of whether a Work Session is open", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const lastSeen = new Date("2026-09-15T11:58:00Z"); // 2 minutes ago
  assert.equal(resolveSensorConnectivityStatus(1, lastSeen, now), "CONNECTED");
});

test("sensor connectivity: a device silent past the staleness window is offline", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const lastSeen = new Date("2026-09-15T11:30:00Z"); // 30 minutes ago
  assert.equal(resolveSensorConnectivityStatus(1, lastSeen, now), "OFFLINE");
});

test("sensor connectivity: right at the staleness boundary is still connected", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const lastSeen = new Date("2026-09-15T11:50:00Z"); // exactly 10 minutes ago
  assert.equal(resolveSensorConnectivityStatus(1, lastSeen, now), "CONNECTED");
});

test("sensor connectivity: minor clock skew in the future does not read as an error state", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const lastSeen = new Date("2026-09-15T12:00:05Z"); // 5s "ahead" of now
  assert.equal(resolveSensorConnectivityStatus(1, lastSeen, now), "CONNECTED");
});

test("device credentials are strong, parseable, hash-only friendly, and scoped", async () => {
  const first = await createSensorCredential();
  const second = await createSensorCredential();
  assert.match(first.token, /^mbs1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first.token, second.token);
  assert.deepEqual(parseSensorToken(first.token)?.publicId, first.publicId);
  assert.equal((await hashSensorToken(first.token)).length, 64);
  assert.notEqual(await hashSensorToken(first.token), first.token);
  assert.equal(parseSensorToken("mbs1.invalid.secret"), null);
  assert.equal(extractBearerToken(new Request("https://example.test", { headers: { authorization: `Bearer ${first.token}` } })), first.token);
  assert.deepEqual([...parseScopes(SENSOR_SCOPES.join(","))], SENSOR_SCOPES);
});

test("sensor session payload accepts canonical timestamps and rejects invalid context", () => {
  const now = 2_000_000_000;
  const input = {
    local_session_id: "52dd6ad8-770e-4bc9-a200-c453fea749cf",
    video_id: 4,
    activity_type: "EDITING",
    started_at: new Date((now - 60) * 1_000).toISOString(),
    ended_at: null,
    note: "Local QA",
  };
  assert.equal(validateSensorSessionInput(input, now).success, true);
  assert.equal(validateSensorSessionInput({ ...input, video_id: 0 }, now).success, false);
  assert.equal(validateSensorSessionInput({ ...input, activity_type: "TYPING" }, now).success, false);
  assert.equal(validateSensorSessionInput({ ...input, ended_at: new Date((now - 120) * 1_000).toISOString() }, now).success, false);
  assert.equal(validateSensorStopInput({ local_session_id: input.local_session_id, ended_at: new Date(now * 1_000).toISOString() }, now).success, true);
});

test("observation privacy contract accepts aggregates but no raw input fields", () => {
  const now = 2_000_000_000;
  const row = {
    local_observation_id: "1e314ee3-5df6-4c95-b460-104275ae4da3",
    started_at: new Date((now - 60) * 1_000).toISOString(),
    ended_at: new Date(now * 1_000).toISOString(),
    app_name: "Premiere Pro",
    bundle_id: "com.adobe.PremierePro",
    window_title: null,
    idle: false,
    keystroke_count: 12,
    mouse_movement_count: 8,
  };
  const parsed = validateObservationBatch({ observations: [row] }, now);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(Object.keys(parsed.data[0]).sort(), [
      "appName", "bundleId", "endedAt", "idle", "keystrokeCount",
      "localObservationId", "mouseMovementCount", "startedAt", "windowTitle",
    ].sort());
  }
  assert.equal(validateObservationBatch({ observations: [{ ...row, keystroke_count: -1 }] }, now).success, false);
  assert.equal(validateObservationBatch({ observations: [{ ...row, key_code: 36 }] }, now).success, false);
  assert.equal(validateObservationBatch({ observations: [{ ...row, coordinates: [10, 20] }] }, now).success, false);
  assert.equal(validateObservationBatch({ observations: [{ ...row, ended_at: new Date((now - 61) * 1_000).toISOString() }] }, now).success, false);
  assert.equal(validateObservationBatch({ observations: [] }, now).success, false);
});
