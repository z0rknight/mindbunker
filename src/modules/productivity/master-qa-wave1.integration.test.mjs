import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("contract and cash reconciliation use distinct domain names", () => {
  const finance = source("../finance/actions.ts");
  const cash = source("../reconciliation/actions.ts");
  const contractPage = source("../../app/finance/contracts/[id]/page.tsx");
  assert.match(finance, /export async function getContractReconciliation\(/u);
  assert.doesNotMatch(finance, /export async function getReconciliation\(/u);
  assert.match(cash, /export async function getReconciliation\(scope: CashScope\)/u);
  assert.match(contractPage, /getContractReconciliation/u);
});

test("both canonical video creation paths derive the default kind from the owning client", () => {
  const actions = source("./actions.ts");
  assert.match(actions, /videoKind: resolveVideoKindForClient\(/u);
  assert.equal(actions.match(/videoKind: resolveVideoKindForClient\(/gu)?.length, 2);
  assert.match(actions, /assignment\.clientName/u);
});

// P0.3.1 (Tuesday Reality & Usability Patch): the direct +/- revision
// counter (RevisionControls, changeRevisionCount) was removed from
// Productivity -- it mutated video_logs.revisionsCount with no revisions
// event row, a non-canonical write path sitting right next to the correct
// one (Register Correction -> recordDetailedRevision, which inserts a
// revisions row AND increments the compat cache atomically). Both the
// card and the workspace now only ever DISPLAY revisionsCount; the one
// place Productivity can change it is Register Correction inside
// OperationalMemoryPanel.
test("revision count is read-only everywhere in Productivity except Register Correction", () => {
  const card = source("../../app/productivity/VideoOperationsCard.tsx");
  const editor = source("../../app/productivity/VideoEditor.tsx");
  const operationalMemory = source("../../app/productivity/OperationalMemoryPanel.tsx");
  const page = source("../../app/productivity/page.tsx");
  assert.doesNotMatch(card, /<RevisionControls/u);
  assert.doesNotMatch(editor, /<RevisionControls/u);
  assert.doesNotMatch(page, /AddRevisionButton/u);
  assert.match(card, /revisionCount|revisionsCount/u);
  assert.match(editor, /revisionsCount/u);
  assert.match(operationalMemory, /recordDetailedRevision/u);
  assert.match(operationalMemory, /Register Correction/u);
});

// Operator Flow round: restore visual recognition without regressing the
// truthful client/exception hierarchy. Cards remain grouped and attention-
// sorted; their covers use project -> client default -> avatar fallback.
test("Projects uses visual cards grouped by operational stage with client and exception context", () => {
  const projects = source("../../app/projects/page.tsx");
  assert.match(projects, /groupProjectsForOverview/u);
  assert.match(projects, /PROJECT_GROUPS/u);
  assert.match(projects, /getProjectException/u);
  assert.match(projects, /getProjectNextAction/u);
  assert.match(projects, /project\.doneVideos/u);
  assert.match(projects, /ProjectCover/u);
  assert.match(projects, /project\.coverUrl,[\s\S]*project\.clientDefaultCoverUrl,[\s\S]*project\.clientAvatarUrl/u);
  assert.doesNotMatch(projects, /2xl:grid-cols-4/u);
  assert.doesNotMatch(projects, /PROJECT #/u);
  assert.doesNotMatch(projects, /min-h-12 w-full items-center justify-center rounded-xl bg-cyan-700/u);
});

test("Dashboard and Productivity put operator capture before secondary evidence", () => {
  const dashboard = source("../../app/page.tsx");
  const productivity = source("../../app/productivity/page.tsx");
  assert.ok(dashboard.indexOf("dashboard-quick-actions") < dashboard.indexOf("dashboard-attention"));
  assert.ok(productivity.indexOf("Quick actions") < productivity.indexOf("<NeedsAttentionSection"));
  assert.match(dashboard, /Historical context/u);
  assert.match(dashboard, /baseline evidence, not live state/u);
  assert.doesNotMatch(dashboard, /<details open/u);
});

test("CRM puts the operational dossier before audit evidence and keeps custody reachable", () => {
  const client = source("../../app/crm/[id]/page.tsx");
  const dossierPosition = client.indexOf("<ClientOperationalDossier");
  const evidencePosition = client.indexOf("Evidence &amp; Provenance");
  assert.ok(dossierPosition >= 0);
  assert.ok(evidencePosition > dossierPosition);
  assert.match(client, /<details/u);
  assert.match(client, /<ChainOfCustodyPanel custody=\{custody\}/u);
});

test("Dashboard states the three-part intentional-work invariant and labels internal momentum", () => {
  const dashboard = source("../../app/page.tsx");
  assert.match(dashboard, /label="Client Production"/u);
  assert.match(dashboard, /label="Internal Operations"/u);
  assert.match(dashboard, /label="Total Intentional"/u);
  assert.match(dashboard, /Internal operations/u);
  assert.match(dashboard, /Client production/u);
});
