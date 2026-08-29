import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputDir = await mkdtemp(path.join(tmpdir(), "mindbunker-custody-core-"));
const outputFile = path.join(outputDir, "core.mjs");

await build({
  entryPoints: [path.resolve("src/modules/custody/core.ts")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  tsconfig: path.resolve("tsconfig.json"),
});

const { buildCustodyProjection, parseHttpsExternalReference } = await import(
  `${pathToFileURL(outputFile).href}?v=${Date.now()}`
);

test.after(async () => {
  await rm(outputDir, { recursive: true, force: true });
});

const client = { id: 1, name: "Fixture", status: "active" };

test("Dave fixed-price custody closes $100 once, removes it from pipeline, and keeps Finance separate", () => {
  const result = buildCustodyProjection({
    client: { ...client, name: "Dave DeMink" },
    quotes: [{
      id: 10,
      status: "APPROVED",
      currency: "USD",
      amountCents: 10_000,
      contentTypeLabel: "Landing Page",
      projectId: 20,
      videoId: 30,
    }],
    contracts: [],
    projects: [{ id: 20, name: "Landing Page", status: "active" }],
    videos: [{ id: 30, projectId: 20, title: "Landing Page", status: "READY_FOR_REVIEW", sessionCount: 2, closedSeconds: 3600 }],
    billingEvidence: [],
    income: [{ id: 40, amount: 100, currency: "USD", contractId: null, billingEvidenceId: null }],
  });

  assert.deepEqual(result.commercialValue.pipelineByCurrency, []);
  assert.equal(result.commercialValue.closedByCurrency[0].count, 1);
  assert.equal(result.commercialValue.closedByCurrency[0].totalAmountCents, 10_000);
  assert.equal(result.financeIncomeByCurrency[0].amount, 100);
  assert.equal(result.clientOnlyIncomeCount, 1, "receipt is client-linked, not silently quote-specific");
  assert.equal(result.quotes.length, 1, "the projection never creates a duplicate sale row");
});

test("Taryn hourly custody never invents fixed pipeline or closed value from Client, Project, or Video", () => {
  const result = buildCustodyProjection({
    client: { ...client, name: "Taryn Dubreuil" },
    quotes: [],
    contracts: [{
      id: 11,
      platform: "Upwork",
      billingType: "HOURLY",
      hourlyRate: 25,
      currency: "USD",
      status: "ACTIVE",
      externalReference: "https://www.upwork.com/contracts/11",
    }],
    projects: [{ id: 21, name: "MINI SERIES", status: "active" }],
    videos: [{ id: 31, projectId: 21, title: "Episode 1", status: "PLANNED", sessionCount: 0, closedSeconds: 0 }],
    billingEvidence: [],
    income: [],
  });

  assert.deepEqual(result.commercialValue.pipelineByCurrency, []);
  assert.deepEqual(result.commercialValue.closedByCurrency, []);
  assert.equal(result.contracts[0].hourlyRate, 25);
  assert.equal(result.projects[0].videos[0].title, "Episode 1");
});

test("Shelley production remains truthful when no commercial context has been recorded", () => {
  const result = buildCustodyProjection({
    client: { ...client, name: "Shelley Riutta" },
    quotes: [],
    contracts: [],
    projects: [{ id: 22, name: "MINI SERIES", status: "planned" }],
    videos: [{ id: 32, projectId: 22, title: "Episode 1", status: "PLANNED", sessionCount: 0, closedSeconds: 0 }],
    billingEvidence: [],
    income: [],
  });

  assert.deepEqual(result.commercialValue.pipelineByCurrency, []);
  assert.deepEqual(result.commercialValue.closedByCurrency, []);
  assert.deepEqual(result.contracts, []);
  assert.equal(result.projects[0].videos[0].title, "Episode 1");
});

test("draft and sent quotes remain pipeline, accepted quotes are closed, and currencies never mix", () => {
  const result = buildCustodyProjection({
    client,
    quotes: [
      { id: 1, status: "DRAFT", currency: "USD", amountCents: 1_000, contentTypeLabel: "A", projectId: null, videoId: null },
      { id: 2, status: "SENT", currency: "BRL", amountCents: 2_000, contentTypeLabel: "B", projectId: null, videoId: null },
      { id: 3, status: "APPROVED", currency: "USD", amountCents: 3_000, contentTypeLabel: "C", projectId: null, videoId: null },
    ],
    contracts: [], projects: [], videos: [], billingEvidence: [], income: [],
  });

  assert.deepEqual(result.commercialValue.pipelineByCurrency.map((row) => row.currency), ["BRL", "USD"]);
  assert.deepEqual(result.commercialValue.closedByCurrency.map((row) => row.currency), ["USD"]);
  assert.equal(result.quotes.find((quote) => quote.id === 3)?.commercialState, "CLOSED");
});

test("external contract references become links only when they are HTTPS", () => {
  assert.equal(parseHttpsExternalReference("https://www.upwork.com/contracts/42"), "https://www.upwork.com/contracts/42");
  assert.equal(parseHttpsExternalReference("http://example.com/42"), null);
  assert.equal(parseHttpsExternalReference("UPWORK-42"), null);
  assert.equal(parseHttpsExternalReference("javascript:alert(1)"), null);
});
