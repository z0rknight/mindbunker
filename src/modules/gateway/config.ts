export const OPPORTUNITY_STAGES = [
  "new",
  "qualified",
  "invited",
  "booked",
  "offer_sent",
  "payment_pending",
  "paid",
  "onboarding",
  "active",
  "lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  new: "New",
  qualified: "Qualified",
  invited: "Invited",
  booked: "Booked",
  offer_sent: "Offer sent",
  payment_pending: "Payment pending",
  paid: "Paid",
  onboarding: "Onboarding",
  active: "Active",
  lost: "Lost",
};

export const SERVICE_INTEREST_OPTIONS = [
  { value: "short-form", label: "Short-form" },
  { value: "long-form", label: "Long-form" },
  { value: "mini-doc", label: "Mini-doc / Storytelling" },
  { value: "testimonial", label: "Testimonial" },
  { value: "other", label: "Other" },
] as const;

export type ServiceInterest =
  (typeof SERVICE_INTEREST_OPTIONS)[number]["value"];

export const GATEWAY_PATH_PREFIX = "/mindbunker/g";
export const CLIENT_PORTAL_PATH_PREFIX = "/mindbunker/client";
export const GATEWAY_TOKEN_BYTES = 32;
export const GATEWAY_TOKEN_TTL_DAYS = 14;
