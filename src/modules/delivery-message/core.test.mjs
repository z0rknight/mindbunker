import assert from "node:assert/strict";
import test from "node:test";
import { formatDeliveryMessage } from "./core.ts";

const BASE_PAYLOAD = {
  clientName: "Dave DeMink",
  videoTitle: "MetaAds_A",
  contentTypeLabel: "Meta Ad",
  turnaroundDays: 2,
  workDone: ["Editing", "Color"],
  deliverables: [{ label: "Review link", url: "https://frame.io/abc" }],
  estimatedAccrued: { amount: 19.17, currency: "USD" },
  agreedAmount: null,
  revisionsCount: 0,
};

test("formatDeliveryMessage: includes only client-safe deterministic facts, matches worked example shape", () => {
  const text = formatDeliveryMessage(BASE_PAYLOAD);
  assert.match(text, /Hi Dave DeMink,/);
  assert.match(text, /Content type: Meta Ad/);
  assert.match(text, /Turnaround: 2 days/);
  assert.match(text, /- Editing/);
  assert.match(text, /- Color/);
  assert.match(text, /- Review link: https:\/\/frame\.io\/abc/);
  assert.match(text, /Estimated accrued: \$19\.17/);
  // Never fabricates a paid/invoice claim.
  assert.doesNotMatch(text, /Paid|Invoice|Received/i);
});

test("formatDeliveryMessage: omits turnaround entirely when not deterministic, never fakes a number", () => {
  const text = formatDeliveryMessage({ ...BASE_PAYLOAD, turnaroundDays: null });
  assert.doesNotMatch(text, /Turnaround/);
});

test("formatDeliveryMessage: FIXED agreed amount shown instead of estimated accrued, never both", () => {
  const text = formatDeliveryMessage({
    ...BASE_PAYLOAD,
    estimatedAccrued: null,
    agreedAmount: { amountCents: 10000, currency: "USD" },
  });
  assert.match(text, /Agreed price: \$100\.00/);
  assert.doesNotMatch(text, /Estimated accrued/);
});

test("formatDeliveryMessage: no commercial model present omits the money line entirely, never shows $0", () => {
  const text = formatDeliveryMessage({ ...BASE_PAYLOAD, estimatedAccrued: null, agreedAmount: null });
  assert.doesNotMatch(text, /Agreed price|Estimated accrued/);
});

test("formatDeliveryMessage: empty workDone/deliverables omit those sections rather than inventing content", () => {
  const text = formatDeliveryMessage({ ...BASE_PAYLOAD, workDone: [], deliverables: [] });
  assert.doesNotMatch(text, /What I've done/);
  assert.doesNotMatch(text, /Deliverables:/);
});
