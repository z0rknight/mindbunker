// Equipment Recovery + Selective Promotion -- structural invariant tests.
//
// These are static/source-level checks rather than DB-integration tests
// (Equipment already has 61 pure-logic tests in core.test.mjs covering
// validation, status/condition semantics, and financial aggregation).
// What's missing from that coverage is an explicit, enforced guarantee
// that Equipment stays its own canonical domain: no Finance mutation on
// asset creation, and no reach into any other production domain's
// tables. A future edit that accidentally wires Equipment into Finance
// would break these tests immediately, at review time, rather than only
// being caught by manual audit.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const actionsSource = readFileSync(path.join(dir, "actions.ts"), "utf8");

// The only table import Equipment's server actions are allowed to draw
// from "@/db/schema" -- if this list ever grows to include a
// Finance/Video/Project/Local-Lab table, these tests catch it here
// rather than in production.
const ALLOWED_SCHEMA_IMPORTS = [
  "equipmentAssets",
  "equipmentSystems",
  "equipmentAcquisitions",
  "equipmentMaintenanceEvents",
];

// Table identifiers that belong to other canonical domains. If any of
// these ever appear as a Drizzle query target (`.from(X)`, `.insert(X)`,
// `.update(X)`, `.delete(X)`) inside Equipment's actions.ts, Equipment
// has stopped being its own domain.
const FOREIGN_DOMAIN_TABLES = [
  "transactions",
  "personalTransactions",
  "debts",
  "subscriptions",
  "platformFees",
  "commitments",
  "fxConversions",
  "fxManualRates",
  "operatingReserveSettings",
  "financeSettings",
  "projects",
  "quotes",
  "videoLogs",
  "revisions",
  "productionChecklistItems",
  "assetChecklistItems", // Local Lab -- distinct from Equipment's own equipmentAssets
  "actionItems",
  "objectives",
  "dailyStates",
  "claims",
  "systemInterventions",
];

test("Equipment actions.ts imports only Equipment's own tables from @/db/schema", () => {
  const importBlockMatch = actionsSource.match(/import\s*\{([^}]*)\}\s*from\s*"@\/db\/schema";/s);
  assert.ok(importBlockMatch, "expected a single `import { ... } from \"@/db/schema\"` block");
  const imported = importBlockMatch[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const name of imported) {
    assert.ok(
      ALLOWED_SCHEMA_IMPORTS.includes(name),
      `actions.ts imports "${name}" from @/db/schema, which is not one of Equipment's own tables -- ` +
        `Equipment must not reach into another domain's tables (no Finance mutation, no unrelated production-domain mutation).`,
    );
  }
});

test("Equipment actions.ts never references another domain's table as a query target", () => {
  for (const table of FOREIGN_DOMAIN_TABLES) {
    // Matches Drizzle's own query-builder call shape: .from(X, .insert(X, .update(X, .delete(X
    const pattern = new RegExp(`\\.(from|insert|update|delete)\\(\\s*${table}\\b`);
    assert.equal(
      pattern.test(actionsSource),
      false,
      `actions.ts appears to query "${table}" -- Equipment is not a Finance transaction, not a video, ` +
        `not a Project asset checklist, and not Local Lab experimentation; it must stay its own canonical domain.`,
    );
  }
});

test("Equipment actions.ts does not import any Finance, Video, or Local Lab module", () => {
  const foreignModulePatterns = [
    /from\s*"@\/modules\/finance/,
    /from\s*"@\/modules\/personal-finance/,
    /from\s*"@\/modules\/fx/,
    /from\s*"@\/modules\/video-operations/,
    /from\s*"@\/modules\/reconciliation/,
  ];
  for (const pattern of foreignModulePatterns) {
    assert.equal(
      pattern.test(actionsSource),
      false,
      `actions.ts imports from a foreign domain module matching ${pattern} -- Equipment must not create ` +
        `automatic accounting mutations or couple to Finance/Video/Local Lab at all (still explicitly deferred).`,
    );
  }
});
