// RMEDIA OS motion foundation (Train M1): token contract, reduced motion,
// pending gate, feedback attributes, primitives (server-rendered), and the
// aria-current / intensity wiring. Presentation only: no business logic.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

import {
  OS_FLASH_HOLD_MS,
  OS_INTENSITY_SCALE,
  OS_MOTION_MS,
  OS_PENDING,
  OS_REDUCED_SCALE,
  osDurationMs,
} from "./os/motion.ts";
import { createPendingGate } from "./os/pending-gate.ts";
import { FLASH_TONES, STATUS_TONES, actionButtonAttrs, statusTransitionAttrs } from "./os/feedback.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../app/globals.css");
const osCss = css.slice(css.indexOf("RMEDIA OS motion foundation"));

// ── tokens ────────────────────────────────────────────────────────────────
test("motion tokens: durations, easing and shifts match the lab contract", () => {
  for (const [name, ms] of Object.entries(OS_MOTION_MS)) {
    assert.match(osCss, new RegExp(`--os-motion-${name}: calc\\(${ms}ms \\* var\\(--os-motion-scale\\)\\);`), name);
  }
  assert.match(osCss, /--os-ease: cubic-bezier\(\.2, 0, 0, 1\);/);
  assert.match(osCss, /--os-ease-exit: cubic-bezier\(\.4, 0, 1, 1\);/);
  assert.match(osCss, /--os-shift-sm: 4px;/);
  assert.match(osCss, /--os-shift-md: 8px;/);
});

test("intensity: scalars match and derived tokens are re-declared inside [data-intensity]", () => {
  for (const [name, k] of Object.entries(OS_INTENSITY_SCALE)) {
    assert.match(osCss, new RegExp(`\\[data-intensity="${name}"\\] \\{ --os-motion-scale: ${String(k).replace(/^0/, "")};`), name);
  }
  // Regression (lab bug): derived durations must be declared on :root AND [data-intensity].
  assert.match(osCss, /:root,\n\[data-intensity\] \{\n  --os-motion-fast:/);
  assert.equal(osDurationMs("fast", "operator"), 96);
  assert.equal(osDurationMs("exit", "client"), 140);
  assert.equal(osDurationMs("panel", "public"), 300);
  assert.ok(osDurationMs("panel", "operator", true) < 0.1);
  assert.equal(OS_REDUCED_SCALE, 0.0001);
});

test("root and client layouts set the intensity scope", () => {
  assert.match(read("../app/layout.tsx"), /data-intensity="operator"/);
  assert.match(read("../app/client/layout.tsx"), /data-intensity="client"/);
});

// ── reduced motion ────────────────────────────────────────────────────────
test("reduced motion honours the real media query, after the intensity rules, and keeps state markers", () => {
  const media = osCss.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(media > osCss.indexOf('[data-intensity="operator"]'), "media block must come after intensity rules");
  const block = osCss.slice(media, osCss.indexOf("html[data-motion=\"reduced\"],"));
  assert.match(block, /--os-motion-scale: \.0001/);
  assert.match(block, /--os-shift-sm: 0px/);
  assert.match(block, /--os-shift-md: 0px/);
  assert.match(block, /\[data-intensity\]/);
  assert.match(block, /\.os-act\[data-state="loading"\]::after \{ animation: none; transform: scaleX\(\.5\); \}/);
  assert.doesNotMatch(block, /data-flash/, "the flash marker must survive reduced motion");
  assert.doesNotMatch(block, /display:\s*none/, "no information may disappear");
  assert.match(osCss, /html\[data-motion="reduced"\],\nhtml\[data-motion="reduced"\] \[data-intensity\]/);
});

test("UpdateFlash CSS: tint + 2px edge, tone set has no error, no transform/animation on .os-flash", () => {
  assert.deepEqual([...FLASH_TONES], ["success", "brand", "warning"]);
  for (const tone of FLASH_TONES) assert.match(osCss, new RegExp(`\\.os-flash\\[data-flash="${tone}"\\][^}]*inset 2px 0 0`));
  const base = osCss.match(/\.os-flash \{[^}]*\}/)[0];
  assert.match(base, /transition: background-color/);
  assert.doesNotMatch(base, /transform|animation/);
  assert.equal(OS_FLASH_HOLD_MS, 1400);
});

// ── pending gate ──────────────────────────────────────────────────────────
function fakeTimers() {
  let t = 0, seq = 0;
  const q = new Map();
  return {
    timers: {
      setTimeout(fn, ms) { const id = ++seq; q.set(id, { at: t + ms, fn }); return id; },
      clearTimeout(id) { q.delete(id); },
      now: () => t,
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...q.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        t = next[1].at; q.delete(next[0]); next[1].fn();
      }
      t = end;
    },
    pending: () => q.size,
  };
}

test("pending gate: a wait shorter than the delay never becomes visible (no flicker)", () => {
  const { timers, advance, pending } = fakeTimers();
  const calls = [];
  const gate = createPendingGate({ onChange: (v) => calls.push(v), timers });
  gate.set(true); advance(149); gate.set(false); advance(1000);
  assert.deepEqual(calls, []);
  assert.equal(gate.isVisible(), false);
  assert.equal(pending(), 0);
  assert.deepEqual([OS_PENDING.delayMs, OS_PENDING.minVisibleMs], [150, 300]);
});

test("pending gate: appears at 150ms and stays at least 300ms once visible", () => {
  const { timers, advance } = fakeTimers();
  const calls = [];
  const gate = createPendingGate({ onChange: (v) => calls.push(v), timers });
  gate.set(true); advance(150);
  assert.deepEqual(calls, [true]);
  advance(50); gate.set(false);           // finished 50ms after it appeared
  assert.equal(gate.isVisible(), true);   // held for the minimum
  advance(249); assert.deepEqual(calls, [true]);
  advance(1); assert.deepEqual(calls, [true, false]);
});

test("pending gate: a long wait hides immediately when it ends; re-arming during the hold cancels the hide", () => {
  const a = fakeTimers(); const ca = [];
  const g1 = createPendingGate({ onChange: (v) => ca.push(v), timers: a.timers });
  g1.set(true); a.advance(150 + 500); g1.set(false);
  assert.deepEqual(ca, [true, false]);

  const b = fakeTimers(); const cb = [];
  const g2 = createPendingGate({ onChange: (v) => cb.push(v), timers: b.timers });
  g2.set(true); b.advance(150); g2.set(false); b.advance(100); g2.set(true); b.advance(1000);
  assert.deepEqual(cb, [true]);           // stayed visible, never flickered off/on
  g2.set(false); assert.deepEqual(cb, [true, false]);
});

test("pending gate: duplicate set calls are idempotent and dispose cleans up without callbacks", () => {
  const { timers, advance, pending } = fakeTimers();
  const calls = [];
  const gate = createPendingGate({ onChange: (v) => calls.push(v), timers });
  gate.set(true); gate.set(true); assert.equal(pending(), 1);
  gate.dispose(); assert.equal(pending(), 0);
  advance(1000); gate.set(true);
  assert.deepEqual(calls, []);
  const g2 = createPendingGate({ onChange: (v) => calls.push(v), timers });
  g2.set(true); advance(150); g2.set(false); g2.dispose(); advance(1000);
  assert.deepEqual(calls, [true]);        // no late hide after dispose (unmount safety)
  assert.equal(pending(), 0);
});

// ── attributes ────────────────────────────────────────────────────────────
test("actionButtonAttrs: aria-busy/aria-disabled while pending, never disabled, states are caller-supplied", () => {
  assert.deepEqual(actionButtonAttrs({ pending: false, loading: false }), { "data-state": "idle" });
  const p = actionButtonAttrs({ pending: true, loading: false });
  assert.deepEqual(p, { "data-state": "pending", "aria-busy": true, "aria-disabled": true });
  assert.equal("disabled" in p, false, "focus must stay: aria-disabled, not disabled");
  assert.equal(actionButtonAttrs({ pending: true, loading: true })["data-state"], "loading");
  assert.equal(actionButtonAttrs({ pending: false, loading: false, state: "success" })["data-state"], "success");
  assert.equal(actionButtonAttrs({ pending: false, loading: false, state: "error" })["data-state"], "error");
  assert.equal(actionButtonAttrs({ pending: false, loading: false, disabled: true }).disabled, true);
  // success must never appear while still pending (the caller cannot pre-empt truth)
  assert.equal(actionButtonAttrs({ pending: true, loading: false, state: "success" })["data-state"], "pending");
});

test("statusTransitionAttrs: renders supplied tone/marker/status, defaults are neutral", () => {
  assert.deepEqual(statusTransitionAttrs({}), { "data-tone": "neutral", "data-marker": "dot", "data-status": undefined });
  assert.equal(statusTransitionAttrs({ tone: "success", marker: "check", status: "paid" })["data-status"], "paid");
  assert.ok(STATUS_TONES.includes("pending"));
});

// ── primitives, server-rendered (static correctness, no motion involved) ───
const load = (p) => tsImport(p, import.meta.url);

test("StatusTransition renders label, tone and no entering animation on first render", async () => {
  const { StatusTransition } = await load("../components/os/StatusTransition.tsx");
  const html = renderToStaticMarkup(createElement(StatusTransition, { label: "Approved", tone: "success", marker: "check", status: "done" }));
  assert.match(html, /class="os-st"/);
  assert.match(html, /data-tone="success"/);
  assert.match(html, /data-marker="check"/);
  assert.match(html, /data-status="done"/);
  assert.match(html, /<svg class="os-ck"/);
  assert.match(html, />Approved<\/span>/);
  assert.doesNotMatch(html, /data-enter/);
  const inline = renderToStaticMarkup(createElement(StatusTransition, { label: "Copy", variant: "inline", marker: "none" }));
  assert.match(inline, /os-st os-st-inline/);
  assert.doesNotMatch(inline, /<svg/);
});

test("ActionButton renders idle/pending/loading semantics and success only when supplied", async () => {
  const { ActionButton } = await load("../components/os/ActionButton.tsx");
  const idle = renderToStaticMarkup(createElement(ActionButton, {}, "Save"));
  assert.match(idle, /^<button type="button" data-state="idle" class="os-act">Save<\/button>$/);
  const pending = renderToStaticMarkup(createElement(ActionButton, { pending: true }, "Save"));
  assert.match(pending, /data-state="pending"/);   // not yet visible: SSR/first paint never shows loading
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /aria-disabled="true"/);
  assert.doesNotMatch(pending, /disabled=""/);
  const done = renderToStaticMarkup(createElement(ActionButton, { state: "success" }, "Save"));
  assert.match(done, /data-state="success"/);
  assert.match(done, /os-ck/);
  const submit = renderToStaticMarkup(createElement(ActionButton, { type: "submit", className: "x" }, "Go"));
  assert.match(submit, /type="submit"/);
  assert.match(submit, /class="os-act x"/);
});

test("UpdateFlash does not flash on first render and keeps the os-flash class", async () => {
  const { UpdateFlash } = await load("../components/os/UpdateFlash.tsx");
  const html = renderToStaticMarkup(createElement(UpdateFlash, { as: "li", changeKey: 1, tone: "success", className: "row" }, "x"));
  assert.match(html, /^<li class="os-flash row">x<\/li>$/);
  assert.doesNotMatch(html, /data-flash/);
});

// ── purity + a11y wiring ─────────────────────────────────────────────────
test("primitives own no business truth (no modules/db/router/revalidation imports)", () => {
  for (const f of ["hooks.ts", "ActionButton.tsx", "StatusTransition.tsx", "UpdateFlash.tsx"]) {
    const src = read(`../components/os/${f}`);
    assert.doesNotMatch(src, /@\/modules|@\/db|next\/navigation|revalidate|router\./, f);
  }
  const hooks = read("../components/os/hooks.ts");
  assert.match(hooks, /created\.dispose\(\)/, "gate is disposed on unmount");
  assert.match(hooks, /mounted\.current = false/, "useAction ignores late state updates after unmount");
});

test("active navigation exposes aria-current on both the desktop and mobile nav", () => {
  const src = read("../components/layout/Sidebar.tsx");
  assert.equal(src.split('aria-current={isActive ? "page" : undefined}').length - 1, 2);
});

test("proof surfaces: War Room refresh uses ActionButton without changing the refresh logic", () => {
  const src = read("../app/war-room/WarRoomRefreshControl.tsx");
  assert.match(src, /<ActionButton[\s\S]*pending=\{isPending\}/);
  assert.match(src, /router\.refresh\(\)/);
  assert.match(src, /REFRESH_INTERVAL_MS = 30_000/);
});
