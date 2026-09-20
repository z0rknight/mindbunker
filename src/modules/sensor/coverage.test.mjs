import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  aggregateIntentionalAppTime,
  computeSessionCoverage,
  mergeIntervals,
  normalizeApplication,
  resolveSessionOverlaps,
  sessionCoveragePercent,
} from "./app-intelligence.ts";

const obs = (appKey, startedAt, endedAt, idle = false, surface = null) => ({ appKey, surface, startedAt, endedAt, idle });
const sess = (startedAt, endedAt, contextType = "CLIENT") => ({ contextType, startedAt, endedAt });

test("overlapping sessions are resolved chronologically: the earlier keeps the seconds, none is counted twice", () => {
  const out = resolveSessionOverlaps([sess(50, 200, "INTERNAL"), sess(0, 100, "CLIENT")]);
  assert.deepEqual(out.map((s) => [s.contextType, s.startedAt, s.endedAt]), [["CLIENT", 0, 100], ["INTERNAL", 100, 200]]);
  assert.deepEqual(resolveSessionOverlaps([sess(0, 100), sess(10, 90)]).length, 1, "a swallowed session drops out");
  assert.deepEqual(resolveSessionOverlaps([]), []);
});

test("intentional app time never double-counts overlapping sessions", () => {
  const observations = [obs("PREMIERE_PRO", 0, 100)];
  const overlapping = [sess(0, 80, "CLIENT"), sess(40, 100, "INTERNAL")];
  const total = aggregateIntentionalAppTime(observations, overlapping, 0, 1000);
  assert.equal(total.length, 1);
  assert.equal(total[0].seconds, 100, "100s of foreground time counts once, not 140s");
  assert.deepEqual(total[0].byContext, { CLIENT: 80, INTERNAL: 20 });
});

test("a CORRECTED session timestamp changes the intersection on the next read (nothing is cached)", () => {
  const observations = [obs("PREMIERE_PRO", 0, 100), obs("SAFARI", 100, 200)];
  const before = aggregateIntentionalAppTime(observations, [sess(0, 100, "INTERNAL")], 0, 1000);
  const after = aggregateIntentionalAppTime(observations, [sess(0, 200, "INTERNAL")], 0, 1000); // operator corrected the end time
  assert.deepEqual(before.map((r) => [r.appKey, r.seconds]), [["PREMIERE_PRO", 100]]);
  assert.deepEqual(after.map((r) => [r.appKey, r.seconds]), [["PREMIERE_PRO", 100], ["SAFARI", 100]]);
  const covBefore = computeSessionCoverage(observations, [sess(0, 100)], 0, 1000);
  const covAfter = computeSessionCoverage(observations, [sess(0, 200)], 0, 1000);
  assert.equal(covBefore.sessionSeconds, 100);
  assert.equal(covAfter.sessionSeconds, 200);
});

test("merge intervals is a plain union", () => {
  assert.deepEqual(mergeIntervals([{ startedAt: 5, endedAt: 10 }, { startedAt: 0, endedAt: 6 }, { startedAt: 20, endedAt: 25 }, { startedAt: 25, endedAt: 30 }]), [{ startedAt: 0, endedAt: 10 }, { startedAt: 20, endedAt: 30 }]);
  assert.deepEqual(mergeIntervals([{ startedAt: 5, endedAt: 5 }]), []);
});

test("session coverage: sessions vs telemetry vs active vs idle vs unknown, never normalised to 100%", () => {
  // session 0..1000; telemetry covers 0..600 (400 active, 200 idle); 400s has no telemetry
  const observations = [obs("PREMIERE_PRO", 0, 400), obs("FINDER", 400, 600, true)];
  const cov = computeSessionCoverage(observations, [sess(0, 1000)], 0, 10_000);
  assert.deepEqual(cov, { sessionSeconds: 1000, telemetrySeconds: 600, activeSeconds: 400, idleSeconds: 200, uncoveredSeconds: 400 });
  assert.equal(sessionCoveragePercent(cov), 60);
});

test("coverage is clamped to the window and ignores telemetry outside any session", () => {
  const observations = [obs("SAFARI", 0, 10_000)];
  const cov = computeSessionCoverage(observations, [sess(1000, 2000)], 1500, 5000);
  assert.equal(cov.sessionSeconds, 500);
  assert.equal(cov.telemetrySeconds, 500);
  assert.equal(cov.uncoveredSeconds, 0);
});

test("no sessions -> zero coverage and a null percentage (no divide-by-zero, no fake 100%)", () => {
  const cov = computeSessionCoverage([obs("SAFARI", 0, 100)], [], 0, 1000);
  assert.deepEqual(cov, { sessionSeconds: 0, telemetrySeconds: 0, activeSeconds: 0, idleSeconds: 0, uncoveredSeconds: 0 });
  assert.equal(sessionCoveragePercent(cov), null);
});

test("app vs web-surface semantics are unchanged: Safari stays Safari, unknown bundles stay OTHER", () => {
  assert.equal(normalizeApplication("com.apple.Safari", "Safari"), "SAFARI");
  assert.equal(normalizeApplication("com.openai.codex", "ChatGPT"), "CHATGPT");
  assert.equal(normalizeApplication("com.example.unknown", "Whatever"), "OTHER");
});

// ── source pins ─────────────────────────────────────────────────────────────
const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the intentional query excludes DELETED sessions and derives coverage at read time", () => {
  const data = src("./data.ts");
  assert.match(data, /FROM sensor_sessions[\s\S]{0,300}approval_state != 'DELETED'/u);
  assert.match(data, /computeSessionCoverage\(observations, sessions, window\.startSeconds, window\.endSeconds\)/u);
  assert.doesNotMatch(data, /cache|memo|revalidate.*coverage/iu);
});

test("Sensor Activity discloses intentional coverage and the missing browser-surface telemetry, without judgement", () => {
  const page = src("../../app/productivity/sensor/page.tsx");
  assert.match(page, /data-testid="intentional-coverage"/u);
  assert.match(page, /with no telemetry \(unknown, not zero\)/u);
  assert.match(page, /data-testid="surface-disclosure"/u);
  assert.match(page, /withWindowTitle === 0/u);
  for (const forbidden of [/productivity score/iu, /focus score/iu, /good day/iu, /bad day/iu, /efficiency/iu, /distract/iu]) {
    assert.doesNotMatch(page, forbidden, String(forbidden));
  }
});
