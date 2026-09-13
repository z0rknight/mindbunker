import assert from "node:assert/strict";
import test from "node:test";
import {
  isMutablePaymentRequest,
  toClientPaymentRequestView,
  validatePaymentRequestCreateInput,
  validatePaymentUrl,
} from "./core.ts";

test("validatePaymentRequestCreateInput accepts a real Dave-shaped request", () => {
  const error = validatePaymentRequestCreateInput({
    clientId: 4,
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
    note: null,
  });
  assert.equal(error, null);
});

test("validatePaymentRequestCreateInput rejects a zero or negative amount", () => {
  assert.notEqual(
    validatePaymentRequestCreateInput({
      clientId: 4,
      amountCents: 0,
      currency: "USD",
      paymentUrl: "https://wise.com/pay/r/x",
    }),
    null,
  );
  assert.notEqual(
    validatePaymentRequestCreateInput({
      clientId: 4,
      amountCents: -100,
      currency: "USD",
      paymentUrl: "https://wise.com/pay/r/x",
    }),
    null,
  );
});

test("validatePaymentUrl requires HTTPS", () => {
  assert.equal(validatePaymentUrl("https://wise.com/pay/r/HO2YUO3U08AXDzo"), null);
  assert.notEqual(validatePaymentUrl("http://wise.com/pay/r/HO2YUO3U08AXDzo"), null);
  assert.notEqual(validatePaymentUrl("not a url"), null);
  assert.notEqual(validatePaymentUrl(""), null);
});

test("validatePaymentRequestCreateInput rejects a malformed currency code", () => {
  assert.notEqual(
    validatePaymentRequestCreateInput({
      clientId: 4,
      amountCents: 37266,
      currency: "us",
      paymentUrl: "https://wise.com/pay/r/x",
    }),
    null,
  );
});

test("isMutablePaymentRequest is true only for OPEN", () => {
  assert.equal(isMutablePaymentRequest({ status: "OPEN" }), true);
  assert.equal(isMutablePaymentRequest({ status: "PAID" }), false);
  assert.equal(isMutablePaymentRequest({ status: "CANCELLED" }), false);
});

// Client-safe projection: the one place OPEN vs PAID/CANCELLED decides
// whether a client sees an active CTA at all -- see the mission's own
// stale-Wise-link concern (Dave's real chat history had exactly this
// problem once already).
test("toClientPaymentRequestView exposes an OPEN request's safe fields", () => {
  const view = toClientPaymentRequestView({
    id: 1,
    clientId: 4,
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
    status: "OPEN",
    note: "internal note",
  });
  assert.deepEqual(view, {
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
  });
  // The internal note is never part of the client-safe view's shape.
  assert.equal("note" in view, false);
});

test("toClientPaymentRequestView hides a PAID request -- never a stale active CTA", () => {
  const view = toClientPaymentRequestView({
    id: 1,
    clientId: 4,
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
    status: "PAID",
    note: null,
  });
  assert.equal(view, null);
});

test("toClientPaymentRequestView hides a CANCELLED request", () => {
  const view = toClientPaymentRequestView({
    id: 1,
    clientId: 4,
    amountCents: 37266,
    currency: "USD",
    paymentUrl: "https://wise.com/pay/r/HO2YUO3U08AXDzo",
    status: "CANCELLED",
    note: null,
  });
  assert.equal(view, null);
});

test("toClientPaymentRequestView returns null when there is no request at all -- never a fabricated balance", () => {
  assert.equal(toClientPaymentRequestView(null), null);
});
