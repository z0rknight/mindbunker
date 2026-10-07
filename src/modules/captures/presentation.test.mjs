import assert from "node:assert/strict";
import test from "node:test";

import { isRmediaQuickCapture, projectRmediaCaptureEvidence } from "./presentation.ts";

const occurredAt = new Date("2026-10-07T01:59:36.000Z");
const recordedAt = new Date("2026-10-07T02:03:00.000Z");

test("RMEDIA evidence exposes occurred time, canonical Session and target without changing provenance", () => {
  const result = projectRmediaCaptureEvidence({
    source: "MAC_SENSOR",
    localCaptureId: "52dd6ad8-770e-4bc9-a200-c453fea749cf",
    canonicalWorkSessionId: 105,
    startedAt: occurredAt,
    createdAt: recordedAt,
    contextSnapshotJson: JSON.stringify({
      normalizedApplication: "Premiere Pro",
      canonicalExecution: {
        workSessionID: 105,
        videoID: 86,
        videoTitle: "Offer Doc",
        projectName: "GEOFF - September Long Form Videos",
        clientName: "Taryn",
      },
      integrityIssues: [],
    }),
  });

  assert.deepEqual(result, {
    occurredAt,
    recordedAt,
    canonicalWorkSessionId: 105,
    videoId: 86,
    videoTitle: "Offer Doc",
    projectName: "GEOFF - September Long Form Videos",
    clientName: "Taryn",
    observedApplication: "Premiere Pro",
    integrityIssues: [],
  });
});

test("no-session RMEDIA capture stays unassociated and malformed snapshot fails closed", () => {
  const result = projectRmediaCaptureEvidence({
    source: "MAC_SENSOR",
    localCaptureId: "52dd6ad8-770e-4bc9-a200-c453fea749cf",
    canonicalWorkSessionId: null,
    startedAt: occurredAt,
    createdAt: recordedAt,
    contextSnapshotJson: "{not-json",
  });

  assert.equal(result?.canonicalWorkSessionId, null);
  assert.equal(result?.videoId, null);
  assert.equal(result?.videoTitle, null);
  assert.equal(result?.observedApplication, null);
  assert.deepEqual(result?.integrityIssues, []);
});

test("ordinary web Capture does not masquerade as RMEDIA evidence", () => {
  assert.equal(projectRmediaCaptureEvidence({
    source: "WEB_QUICK_CAPTURE",
    localCaptureId: null,
    canonicalWorkSessionId: null,
    startedAt: null,
    createdAt: recordedAt,
    contextSnapshotJson: null,
  }), null);
});

test("only native idempotent Quick Captures enter the read-only RMEDIA lane", () => {
  assert.equal(isRmediaQuickCapture({ source: "MAC_SENSOR", localCaptureId: "capture-1" }), true);
  assert.equal(isRmediaQuickCapture({ source: "MAC_SENSOR", localCaptureId: null }), false);
  assert.equal(isRmediaQuickCapture({ source: "WEB_QUICK_CAPTURE", localCaptureId: "capture-1" }), false);
});
