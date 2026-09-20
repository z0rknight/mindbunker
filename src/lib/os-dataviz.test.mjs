// Train M4: evidence visualisation. Presentation only: no new data, no new
// business rule. These tests pin that a picture never creates precision --
// unknown stays visible (never zero, never a "full" bar), derived stays
// distinct from source facts, review stays distinct from done, and parts
// reconcile to the whole they belong to.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

import { attributionParts, barPercent, buildRail, coverageParts } from "./os/evidence-rail.ts";
import { summarizeEvidenceAttribution } from "../modules/finance/attribution.ts";
import { computeSessionCoverage, sessionCoveragePercent } from "../modules/sensor/app-intelligence.ts";
import { summarizeBatchProgress } from "../modules/client-portal/batch-progress.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const load = (p) => tsImport(p, import.meta.url);
const sum = (rail) => rail.segments.reduce((a, s) => a + s.pct, 0);
const seg = (key, value, source, extra = {}) => ({ key, label: key, value, source, display: `${value}`, ...extra });

// ── bar math ─────────────────────────────────────────────────────────────
test("barPercent: proportional, clamped, and zero when there is nothing to scale against", () => {
  assert.equal(barPercent(50, 100), 50);
  assert.equal(barPercent(100, 100), 100);
  assert.equal(barPercent(150, 100), 100);
  assert.equal(barPercent(0, 100), 0);
  assert.equal(barPercent(-5, 100), 0);
  assert.equal(barPercent(10, 0), 0);
  assert.equal(barPercent(Number.NaN, 100), 0);
});

// ── rails: unknown is never normalised away ──────────────────────────────
test("rail: parts that do not fill the total are NOT stretched to 100%", () => {
  const rail = buildRail([seg("a", 30, "fact"), seg("b", 20, "fact")], 100, "registered", "100");
  assert.ok(Math.abs(sum(rail) - 50) < 1e-9, "only 50 of 100 is accounted for: the rest of the rail stays empty");
  assert.equal(rail.overAllocated, false);
});

test("rail: an explicit unknown segment keeps its share and is never dropped or zeroed", () => {
  const rail = buildRail([seg("known", 40, "fact"), seg("unknown", 60, "unknown")], 100, "of sessions", "100");
  const unknown = rail.segments.find((s) => s.key === "unknown");
  assert.equal(unknown.pct, 60);
  assert.equal(unknown.source, "unknown");
  assert.ok(Math.abs(sum(rail) - 100) < 1e-9);
  assert.match(rail.summary, /60 unknown/);
});

test("rail: over-allocation is flagged and scaled to what was recorded, not clipped", () => {
  const rail = buildRail([seg("a", 80, "fact"), seg("b", 40, "derived")], 100, "registered", "100");
  assert.equal(rail.overAllocated, true);
  assert.ok(Math.abs(sum(rail) - 100) < 1e-9);
  assert.ok(rail.segments[0].pct > 66 && rail.segments[0].pct < 67);
});

test("rail: bad inputs become zero-width segments instead of NaN widths; the text summary lists only real parts", () => {
  const rail = buildRail([seg("a", Number.NaN, "fact"), seg("b", -3, "fact"), seg("c", 10, "fact")], 10, "total", "10");
  assert.deepEqual(rail.segments.map((s) => s.pct), [0, 0, 100]);
  assert.equal(rail.summary, "10 total: 10 c");
  assert.equal(buildRail([], 0, "total", "0").summary, "0 total");
});

// ── coverage reconciliation (real read-model function) ───────────────────
test("coverage: active + idle + no-telemetry always equal the intentional session time", () => {
  const sessions = [{ contextType: "CLIENT", startedAt: 0, endedAt: 18_000 }];      // 5h
  const observations = [
    { appKey: "PREMIERE_PRO", surface: "APP", startedAt: 0, endedAt: 9_000, idle: false },
    { appKey: "PREMIERE_PRO", surface: "APP", startedAt: 9_000, endedAt: 12_000, idle: true },
    // 12_000..18_000 has no telemetry at all (Sensor offline)
  ];
  const coverage = computeSessionCoverage(observations, sessions, 0, 86_400);
  const p = coverageParts(coverage);
  assert.equal(p.active + p.idle + p.unknown, coverage.sessionSeconds);
  assert.deepEqual([p.active, p.idle, p.unknown], [9_000, 3_000, 6_000]);
  assert.equal(sessionCoveragePercent(coverage), 67);
  const rail = buildRail(
    [seg("active", p.active, "fact"), seg("idle", p.idle, "fact"), seg("unknown", p.unknown, "unknown")],
    coverage.sessionSeconds, "of intentional sessions", "5h",
  );
  assert.ok(Math.abs(sum(rail) - 100) < 1e-9);
  assert.equal(rail.segments[2].source, "unknown", "no telemetry is unknown, not idle and not zero");
});

test("coverage: with no telemetry the whole session is unknown and the rail says so (never 0% shown as full)", () => {
  const coverage = computeSessionCoverage([], [{ contextType: "CLIENT", startedAt: 0, endedAt: 3_600 }], 0, 86_400);
  const p = coverageParts(coverage);
  assert.deepEqual([p.active, p.idle, p.unknown], [0, 0, 3_600]);
  const rail = buildRail([seg("active", 0, "fact"), seg("idle", 0, "fact"), seg("unknown", p.unknown, "unknown")], coverage.sessionSeconds, "s", "1h");
  assert.equal(rail.segments[2].pct, 100);
  assert.equal(rail.segments[0].pct, 0);
});

// ── external registered time attribution ─────────────────────────────────
test("attribution: attributed + derived + unallocated reconcile to registered; amount-only rows never reduce unallocated", () => {
  const summary = summarizeEvidenceAttribution(360, [
    { id: 1, method: "MANUAL_MINUTES", minutes: 240 },
    { id: 2, method: "DERIVED_PROPORTION", minutes: 30 },
    { id: 3, method: "MANUAL_AMOUNT", minutes: null },
  ]);
  const p = attributionParts(summary);
  assert.deepEqual(p, { explicit: 240, derived: 30, unallocated: 90 });
  assert.equal(p.explicit + p.derived + p.unallocated, summary.registeredMinutes);
  assert.equal(summary.amountOnlyRows, 1);
  const rail = buildRail(
    [seg("explicit", p.explicit, "fact"), seg("derived", p.derived, "derived"), seg("unallocated", p.unallocated, "unknown")],
    summary.registeredMinutes, "registered", "6h00",
  );
  assert.equal(rail.overAllocated, false);
  assert.ok(Math.abs(sum(rail) - 100) < 1e-9);
  assert.deepEqual(rail.segments.map((s) => s.source), ["fact", "derived", "unknown"]);
});

test("attribution: nothing attributed is a fully unallocated (unknown) rail, not an empty or 'complete' one", () => {
  const summary = summarizeEvidenceAttribution(4_170, []);
  const p = attributionParts(summary);
  const rail = buildRail([seg("e", p.explicit, "fact"), seg("d", p.derived, "derived"), seg("u", p.unallocated, "unknown")], 4_170, "registered", "69h30");
  assert.equal(rail.segments[2].pct, 100);
  assert.equal(rail.segments[0].pct + rail.segments[1].pct, 0);
});

// ── presentation (server-rendered) ───────────────────────────────────────
test("DataBar: exact value + label are text, the bar is decorative, width is inline (no mount animation)", async () => {
  const { DataBar } = await load("../components/os/DataBar.tsx");
  const html = renderToStaticMarkup(createElement(DataBar, { label: "Premiere Pro", detail: "web", value: 134, max: 268, display: "2h 14m" }));
  assert.match(html, /class="os-databar" data-source="fact"/);
  assert.match(html, /Premiere Pro<span class="os-databar-detail"> · web<\/span>/);
  assert.match(html, /<span class="os-databar-track" aria-hidden="true"><i style="--w:50\.00"><\/i><\/span>/);
  assert.match(html, /<span class="os-databar-value">2h 14m<\/span>/);
  const unknown = renderToStaticMarkup(createElement(DataBar, { label: "No telemetry", value: 27, max: 100, display: "27m", source: "unknown" }));
  assert.match(unknown, /data-source="unknown"/);
  assert.match(renderToStaticMarkup(createElement(DataBar, { label: "x", value: 1, max: 1, display: "1m", emphasis: true })), /data-emphasis="true"/);
});

test("EvidenceRail: img with a text summary; legend names source/derived/unknown in words; empty parts hidden; over-allocation warned", async () => {
  const { EvidenceRail } = await load("../components/os/EvidenceRail.tsx");
  const rail = buildRail(
    [seg("e", 240, "fact", { label: "Attributed by you", display: "4h00" }), seg("d", 30, "derived", { label: "Historical", display: "0h30" }),
     seg("u", 90, "unknown", { label: "Unallocated", display: "1h30" }), seg("z", 0, "fact", { label: "Nothing", display: "0h00" })],
    360, "registered", "6h00",
  );
  const html = renderToStaticMarkup(createElement(EvidenceRail, { rail }));
  assert.match(html, /role="img" aria-label="6h00 registered: 4h00 attributed by you, 0h30 historical, 1h30 unallocated"/);
  assert.match(html, /<ul class="os-rail-legend" aria-hidden="true">/);
  assert.match(html, /Historical <b>0h30<\/b><span> · derived<\/span>/);
  assert.match(html, /Unallocated <b>1h30<\/b><span> · unknown<\/span>/);
  assert.match(html, /data-empty="true"/);
  assert.doesNotMatch(html, /os-rail-warn/);
  const over = renderToStaticMarkup(createElement(EvidenceRail, { rail: buildRail([seg("a", 9, "fact")], 5, "t", "5") }));
  assert.match(over, /os-rail-warn/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(EvidenceRail, { rail, legend: false })), /os-rail-legend/);
});

// ── Production Order composition ─────────────────────────────────────────
test("Production Order composition: review is not done, operator wording, cancelled named but not counted, container excluded upstream", async () => {
  const items = [
    { id: 1, status: "DONE" }, { id: 2, status: "DONE" }, { id: 3, status: "READY_FOR_REVIEW" },
    { id: 4, status: "IN_PROGRESS" }, { id: 5, status: "PLANNED" },
  ];
  const s = summarizeBatchProgress(items, { wording: "operator", cancelled: 1 });
  assert.equal(s.summary, "2 of 5 done · 1 in review · 1 in progress · 1 planned · 1 cancelled (not in the rail)");
  assert.equal(s.total, 5);
  assert.deepEqual(s.segments.map((x) => x.status), ["done", "done", "review", "progress", "planned"]);
  assert.equal(summarizeBatchProgress(items).summary, "2 of 5 completed · 1 in review · 1 in production · 1 planned", "client wording unchanged");
  const { BatchProgress } = await load("../components/os/BatchProgress.tsx");
  assert.match(renderToStaticMarkup(createElement(BatchProgress, { items, wording: "operator", cancelled: 1 })), /2 of 5 done/);
  const data = read("../modules/production-orders/data.ts");
  assert.match(data, /\.filter\(\(r\) => !r\.isOperationalContainer\)/, "the container never becomes a deliverable");
  assert.match(read("../app/productivity/orders/[id]/page.tsx"), /wording="operator"/);
});

// ── surfaces, motion, dependencies ───────────────────────────────────────
test("Sensor page: bars keep stable keys, coverage rail only for the intentional view, unknown text kept", () => {
  const src = read("../app/productivity/sensor/page.tsx");
  assert.match(src, /<DataBar[\s\S]*key=\{`\$\{row\.appKey\}-\$\{row\.surface \?\? ""\}`\}/);
  assert.match(src, /appMetric === "INTENTIONAL" && \([\s\S]*<EvidenceRail rail=\{coverageRail\} \/>/);
  assert.match(src, /with no telemetry \(unknown, not zero\)/);
  assert.match(src, /incomplete coverage is never presented as full history/);
  assert.match(src, /key: "unknown", label: "No telemetry", value: parts\.unknown, source: "unknown"/);
  assert.match(src, /key: "idle"[^}]*tone: "muted"/, "idle stays a known fact, drawn quieter than active (survives greyscale by lightness + label)");
});

test("Finance attribution panel and batch evidence: rails add to (not replace) the exact text; ValueChange on counts", () => {
  const panel = read("../app/finance/contracts/[id]/AttributionPanel.tsx");
  assert.match(panel, /<EvidenceRail rail=\{rail\} \/>/);
  assert.match(panel, /Attributed by you/);
  assert.match(panel, /<ValueChange value=\{value\} \/>/);
  const block = read("../components/production-orders/BatchEvidenceBlock.tsx");
  assert.match(block, /source: "derived"/);
  assert.match(block, /source: "unknown"/);
  assert.match(block, /Registered time assigned to this batch: not billed revenue, not paid\./);
  assert.match(block, /No profit figure is shown/);
  assert.doesNotMatch(panel + block, /(const|let|function)\s+\w*(profit|margin|roi|hourlyRate|effectiveRate)/i, "no pricing/profitability value is computed");
});

test("motion: no mount animation, no stagger, tokens only; reduced motion collapses via the shared scale", () => {
  const css = read("../app/globals.css");
  const m4 = css.slice(css.indexOf("M4: evidence visualisation"));
  assert.doesNotMatch(m4, /@keyframes|animation:|animation-delay/);
  assert.match(m4, /\.os-databar-track > i \{[^}]*transition: width var\(--os-motion-panel\) var\(--os-ease\)/);
  assert.match(m4, /\.os-rail-seg \{[^}]*transition: width var\(--os-motion-panel\) var\(--os-ease\)/);
  assert.match(css, /--os-motion-scale: \.0001/);
  assert.match(m4, /repeating-linear-gradient\(135deg/, "derived is hatched (survives greyscale)");
  assert.match(m4, /border: 1px dashed/, "unknown is dashed-empty");
});

test("no chart dependency, no new page, no pricing/profit logic", () => {
  const pkg = JSON.parse(read("../../package.json"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.equal(deps.some((d) => /recharts|chart\.js|^d3|victory|nivo|visx|apexcharts/i.test(d)), false);
  for (const f of ["../components/os/DataBar.tsx", "../components/os/EvidenceRail.tsx", "./os/evidence-rail.ts"]) {
    const src = read(f);
    assert.doesNotMatch(src, /@\/modules|@\/db|useState|useEffect|fetch\(|profit|margin|hourly/i, f);
  }
});
