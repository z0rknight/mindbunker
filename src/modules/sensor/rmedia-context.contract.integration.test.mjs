import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (url) => readFileSync(new URL(url, import.meta.url), "utf8");

test("Quick Capture writes only captures and resolves canonical context server-side", () => {
  const route = read("../../app/api/sensor/v1/captures/route.ts");
  assert.match(route, /resolveCaptureSessionAtOccurredAt/u);
  assert.match(route, /input\.occurredAt/u);
  assert.match(route, /work_sessions ws/u);
  assert.match(route, /JOIN video_logs/u);
  assert.match(route, /LEFT JOIN projects/u);
  assert.match(route, /LEFT JOIN clients/u);
  assert.match(route, /SENSOR_CAPTURE_INSERT_SQL/u);
  assert.doesNotMatch(route, /INSERT INTO (?:clients|projects|video_logs|work_sessions|transactions|billing_evidence)/u);
  assert.doesNotMatch(route, /UPDATE (?:clients|projects|video_logs|work_sessions|transactions|billing_evidence)/u);
});

test("RMEDIA Start and End touch canonical Work Sessions but never finish a Video", () => {
  const execution = read("./canonical-execution.ts");
  const core = read("./core.ts");
  assert.match(execution, /RMEDIA_CANONICAL_START_SQL/u);
  assert.match(execution, /RMEDIA_CANONICAL_END_SQL/u);
  assert.match(core, /INSERT INTO work_sessions/u);
  assert.match(core, /source, sensor_device_id/u);
  assert.match(core, /'MAC_SENSOR'/u);
  assert.match(core, /UPDATE work_sessions SET ended_at/u);
  assert.doesNotMatch(execution, /UPDATE video_logs/u);
  assert.doesNotMatch(execution, /INSERT INTO (?:clients|projects|video_logs|transactions|billing_evidence)/u);
});

test("Context Snapshot schema is explicitly versioned and prohibited raw input is rejected", () => {
  const core = read("./core.ts");
  assert.match(core, /input\.schema_version !== 1/u);
  assert.match(core, /contextSnapshot\.schemaVersion !== 1/u);
  assert.match(core, /typedText\|keystrokeContent\|pressedKeys\|screenshot\|audioRecording/u);
});
