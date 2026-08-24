import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSOR_SCOPES,
  createSensorCredential,
  extractBearerToken,
  hashSensorToken,
  parseScopes,
  parseSensorToken,
  validateObservationBatch,
  validateSensorSessionInput,
  validateSensorStopInput,
} from "./core.ts";

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
