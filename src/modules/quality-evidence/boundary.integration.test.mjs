import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const operatorRoute = readFileSync(new URL("../../app/api/quality-evidence/[id]/media/[side]/route.ts", import.meta.url), "utf8");
const clientRoute = readFileSync(new URL("../../app/client/api/quality-evidence/[id]/media/[side]/route.ts", import.meta.url), "utf8");
const data = readFileSync(new URL("./data.ts", import.meta.url), "utf8");
const serve = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
const comparison = readFileSync(new URL("../../components/quality-evidence/QualityEvidenceComparison.tsx", import.meta.url), "utf8");

test("both media surfaces authenticate before resolving a reference", () => {
  assert.match(operatorRoute, /await isAuthenticated\(\)/u);
  assert.match(clientRoute, /await isClientAuthenticated\(\)/u);
});

test("client reads require ownership, complete pair, visible Video and CLIENT_SAFE visibility", () => {
  for (const source of [data, serve]) {
    assert.match(source, /qualityEvidence\.visibility, "CLIENT_SAFE"/u);
    assert.match(source, /qualityEvidence\.beforeReference/u);
    assert.match(source, /qualityEvidence\.afterReference/u);
    assert.match(source, /inArray\(videoLogs\.clientId, (?:clientScope|scope)\)/u);
    assert.match(source, /inArray\(projects\.clientId, (?:clientScope|scope)\)/u);
    assert.match(source, /videoLogs\.visibleToClient, true/u);
  }
});

test("client comparison omits internal metadata while operator can see provenance and visibility", () => {
  assert.match(comparison, /internal &&/u);
  assert.match(comparison, /Provenance/u);
  assert.match(comparison, /Client safe/u);
});

test("image slider and single audio context implement the requested low-friction controls", () => {
  assert.match(comparison, /type="range"/u);
  assert.match(comparison, /clipPath/u);
  assert.equal((comparison.match(/<audio/gu) ?? []).length, 1);
  assert.match(comparison, /pendingRef/u);
  assert.match(comparison, /currentTime/u);
  assert.doesNotMatch(comparison, /autoplay|autoPlay/u);
});
