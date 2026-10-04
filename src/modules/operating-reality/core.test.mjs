import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildDeliveryReality,
  buildMoneyReality,
  computeRecordedWorkReality,
} from "./core.ts";

function project(overrides = {}) {
  return {
    id: 1,
    clientId: 2,
    clientName: "Taryn DFY",
    canonicalClientId: 2,
    canonicalClientName: "Taryn Dubreuil",
    workMode: "DFY",
    workClass: "CLIENT",
    name: "Mini Series",
    status: "active",
    deadline: null,
    notes: null,
    createdAt: null,
    updatedAt: null,
    totalVideos: 4,
    doneVideos: 1,
    inFlightVideos: 1,
    plannedVideos: 2,
    coverUrl: null,
    clientDefaultCoverUrl: null,
    clientAvatarUrl: null,
    lastActiveAt: null,
    openBlockerCount: 0,
    explicitBatchCount: 1,
    deliverableTitles: [],
    ...overrides,
  };
}

test("money reality never merges received, receivable and expected evidence", () => {
  const rows = buildMoneyReality([
    {
      currency: "USD",
      cashReceived: 400,
      reconciledRevenue: 390,
      unattributedPaid: 10,
      billedRequested: 470,
      registeredBilling: 510,
      operatingCost: 20,
      personalExcluded: 0,
      unknownCost: 0,
      managementOperatingResult: 370,
    },
  ], [{ currency: "USD", amount: 468.33 }]);
  assert.deepEqual(rows, [{
    currency: "USD",
    received: 400,
    receivable: 468.33,
    expectedRegistered: 510,
  }]);
});

test("delivery reality reuses Wave 4 membership, progress and canonical Client rollup", () => {
  const result = buildDeliveryReality([
    project(),
    project({ id: 2, clientId: 12, canonicalClientId: 2, name: "Bonnie", totalVideos: 3, doneVideos: 2 }),
    project({ id: 3, clientId: 99, canonicalClientId: 99, canonicalClientName: "RMEDIA", clientName: "RMEDIA", workClass: "INTERNAL", totalVideos: 2, doneVideos: 0 }),
    project({ id: 4, status: "delivered", totalVideos: 1, doneVideos: 1 }),
  ], 2);
  assert.equal(result.currentProjectCount, 3);
  assert.equal(result.openDeliverables, 6);
  assert.equal(result.structuralIssueCount, 2);
  assert.equal(result.internalProjectCount, 1);
  assert.deepEqual(result.clientLoad, [{
    clientId: 2,
    clientName: "Taryn Dubreuil",
    projectCount: 2,
    openDeliverables: 4,
  }]);
  assert.equal(result.currentProjects[0].progress, 25);
});

test("recorded work classifies Sessions without treating Sensor evidence as work time", () => {
  const result = computeRecordedWorkReality([
    { startedAt: 0, endedAt: 3600, activityType: "EDITING", clientName: "Taryn Dubreuil", clientStatus: "active", clientSource: null },
    { startedAt: 4000, endedAt: 5800, activityType: "OTHER", clientName: "RMEDIA", clientStatus: "active", clientSource: null },
    { startedAt: 6000, endedAt: 6900, activityType: "ADMIN", clientName: "RMEDIA", clientStatus: "active", clientSource: null },
    { startedAt: 7000, endedAt: 7600, activityType: "CLIENT_SERVICE", clientName: "New Lead", clientStatus: "lead", clientSource: null },
    { startedAt: 8000, endedAt: 8300, activityType: "OTHER", clientName: null, clientStatus: null, clientSource: null },
    { startedAt: 9000, endedAt: 9000 + 50_000, activityType: "EDITING", clientName: "Taryn Dubreuil", clientStatus: "active", clientSource: null },
  ]);
  assert.equal(result.recordedSeconds, 7200);
  assert.equal(result.clientSeconds, 3600);
  assert.equal(result.internalSeconds, 1800);
  assert.equal(result.adminSeconds, 900);
  assert.equal(result.leadSeconds, 600);
  assert.equal(result.unclassifiedSeconds, 300);
  assert.equal(result.sessionCount, 5);
  assert.equal(result.excludedSeconds, 50_000);
});

test("Dashboard is observational, exposes ACTIVE/IDLE/empty states and uses the global drawer", () => {
  const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../../components/operating-reality/DashboardOperatingReality.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("./data.ts", import.meta.url), "utf8");

  assert.match(page, /getOperatingReality/u);
  assert.doesNotMatch(page, /StartWorkButton|FinishedVideoButton|QuickActions|AddIncomeButton/u);
  assert.match(component, /operating-now-\$\{operation\.state\.toLowerCase\(\)\}/u);
  assert.match(component, /No active session and no executable recommendation/u);
  assert.match(component, /EntityInspectionTrigger/u);
  assert.match(component, /Open War Room/u);
  assert.match(data, /getExecutionSnapshot\("\/"\)/u);
  assert.match(data, /getProjectsOverview\(\)/u);
  assert.match(data, /getApplicationUsage\("LAST_7_DAYS"\)/u);
  assert.doesNotMatch(data, /INSERT|UPDATE|DELETE/u);
});
