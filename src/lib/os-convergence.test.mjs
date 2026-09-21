// Final visual convergence (M6 legacy cleanup on the operator/client build): ambient loops that signal
// nothing are gone, live state still animates, the client scope shows no pixel language, muted text
// passes AA, dialogs enter with the shared animation, and nothing semantic changed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../app/globals.css");

test("War Room ambient loops are retired; only live state keeps an infinite animation", () => {
  for (const legacy of ["wr-lamp-flicker", "wr-editor-pulse", "wr-ticket-pulse"]) {
    assert.doesNotMatch(css, new RegExp(`@keyframes ${legacy}|animation:\\s*${legacy}`), legacy);
  }
  const wr = css.slice(css.indexOf(".wr-floor"), css.indexOf("@keyframes wr-panel-enter"));
  assert.doesNotMatch(wr, /infinite/, "no ambient loop in the War Room block");
  assert.doesNotMatch(wr, /box-shadow: 0 0 (8|22|10)px/, "no glow");
  assert.doesNotMatch(wr, /translateY\(-2px\)/, "no hover lift");
  // live state is untouched: the shared live ring still loops, and is stilled under reduced motion
  assert.match(css, /\.mb-live-pulse::after \{[^}]*infinite|animation: mb-live-ring[^;]*infinite/s);
  assert.match(css, /\.mb-live-pulse::after \{ animation: none;/);
  assert.match(css, /\.wr-table-marker-blocked::after \{[^}]*opacity: \.55/s, "review/blocked rings are static markers");
});

test("War Room stage no longer references the retired editor pulse class", () => {
  assert.doesNotMatch(read("../app/war-room/restaurant/WarRoomRestaurantStage.tsx"), /wr-editor-pulse/);
  // the live editor state is still communicated by LiveIndicator (text + ring)
  assert.match(read("../app/war-room/restaurant/WarRoomRestaurantStage.tsx"), /<LiveIndicator label=/);
});

test("game-like card lift is removed from stat tiles", () => {
  const stats = read("../components/ui/PerformanceStats.tsx");
  assert.doesNotMatch(stats, /hover:scale/);
  assert.doesNotMatch(stats, /transition-all duration-200/);
});

test("client surfaces show no pixel language: brackets, inventory shadow, mono pixel badges are neutralised under the client scope", () => {
  assert.match(css, /\[data-intensity="client"\] \.pixel-frame::after \{ display: none; \}/);
  assert.match(css, /\[data-intensity="client"\] \.pixel-badge \{ border-radius: 9999px !important;/);
  assert.match(css, /\[data-intensity="client"\] \.pixel-frame \{ background-image: none; box-shadow: none; \}/);
  assert.match(read("../app/client/layout.tsx"), /data-intensity="client"/);
  // the operator keeps its heritage traces (rules outside the client scope are unchanged)
  assert.match(css, /\.pixel-frame::after \{\s*content: "";/);
});

test("muted text passes AA through one theme value (not a palette remap)", () => {
  assert.match(css, /@theme \{ --color-zinc-500: #8c8c96; \}/);
  // contrast of #8c8c96 on the panel surfaces (WCAG 2.x)
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const bg of ["#09090b", "#101013", "#16161a"]) assert.ok(ratio("#8c8c96", bg) >= 4.5, bg);
  assert.ok(ratio("#71717a", "#16161a") < 4.5, "the old value failed AA on surface 2");
});

test("modals enter with the shared animation (no new vocabulary) and keep their dialog semantics", () => {
  for (const [file, label] of [
    ["../app/productivity/VideoEditor.tsx", 'aria-modal="true"'],
    ["../components/quick-capture/QuickCaptureModal.tsx", 'aria-modal="true"'],
    ["../app/productivity/sessions/SessionInspectorPanel.tsx", 'role="dialog"'],
  ]) {
    const src = read(file);
    assert.match(src, /data-enter="true"/, file);
    assert.match(src, /className="os-arrive /, file);
    assert.match(src, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), file);
  }
  assert.match(css, /\.os-arrive\[data-enter\] \{ animation: os-label-in var\(--os-motion-panel\) var\(--os-ease\) both; \}/);
});

test("client token page uses the canonical Client Portal name; no internal 'Vault' wording is user-visible", () => {
  const page = read("../app/client/[token]/page.tsx");
  assert.match(page, /title: "RMEDIA Client Portal"/);
  assert.doesNotMatch(page.replace(/\/\/.*$/gm, ""), /The Vault|Vault unavailable/);
});

test("no new motion vocabulary: the convergence block adds no keyframes or easing", () => {
  const block = css.slice(css.indexOf("Final visual convergence"));
  assert.doesNotMatch(block, /@keyframes|cubic-bezier/);
});
