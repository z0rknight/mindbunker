// Client Service Reality Patch (25 Aug 2026) -- /quoteavideo public intake.
//
// Pure validation for the public "REQUEST A VIDEO" form. Mirrors
// modules/booking/core.ts's validatePublicBookingRequestInput almost
// exactly (same email cleaning, same shape of result) but with the
// richer briefing-style fields the brief asks for, reusing the existing
// ServiceInterest vocabulary (gateway/config.ts) as "content type" rather
// than inventing a parallel one.

import { cleanEmail } from "../booking/core.ts";
import { referralDescriptionPrefix, type ReferralProgram } from "../referrals/core.ts";
import { SERVICE_INTEREST_OPTIONS, type ServiceInterest } from "../gateway/config.ts";

// No isServiceInterest guard exists on the gateway module (it only exports
// the options list + type) -- build the same kind of narrow-and-check
// helper locally rather than adding an export to a module this patch
// otherwise leaves untouched.
function isServiceInterest(value: unknown): value is ServiceInterest {
  return (
    typeof value === "string" &&
    SERVICE_INTEREST_OPTIONS.some((option) => option.value === value)
  );
}

export { cleanEmail };

export type QuoteRequestInput = {
  name: string;
  email: string;
  company: string | null;
  contentType: ServiceInterest;
  whatAreYouCreating: string;
  mainObjective: string;
  quantityFrequency: string | null;
  idealTimeline: string | null;
  referencesContext: string | null;
  notes: string | null;
};

export type QuoteRequestValidation =
  | { success: true; data: QuoteRequestInput }
  | { success: false; errors: Record<string, string> };

function trimmedOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

export function validateQuoteRequestInput(
  values: Record<string, unknown>,
): QuoteRequestValidation {
  const errors: Record<string, string> = {};

  const name = typeof values.name === "string" ? values.name.trim().slice(0, 160) : "";
  if (!name) errors.name = "Your name is required.";

  const email = cleanEmail(values.email);
  if (!email) errors.email = "Enter a valid email address.";

  const company = trimmedOrNull(values.company, 160);

  const contentType = isServiceInterest(values.contentType) ? values.contentType : null;
  if (!contentType) errors.contentType = "Choose the closest content type.";

  const whatAreYouCreating =
    typeof values.whatAreYouCreating === "string" ? values.whatAreYouCreating.trim().slice(0, 800) : "";
  if (whatAreYouCreating.length < 3) errors.whatAreYouCreating = "Tell us what you're creating.";

  const mainObjective =
    typeof values.mainObjective === "string" ? values.mainObjective.trim().slice(0, 800) : "";
  if (mainObjective.length < 3) errors.mainObjective = "Tell us the main objective.";

  const quantityFrequency = trimmedOrNull(values.quantityFrequency, 300);
  const idealTimeline = trimmedOrNull(values.idealTimeline, 300);
  const referencesContext = trimmedOrNull(values.referencesContext, 1_200);
  const notes = trimmedOrNull(values.notes, 1_200);

  if (Object.keys(errors).length > 0 || !contentType) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      email: email!,
      company,
      contentType,
      whatAreYouCreating,
      mainObjective,
      quantityFrequency,
      idealTimeline,
      referencesContext,
      notes,
    },
  };
}

export const QUOTE_REQUEST_EVENT_TYPE = "quote.requested";

// A readable, immutable snapshot of the submission -- same "store the raw
// request as crm_events.description" pattern /book's public intake
// already uses (see submitPublicBookingRequest), rather than a new table
// for evidence that's read, not queried structurally.
export function buildQuoteRequestDescription(
  data: QuoteRequestInput,
  referral: ReferralProgram | null = null,
): string {
  const parts = [
    `Video quote request from ${data.name} (${data.email})`,
    data.company ? `Company: ${data.company}` : null,
    `Content type: ${data.contentType}`,
    `What they're creating: ${data.whatAreYouCreating}`,
    `Main objective: ${data.mainObjective}`,
    data.quantityFrequency ? `Quantity/frequency: ${data.quantityFrequency}` : null,
    data.idealTimeline ? `Ideal timeline: ${data.idealTimeline}` : null,
    data.referencesContext ? `References/context: ${data.referencesContext}` : null,
    data.notes ? `Notes: ${data.notes}` : null,
  ].filter(Boolean);
  return (referralDescriptionPrefix(referral) + parts.join(" — ")).slice(0, 4_000);
}
