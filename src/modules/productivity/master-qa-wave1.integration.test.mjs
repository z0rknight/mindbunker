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

test("normal production cards show revision information but only the workspace edits revisions", () => {
  const card = source("../../app/productivity/VideoOperationsCard.tsx");
  const editor = source("../../app/productivity/VideoEditor.tsx");
  assert.doesNotMatch(card, /<RevisionControls/u);
  assert.match(card, /revisionCount|revisionsCount/u);
  assert.match(editor, /<RevisionControls/u);
  assert.match(editor, /Manage revisions/u);
});

test("Projects keeps lifecycle counts but renders one compact accessible summary and a 2xl tier", () => {
  const projects = source("../../app/projects/page.tsx");
  assert.match(projects, /project\.doneVideos/u);
  assert.match(projects, /project\.inFlightVideos/u);
  assert.match(projects, /project\.plannedVideos/u);
  assert.match(projects, /aria-label=\{`\$\{project\.doneVideos\} done/u);
  assert.match(projects, /2xl:grid-cols-4/u);
  assert.doesNotMatch(projects, /min-h-12 w-full items-center justify-center rounded-xl bg-cyan-700/u);
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
