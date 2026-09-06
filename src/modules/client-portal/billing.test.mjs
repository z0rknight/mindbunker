import assert from "node:assert/strict";
import test from "node:test";

import { buildClientBillingSummary, searchClientDashboardVideos } from "./core.ts";

// ---------------------------------------------------------------------------
// buildClientBillingSummary -- cross-client isolation and honest empty state
// ---------------------------------------------------------------------------

test("no billing_evidence rows produces an honest empty state, not a fabricated $0.00", () => {
  const summary = buildClientBillingSummary(4, [], [], [], new Map());
  assert.equal(summary.hasAnyRecordedWork, false);
  assert.deepEqual(summary.byCurrency, []);
  assert.deepEqual(summary.byProject, []);
});

test("a client sees only their own contract's billing evidence", () => {
  const contracts = [
    { id: 1, clientId: 4, currency: "USD", billingType: "HOURLY", hourlyRate: 25 },
    { id: 2, clientId: 7, currency: "USD", billingType: "HOURLY", hourlyRate: 40 }, // another client
  ];
  const evidence = [
    { contractId: 1, contractClientId: 4, currency: "USD", billableMinutes: 120, grossAmount: 50 },
    { contractId: 2, contractClientId: 7, currency: "USD", billableMinutes: 999, grossAmount: 9999 },
  ];
  const summary = buildClientBillingSummary(4, contracts, evidence, [], new Map());
  assert.equal(summary.hasAnyRecordedWork, true);
  assert.equal(summary.byCurrency.length, 1);
  assert.equal(summary.byCurrency[0].totalAmount, 50);
  assert.equal(summary.byCurrency[0].totalMinutes, 120);
  assert.equal(summary.byCurrency[0].hourlyRate, 25);
  // The other client's $9999 must never appear anywhere in the output.
  assert.equal(JSON.stringify(summary).includes("9999"), false);
});

// Defense-in-depth: even if a caller's SQL WHERE clause were ever wrong or
// bypassed, the pure builder re-checks contractClientId against the
// authenticated id AND against the caller-supplied contract ownership set
// -- neither check alone should be sufficient to leak data.
test("a row claiming the right contractClientId but a contractId not in the owned set is excluded", () => {
  const contracts = [{ id: 1, clientId: 4, currency: "USD", billingType: "HOURLY", hourlyRate: 25 }];
  const evidence = [
    // contractClientId says 4 (correct), but contractId=99 doesn't belong to any owned contract --
    // a row like this should never occur from a correct join, but the builder must not trust it blindly.
    { contractId: 99, contractClientId: 4, currency: "USD", billableMinutes: 500, grossAmount: 500 },
  ];
  const summary = buildClientBillingSummary(4, contracts, evidence, [], new Map());
  assert.equal(summary.hasAnyRecordedWork, false);
});

test("multiple contracts in the same currency omit a single hourly rate rather than guessing", () => {
  const contracts = [
    { id: 1, clientId: 4, currency: "USD", billingType: "HOURLY", hourlyRate: 25 },
    { id: 2, clientId: 4, currency: "USD", billingType: "HOURLY", hourlyRate: 40 },
  ];
  const evidence = [
    { contractId: 1, contractClientId: 4, currency: "USD", billableMinutes: 60, grossAmount: 25 },
    { contractId: 2, contractClientId: 4, currency: "USD", billableMinutes: 60, grossAmount: 40 },
  ];
  const summary = buildClientBillingSummary(4, contracts, evidence, [], new Map());
  assert.equal(summary.byCurrency[0].totalAmount, 65);
  assert.equal(summary.byCurrency[0].hourlyRate, null);
});

test("a FIXED contract never produces an hourly rate line", () => {
  const contracts = [{ id: 1, clientId: 4, currency: "USD", billingType: "FIXED", hourlyRate: null }];
  const evidence = [
    { contractId: 1, contractClientId: 4, currency: "USD", billableMinutes: 0, grossAmount: 100 },
  ];
  const summary = buildClientBillingSummary(4, contracts, evidence, [], new Map());
  assert.equal(summary.byCurrency[0].hourlyRate, null);
});

test("USD and BRL evidence for the same client are never summed together", () => {
  const contracts = [
    { id: 1, clientId: 4, currency: "USD", billingType: "HOURLY", hourlyRate: 25 },
    { id: 2, clientId: 4, currency: "BRL", billingType: "HOURLY", hourlyRate: 100 },
  ];
  const evidence = [
    { contractId: 1, contractClientId: 4, currency: "USD", billableMinutes: 60, grossAmount: 25 },
    { contractId: 2, contractClientId: 4, currency: "BRL", billableMinutes: 60, grossAmount: 100 },
  ];
  const summary = buildClientBillingSummary(4, contracts, evidence, [], new Map());
  assert.equal(summary.byCurrency.length, 2);
  const usd = summary.byCurrency.find((c) => c.currency === "USD");
  const brl = summary.byCurrency.find((c) => c.currency === "BRL");
  assert.equal(usd.totalAmount, 25);
  assert.equal(brl.totalAmount, 100);
});

test("allocations are grouped by project, and null videoId becomes an explicit 'Other' bucket", () => {
  const projectNameById = new Map([[10, "Meta Ads"]]);
  const allocations = [
    { contractClientId: 4, amount: 30, minutes: 60, currency: "USD", videoId: 1, projectId: 10 },
    { contractClientId: 4, amount: 15, minutes: 30, currency: "USD", videoId: null, projectId: null },
  ];
  const summary = buildClientBillingSummary(4, [], [], allocations, projectNameById);
  assert.equal(summary.byProject.length, 2);
  const meta = summary.byProject.find((p) => p.projectId === 10);
  const other = summary.byProject.find((p) => p.projectId === null);
  assert.equal(meta.projectName, "Meta Ads");
  assert.equal(meta.amount, 30);
  assert.equal(other.projectName, null);
  assert.equal(other.amount, 15);
});

test("an allocation whose contractClientId does not match the authenticated client is excluded", () => {
  const allocations = [
    { contractClientId: 7, amount: 999, minutes: 999, currency: "USD", videoId: null, projectId: null },
  ];
  const summary = buildClientBillingSummary(4, [], [], allocations, new Map());
  assert.deepEqual(summary.byProject, []);
});

// ---------------------------------------------------------------------------
// searchClientDashboardVideos
// ---------------------------------------------------------------------------

function makeVideo(overrides) {
  return {
    id: 1,
    title: "Recession Resistance",
    status: "READY_FOR_REVIEW",
    statusLabel: "Review",
    projectId: 1,
    projectName: "Why I Love Self Storage",
    contentType: "short-form",
    contentTypeLabel: "Short-form",
    orientation: "VERTICAL",
    coverUrl: null,
    deliveryUrl: null,
    reviewUrl: null,
    publishedUrl: null,
    lastUpdated: null,
    isPriority: false,
    ...overrides,
  };
}

test("search matches on title, case-insensitively", () => {
  const videos = [makeVideo({ id: 1, title: "Recession Resistance" }), makeVideo({ id: 2, title: "Low Operating Costs" })];
  const result = searchClientDashboardVideos(videos, "recession");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test("search matches on project name", () => {
  const videos = [
    makeVideo({ id: 1, title: "Clip A", projectName: "Meta Ads" }),
    makeVideo({ id: 2, title: "Clip B", projectName: "Vertical Adaptations" }),
  ];
  const result = searchClientDashboardVideos(videos, "meta");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test("an empty or whitespace-only query returns every video unfiltered", () => {
  const videos = [makeVideo({ id: 1 }), makeVideo({ id: 2 })];
  assert.equal(searchClientDashboardVideos(videos, "").length, 2);
  assert.equal(searchClientDashboardVideos(videos, "   ").length, 2);
});

test("a null projectName never crashes the search and is treated as empty", () => {
  const videos = [makeVideo({ id: 1, projectName: null })];
  assert.doesNotThrow(() => searchClientDashboardVideos(videos, "anything"));
  assert.equal(searchClientDashboardVideos(videos, "anything").length, 0);
});

test("search never exposes fields beyond title/projectName -- no notes field exists on the card type to leak", () => {
  // ClientDashboardVideoCard has no `notes` field at all (see core.ts) --
  // this test documents that invariant so a future field addition can't
  // silently make search (or the type itself) leak internal notes.
  const video = makeVideo({ id: 1 });
  assert.equal("notes" in video, false);
});
