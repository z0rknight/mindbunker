import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../app/productivity/VideoEssentialsPanel.tsx", import.meta.url), "utf8");
const clientProjection = readFileSync(new URL("../client-portal/data.ts", import.meta.url), "utf8");

test("normal delivery action appends the next immutable version and keeps lifecycle independent", () => {
  const deliveryAction = actions.slice(actions.indexOf("export async function recordVideoDelivery"));
  const deliveryWrites = deliveryAction.slice(0, deliveryAction.indexOf("const commitmentUpdate"));
  assert.match(actions, /orderBy\(desc\(deliveries\.version\)\)/u);
  assert.match(actions, /const version = \(prior\[0\]\?\.version \?\? 0\) \+ 1/u);
  assert.match(actions, /status: version === 1 \? "DELIVERED" : "REDELIVERED"/u);
  assert.match(actions, /deliveredAt/u);
  assert.doesNotMatch(deliveryWrites, /status: "DONE"/u);
  assert.match(actions, /revalidateProductivityViews\(video\.clientId\)/u);
});

test("operator UI exposes the latest delivery first, preserves older versions, and creates the next labelled version with minimal input", () => {
  assert.match(panel, /Latest delivery/u);
  assert.match(panel, /snapshot\.deliveries\.slice\(1\)/u);
  assert.match(panel, /Version label \(e\.g\. Final export\)/u);
  assert.match(panel, /Record delivery v\$\{nextDeliveryVersion\}/u);
  assert.match(panel, /recordVideoDelivery\(\{ videoId, deliveryUrl, note: deliveryLabel/u);
  assert.match(panel, /Two adjacent decisions, two canonical histories/u);
});

test("latest client-safe delivery remains the canonical Video delivery URL, never approval", () => {
  assert.match(actions, /set\(\{ deliveryUrl: validatedUrl\.value, updatedAt: deliveredAt \}\)/u);
  assert.match(clientProjection, /deliveryUrl: videoLogs\.deliveryUrl/u);
  assert.doesNotMatch(actions.slice(actions.indexOf("export async function recordVideoDelivery")), /APPROVED|approval/u);
});
