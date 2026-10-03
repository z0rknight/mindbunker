import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/crm/page.tsx", import.meta.url), "utf8");
const clientActions = readFileSync(new URL("../../app/crm/ClientActions.tsx", import.meta.url), "utf8");

test("CRM list projections roll operational aliases into the canonical relationship", () => {
  assert.match(actions, /const ownerId = canonicalClientId\(row\.clientId\)/u);
  assert.match(actions, /projectCounts\.set\(ownerId/u);
  assert.match(actions, /revenueByCurrency\.set\(ownerId/u);
  assert.match(actions, /currentProjectByClient\.set\(ownerId/u);
  assert.match(page, /operationalAliases: aliasNamesByCanonical\.get\(client\.id\)/u);
  assert.match(page, /includes \{alias\}/u);
});

test("permanent delete is absent from the normal CRM row action surface", () => {
  assert.doesNotMatch(clientActions, /deleteClient/u);
  assert.doesNotMatch(clientActions, /Permanently delete/u);
});

test("identity and relationship-status changes append audit events", () => {
  assert.match(actions, /client_identity_renamed/u);
  assert.match(actions, /relationship_status_changed/u);
});
