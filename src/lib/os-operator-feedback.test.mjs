// Train M3: operator status / table / queue feedback. Presentation only: the
// canonical actions and read models are untouched; these tests pin the change
// detection rules, the server-truth resolve flow, static-vs-live Sensor states,
// first-render silence, reduced-motion behaviour and the wiring on real surfaces.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

import { changedKeys, flashTarget, goneIds, newIds } from "./os/change.ts";
import { INITIAL_RESOLVE_STATE, RESOLVE_ERROR_FALLBACK, RESOLVE_HOLD_MS, resolveReducer } from "./os/resolve-flow.ts";
import { sensorIndicator } from "../modules/sensor/core.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const load = (p) => tsImport(p, import.meta.url);
const run = (events, from = INITIAL_RESOLVE_STATE) => events.reduce(resolveReducer, from);

// ── change detection ─────────────────────────────────────────────────────
test("changedKeys: only fields whose values differ; identical snapshots change nothing", () => {
  const a = { duration: 600, video: 3, note: null, start: "t0" };
  assert.deepEqual(changedKeys(a, { ...a }), []);
  assert.deepEqual(changedKeys(a, { ...a, duration: 900 }), ["duration"]);
  assert.deepEqual(changedKeys(a, { ...a, note: "x" }), ["note"]);
  assert.deepEqual(changedKeys(a, { ...a, duration: 900, video: 4 }).toSorted(), ["duration", "video"]);
  assert.deepEqual(changedKeys({ a: 1 }, { a: 1, b: 2 }), ["b"]);
});

test("flashTarget: the smallest truthful target (cell for one field, row for several, none otherwise)", () => {
  assert.deepEqual(flashTarget([]), { kind: "none" });
  assert.deepEqual(flashTarget(["duration"]), { kind: "cell", key: "duration" });
  assert.deepEqual(flashTarget(["duration", "end"]), { kind: "row" });
});

test("newIds: only ids that were absent before, in list order; the initial list is never 'new'", () => {
  assert.deepEqual(newIds(["a", "b"], ["a", "b"]), []);
  assert.deepEqual(newIds(["a", "b"], ["c", "a", "d", "b"]), ["c", "d"]);
  assert.deepEqual(newIds(["a", "b"], ["a"]), [], "a removal is not an arrival");
  assert.deepEqual(newIds([], ["a"]), ["a"]);
});

test("goneIds: items that left the queue, in previous order; additions are not departures", () => {
  assert.deepEqual(goneIds(["a", "b", "c"], ["a", "c"]), ["b"]);
  assert.deepEqual(goneIds(["a", "b"], ["a", "b", "c"]), []);
  assert.deepEqual(goneIds(["a", "b"], []), ["a", "b"]);
  assert.deepEqual(goneIds([], ["a"]), []);
});

// ── resolve flow (exception resolution) ──────────────────────────────────
test("resolve flow follows server truth: resolved only from submitting, failure returns to idle", () => {
  const submitting = run([{ type: "submit", action: "approve" }]);
  assert.equal(submitting.phase, "submitting");
  assert.equal(run([{ type: "succeeded" }]).phase, "idle", "no optimistic resolution");
  const done = run([{ type: "succeeded" }], submitting);
  assert.deepEqual([done.phase, done.action], ["resolved", "approve"]);
  assert.equal(run([{ type: "submit", action: "archive" }], done).action, "approve", "a resolved item cannot be resubmitted");
  const failed = run([{ type: "failed", error: "Session not found." }], submitting);
  assert.deepEqual([failed.phase, failed.error], ["idle", "Session not found."]);
  assert.equal(run([{ type: "failed", error: "" }], submitting).error, RESOLVE_ERROR_FALLBACK);
  assert.equal(run([{ type: "submit", action: "a" }, { type: "submit", action: "b" }]).action, "a", "double submit ignored");
  assert.ok(RESOLVE_HOLD_MS >= 800 && RESOLVE_HOLD_MS <= 1500, "the confirmation is visible but the item does not linger");
});

// ── Sensor truth: only live animates ─────────────────────────────────────
test("sensorIndicator keeps the four states distinct and animates only connected + open Work Session", () => {
  assert.deepEqual(sensorIndicator("NO_DEVICE", false), { state: "NO_DEVICE", live: false });
  assert.deepEqual(sensorIndicator("NO_DEVICE", true), { state: "NO_DEVICE", live: false });
  assert.deepEqual(sensorIndicator("OFFLINE", true), { state: "OFFLINE", live: false }, "offline never looks live");
  assert.deepEqual(sensorIndicator("CONNECTED", false), { state: "CONNECTED_IDLE", live: false });
  assert.deepEqual(sensorIndicator("CONNECTED", true), { state: "CONNECTED_ACTIVE", live: true });
  const states = new Set(["NO_DEVICE", "OFFLINE", "CONNECTED_IDLE", "CONNECTED_ACTIVE"].map((s) => s));
  assert.equal(states.size, 4);
  const page = read("../app/productivity/sensor/page.tsx");
  assert.match(page, /indicator\.live \?/);
  assert.match(page, /data-sensor-state=\{indicator\.state\}/);
});

// ── primitives render quietly on first paint ─────────────────────────────
test("ValueChange: static first render, current value only, no outgoing layer", async () => {
  const { ValueChange } = await load("../components/os/ValueChange.tsx");
  const html = renderToStaticMarkup(createElement(ValueChange, { value: 3 }));
  assert.match(html, /^<span class="os-vc"><span class="os-vc-in">3<\/span><\/span>$/);
  assert.doesNotMatch(html, /os-vc-out|data-enter|aria-hidden/);
});

test("NewBadge is a word (not colour-only); ArrivalItem is silent on first render", async () => {
  const { NewBadge } = await load("../components/os/NewBadge.tsx");
  assert.match(renderToStaticMarkup(createElement(NewBadge, {})), />New<\/span>/);
  const { ArrivalScope, ArrivalItem } = await load("../components/os/Arrivals.tsx");
  const html = renderToStaticMarkup(
    createElement(ArrivalScope, { ids: ["s1", "s2"] }, createElement(ArrivalItem, { id: "s1", className: "row" }, "Signal")),
  );
  assert.match(html, /^<div class="os-flash os-arrive row">Signal<\/div>$/);
  assert.doesNotMatch(html, /data-flash|data-enter|New/);
});

test("BatchProgress is shared by the client dashboard and the operator order page", async () => {
  const { BatchProgress } = await load("../components/os/BatchProgress.tsx");
  const items = [{ id: 1, status: "DONE" }, { id: 2, status: "READY_FOR_REVIEW" }, { id: 3, status: "PLANNED" }];
  const html = renderToStaticMarkup(createElement(BatchProgress, { items }));
  assert.match(html, /1 of 3 completed · 1 in review · 1 planned/);
  assert.match(read("../app/client/dashboard/page.tsx"), /@\/components\/os\/BatchProgress/);
  assert.match(read("../app/productivity/orders/[id]/page.tsx"), /<BatchProgress items=\{activeItems\.map/);
});

test("Needs Attention keeps its server-rendered data and links; first paint has no NEW marker", async () => {
  const { NeedsAttentionSection } = await load("../app/productivity/NeedsAttentionSection.tsx");
  const groups = [
    { kind: "MISSING_REVIEW_URL", label: "Missing review URL", severity: "ACTION", signals: [
      { id: "a", statement: "Story cut needs a review link", evidence: "READY_FOR_REVIEW", action: { label: "Fix", href: "/productivity?video=1" } },
      { id: "b", statement: "Hero needs a review link", evidence: "READY_FOR_REVIEW", action: null },
    ] },
  ];
  const html = renderToStaticMarkup(createElement(NeedsAttentionSection, { groups }));
  assert.match(html, /Story cut needs a review link/);
  assert.match(html, /<span class="os-vc"><span class="os-vc-in">2<\/span><\/span>/, "group count through ValueChange");
  assert.doesNotMatch(html, /os-new-label|data-enter|data-flash/);
  assert.match(html, /href="\/productivity\?video=1&amp;returnTo=/, "returnTo continuity is untouched");
});

// ── reduced motion ───────────────────────────────────────────────────────
test("reduced motion: outgoing value layer removed, entrance animations off, flash markers kept", () => {
  const css = read("../app/globals.css");
  assert.match(css, /\.os-vc-out \{ display: none; \}/);
  assert.match(css, /\.os-vc-in\[data-enter\], \.os-arrive\[data-enter\] \{ animation: none; \}/);
  assert.match(css, /html\[data-motion="reduced"\] \.os-vc-out \{ display: none; \}/);
  const m3 = css.slice(css.indexOf("M3: operator feedback"));
  const reduced = m3.slice(m3.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.doesNotMatch(reduced, /data-flash/, "the static changed/new marker must survive reduced motion");
  assert.match(m3, /tr\.os-flash\[data-flash="brand"\] > td:first-child \{ box-shadow: inset 2px 0 0 var\(--os-violet-text\); \}/);
});

// ── real-surface wiring ──────────────────────────────────────────────────
test("Work Session table marks the smallest truthful target and never on first render", () => {
  const src = read("../app/productivity/sessions/WorkSessionHistoryTable.tsx");
  assert.match(src, /useChangedKeys\(\{/);
  assert.match(src, /const target = flashTarget\(changedFields\);/);
  assert.match(src, /target\.kind === "row" \? "brand" : undefined/);
  for (const key of ["duration", "note", "activity", "video", "client", "project"]) {
    assert.match(src, new RegExp(`cellFlash\\("${key}"\\)`), key);
  }
  assert.match(src, /correctWorkSession\(session\.id/, "the canonical correction is unchanged");
});

test("Sensor session actions: server answer -> succeeded -> hold -> refresh; focus is kept and restored", () => {
  const src = read("../app/productivity/sensor/SensorSessionActions.tsx");
  const call = src.indexOf("await perform.run(action)");
  const guard = src.indexOf("if (!result.success)");
  const ok = src.indexOf('dispatch({ type: "succeeded" })');
  const timeout = src.indexOf("setTimeout(() => {", ok);
  const refresh = src.indexOf("router.refresh()", ok);
  const hold = src.indexOf("}, RESOLVE_HOLD_MS)", ok);
  assert.ok(call > 0 && call < guard && guard < ok && ok < timeout && timeout < refresh && refresh < hold, "answer -> success -> hold timer -> refresh");
  assert.doesNotMatch(src.slice(0, call), /type: "succeeded"/);
  assert.match(src, /if \(busy\.current \|\| resolve\.phase !== "idle"\) return;/);
  assert.match(src, /ackRef\.current\?\.focus/);
  assert.match(src, /rememberFocusLandmark\(rootRef\.current\)/);
  assert.match(src, /approveSensorSession\(id\)[\s\S]*archiveSensorSession\(id\)[\s\S]*deleteArchivedSensorSession\(id\)/);
  assert.match(src, /role="alert"/);
});

test("War Room stage: arrivals + changes only, BLOCKED and elapsed time stay out of the flash", () => {
  const src = read("../app/war-room/restaurant/WarRoomRestaurantStage.tsx");
  assert.match(src, /<ArrivalScope ids=\{tickets\.map/);
  assert.match(src, /useUpdateFlash\(`\$\{ticket\.phase\}\|\$\{ticket\.itemCount\}`/);
  assert.match(src, /client\.health === "BLOCKED" \? undefined : healthFlash/);
  const key = src.slice(src.indexOf("const stationKey"), src.indexOf("const stationFlash"));
  assert.doesNotMatch(key, /elapsed/i, "the periodic elapsed time must not retrigger the marker");
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /pointer-events-none absolute left-1\/2 top-\[26%\] flex -translate-x-1\/2 flex-col items-center gap-1/, "layout of the station is unchanged");
});

test("DepartureNotice: silent on first render; the live region is mounted before it speaks", async () => {
  const { DepartureNotice } = await load("../components/os/DepartureNotice.tsx");
  const html = renderToStaticMarkup(createElement(DepartureNotice, { ids: ["inbox:1", "inbox:2"], noun: "session" }));
  assert.match(html, /^<p class="sr-only" role="status" aria-live="polite"><\/p>$/);
  const src = read("../app/productivity/sensor/page.tsx");
  assert.match(src, /<DepartureNotice ids=\{data\.inbox\.map/);
  assert.match(src, /<ValueChange value=\{data\.inbox\.length\} \/> pending/);
});

test("Sensor actions restore focus even when the item already left the revalidated list", () => {
  const src = read("../app/productivity/sensor/SensorSessionActions.tsx");
  const remember = src.indexOf("rememberFocusLandmark(rootRef.current)");
  const submit = src.indexOf('dispatch({ type: "submit", action: name })');
  assert.ok(remember > 0 && remember < submit, "the landmark is captured before submitting");
  assert.match(src, /setTimeout\(restoreFocus, 350\)/);
  assert.match(src, /if \(!mounted\.current\) return;/);
});

test("no optimistic business state and no toast system were introduced", () => {
  for (const f of ["../components/os/hooks.ts", "../components/os/Arrivals.tsx", "../components/os/ValueChange.tsx", "../components/os/focus.ts", "../components/os/DepartureNotice.tsx"]) {
    assert.doesNotMatch(read(f), /@\/modules|@\/db|useOptimistic|toast/i, f);
  }
  assert.doesNotMatch(read("../app/productivity/sensor/SensorSessionActions.tsx"), /useOptimistic|toast/i);
});
