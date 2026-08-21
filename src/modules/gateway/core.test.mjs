import assert from "node:assert/strict";
import test from "node:test";
import {
  createGatewayToken,
  getGatewayAccessStatus,
  hashGatewayToken,
  isGatewayToken,
  stageAfterGatewayInvitation,
  validateBriefingInput,
} from "./core.ts";

test("gateway tokens are strong URL-safe values and only their hash is persisted", async () => {
  const first = createGatewayToken();
  const second = createGatewayToken();

  assert.equal(isGatewayToken(first), true);
  assert.equal(first.length, 43);
  assert.notEqual(first, second);

  const hash = await hashGatewayToken(first);
  assert.match(hash, /^[a-f0-9]{64}$/u);
  assert.notEqual(hash, first);
});

test("invalid token shapes fail before a database lookup", () => {
  assert.equal(isGatewayToken("1"), false);
  assert.equal(isGatewayToken("a".repeat(42)), false);
  assert.equal(isGatewayToken("a".repeat(43)), true);
  assert.equal(isGatewayToken("!".repeat(43)), false);
});

test("revoked and expired invitations fail closed", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  assert.equal(
    getGatewayAccessStatus(
      { expiresAt: new Date("2026-08-20T12:00:00.000Z"), revokedAt: null },
      now,
    ),
    "active",
  );
  assert.equal(
    getGatewayAccessStatus(
      { expiresAt: new Date("2026-08-19T11:59:59.000Z"), revokedAt: null },
      now,
    ),
    "expired",
  );
  assert.equal(
    getGatewayAccessStatus(
      {
        expiresAt: new Date("2026-08-20T12:00:00.000Z"),
        revokedAt: new Date("2026-08-19T11:00:00.000Z"),
      },
      now,
    ),
    "revoked",
  );
});

test("a gateway invitation advances only early opportunity stages", () => {
  assert.equal(stageAfterGatewayInvitation("new"), "invited");
  assert.equal(stageAfterGatewayInvitation("qualified"), "invited");
  assert.equal(stageAfterGatewayInvitation("offer_sent"), "offer_sent");
  assert.equal(stageAfterGatewayInvitation("active"), "active");
});

test("briefing validation requires only the three useful essentials", () => {
  const result = validateBriefingInput({
    serviceInterest: "short-form",
    projectSummary: "  A launch series  ",
    objective: "  Explain the product  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.projectSummary, "A launch series");
    assert.equal(result.data.objective, "Explain the product");
    assert.equal(result.data.notes, "");
  }
});

test("briefing validation rejects fabricated service values and empty essentials", () => {
  const result = validateBriefingInput({
    serviceInterest: "enterprise-package",
    projectSummary: "",
    objective: "x",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.serviceInterest);
    assert.ok(result.errors.projectSummary);
    assert.ok(result.errors.objective);
  }
});

