// Dave Monday Release -- pure domain logic for Payment Requests. See the
// table comment in src/db/schema.ts for why this primitive exists and
// what it deliberately does NOT claim (never a confirmation that money
// actually moved -- that stays `transactions`' job alone).

export type PaymentRequestStatus = "OPEN" | "PAID" | "CANCELLED";

export function isPaymentRequestStatus(value: unknown): value is PaymentRequestStatus {
  return value === "OPEN" || value === "PAID" || value === "CANCELLED";
}

export type PaymentRequestCreateInput = {
  clientId: number;
  amountCents: number;
  currency: string;
  paymentUrl: string;
  note?: string | null;
};

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Deliberately narrow: the payment URL only ever needs to be a real,
// navigable HTTPS link (Wise today, something else tomorrow) -- not
// validated against a specific provider's URL shape, matching this
// codebase's existing "no closed platform vocabulary" convention (see
// commercial_contracts.platform's own comment).
export function validatePaymentUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "Enter a payment link.";
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return "Enter a valid payment link URL.";
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    return "Payment link must use HTTPS.";
  }
  return null;
}

export const PAYMENT_REQUEST_NOTE_MAX_LENGTH = 500;

export function validatePaymentRequestCreateInput(
  input: PaymentRequestCreateInput,
): string | null {
  if (!isPositiveInt(input.clientId)) return "Choose a client.";
  if (!isPositiveInt(input.amountCents)) return "Amount must be a positive number.";
  if (!input.currency || !/^[A-Z]{3}$/u.test(input.currency)) {
    return "Currency must be a 3-letter code (e.g. USD).";
  }
  const urlError = validatePaymentUrl(input.paymentUrl);
  if (urlError) return urlError;
  if (input.note != null && input.note.length > PAYMENT_REQUEST_NOTE_MAX_LENGTH) {
    return `Note must be ${PAYMENT_REQUEST_NOTE_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export type PaymentRequestRow = {
  id: number;
  clientId: number;
  amountCents: number;
  currency: string;
  paymentUrl: string;
  status: PaymentRequestStatus;
  note: string | null;
};

export function isMutablePaymentRequest(request: { status: PaymentRequestStatus }): boolean {
  return request.status === "OPEN";
}

// The one client-safe projection: an OPEN request's amount + link are
// exactly what a client should see. A PAID/CANCELLED request must never
// surface as an active CTA -- a stale Wise link on an already-settled
// request is precisely the confusing state this mission's own brief
// flagged from Dave's real chat history.
export type ClientPaymentRequestView = {
  amountCents: number;
  currency: string;
  paymentUrl: string;
} | null;

export function toClientPaymentRequestView(
  request: PaymentRequestRow | null,
): ClientPaymentRequestView {
  if (!request || request.status !== "OPEN") return null;
  return {
    amountCents: request.amountCents,
    currency: request.currency,
    paymentUrl: request.paymentUrl,
  };
}
