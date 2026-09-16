import assert from "node:assert/strict";
import test from "node:test";

import {
  displayClientName,
  getClientAccent,
  isInternalClientName,
  resolveVideoKindForClient,
  splitIntentionalWork,
} from "./client-identity.ts";

test("isInternalClientName matches RMEDIA's canonical record, case/whitespace-insensitive", () => {
  assert.equal(isInternalClientName("RMEDIA"), true);
  assert.equal(isInternalClientName("rmedia"), true);
  assert.equal(isInternalClientName("  RMedia  "), true);
  assert.equal(isInternalClientName("RMEDIA (INTERNAL)"), true);
  assert.equal(isInternalClientName(" rmedia (internal) "), true);
});

test("internal RMEDIA video creation defaults to INTERNAL while external work remains CLIENT_WORK", () => {
  assert.equal(resolveVideoKindForClient("RMEDIA"), "INTERNAL");
  assert.equal(resolveVideoKindForClient("RMEDIA (INTERNAL)"), "INTERNAL");
  assert.equal(resolveVideoKindForClient("Taryn Dubreuil"), "CLIENT_WORK");
  assert.equal(resolveVideoKindForClient(null), "CLIENT_WORK");
});

test("an explicit valid video classification always wins over the owning-client default", () => {
  assert.equal(resolveVideoKindForClient("RMEDIA", "SAMPLE"), "SAMPLE");
  assert.equal(resolveVideoKindForClient("Taryn Dubreuil", "INTERNAL"), "INTERNAL");
});

test("intentional work splits client and internal seconds without double counting", () => {
  const result = splitIntentionalWork({
    totalSeconds: 7200,
    byClient: [
      { clientName: "Taryn Dubreuil", seconds: 3600 },
      { clientName: "RMEDIA", seconds: 1800 },
    ],
  });
  assert.deepEqual(result, {
    clientProductionSeconds: 3600,
    internalOperationsSeconds: 3600,
    leadOperationsSeconds: 0,
    totalIntentionalSeconds: 7200,
  });
  assert.equal(
    result.clientProductionSeconds + result.internalOperationsSeconds,
    result.totalIntentionalSeconds,
  );
});

test("Sensor Operational Ledger Patch: durable non-CLIENT Sensor operational time adds on top, LEAD tracked separately", () => {
  const result = splitIntentionalWork(
    {
      totalSeconds: 3600,
      byClient: [{ clientName: "Taryn Dubreuil", seconds: 3600 }],
    },
    { internalSeconds: 1800, adminSeconds: 600, leadSeconds: 300 },
  );
  assert.equal(result.clientProductionSeconds, 3600);
  // Canonical internal (0, no RMEDIA-attributed Work Session here) + Sensor INTERNAL (1800) + Sensor ADMIN (600).
  assert.equal(result.internalOperationsSeconds, 2400);
  assert.equal(result.leadOperationsSeconds, 300);
  // Total includes everything: canonical (3600) + non-client Sensor (1800+600+300).
  assert.equal(result.totalIntentionalSeconds, 3600 + 1800 + 600 + 300);
});

test("splitIntentionalWork defaults to zero Sensor operational time when the second argument is omitted", () => {
  const result = splitIntentionalWork({ totalSeconds: 100, byClient: [] });
  assert.equal(result.leadOperationsSeconds, 0);
  assert.equal(result.totalIntentionalSeconds, 100);
});

test("isInternalClientName never fuzzy-matches a real external client", () => {
  assert.equal(isInternalClientName("RMEDIA Studios"), false);
  assert.equal(isInternalClientName("Taryn Dubreuil"), false);
  assert.equal(isInternalClientName(""), false);
  assert.equal(isInternalClientName(null), false);
  assert.equal(isInternalClientName(undefined), false);
});

test("displayClientName relabels only RMEDIA's own record", () => {
  assert.equal(displayClientName("RMEDIA"), "RMEDIA — INTERNAL");
  assert.equal(displayClientName("Dave DeMink"), "Dave DeMink");
});

test("getClientAccent is deterministic for the same clientId", () => {
  const first = getClientAccent(42, "Dave DeMink");
  const second = getClientAccent(42, "Dave DeMink");
  assert.deepEqual(first, second);
});

test("getClientAccent gives RMEDIA the neutral internal accent, never a client color", () => {
  const accent = getClientAccent(1, "RMEDIA");
  assert.equal(accent.text, "text-zinc-400");
  assert.equal(accent.dot, "bg-zinc-500");
});

test("getClientAccent spreads different clientIds across the palette", () => {
  const seen = new Set();
  for (let id = 0; id < 8; id++) {
    seen.add(getClientAccent(id, `Client ${id}`).text);
  }
  // Not a strict uniqueness guarantee (palette is finite), but 8
  // sequential ids against an 8-entry palette should hit every slot.
  assert.equal(seen.size, 8);
});
