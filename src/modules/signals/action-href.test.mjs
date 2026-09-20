import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { signalActionHref } from "./core.ts";

test("origin-aware signal actions (video workspace, production order) carry the caller's origin", () => {
  assert.equal(signalActionHref("/productivity?video=42", "/war-room"), "/productivity?video=42&returnTo=%2Fwar-room");
  assert.equal(signalActionHref("/productivity/orders/7", "/productivity"), "/productivity/orders/7?returnTo=%2Fproductivity");
});

test("other destinations are untouched (they do not read returnTo)", () => {
  for (const href of ["/finance", "/productivity/captures", "/productivity?video=abc", "/productivity/orders/new", "/productivity/orders/7/extra"]) {
    assert.equal(signalActionHref(href, "/war-room"), href, href);
  }
});

test("an unsafe returnTo is ignored, never trusted", () => {
  for (const bad of ["//evil.com", "https://evil.com", "war-room", "/a\\b", ""]) {
    assert.equal(signalActionHref("/productivity?video=42", bad), "/productivity?video=42", JSON.stringify(bad));
  }
});

test("both signal render sites use the helper (no raw signal.action.href left)", () => {
  const war = readFileSync(new URL("../../app/war-room/page.tsx", import.meta.url), "utf8");
  const attention = readFileSync(new URL("../../app/productivity/NeedsAttentionSection.tsx", import.meta.url), "utf8");
  assert.match(war, /signalActionHref\(signal\.action\.href, "\/war-room"\)/u);
  assert.match(attention, /signalActionHref\(signal\.action\.href, "\/productivity"\)/u);
  assert.doesNotMatch(war, /href=\{signal\.action\.href\}/u);
  assert.doesNotMatch(attention, /href=\{signal\.action\.href\}/u);
});

test("the commitment card's 'Open workspace' also carries its origin (same root pattern)", () => {
  const card = readFileSync(new URL("../../components/commitments/ActiveCommitmentCard.tsx", import.meta.url), "utf8");
  assert.match(card, /videoWorkspaceHref\(commitment\.videoId, returnTo\)/u);
  assert.doesNotMatch(card, /href=\{`\/productivity\?video=\$\{commitment\.videoId\}`\}/u);
  const war = readFileSync(new URL("../../app/war-room/page.tsx", import.meta.url), "utf8");
  assert.match(war, /<ActiveCommitmentCard[\s\S]{0,300}returnTo="\/war-room"/u);
});
