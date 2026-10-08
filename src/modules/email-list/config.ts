export const EMAIL_CONTACT_CLIENT_TYPES = [
  "UNCLASSIFIED",
  "EXPERT_EDUCATOR",
  "BRAND_LIFESTYLE",
  "AGENCY_STUDIO",
  "REAL_ESTATE_ARCHITECTURE",
  "SAAS_TECH",
  "OTHER",
] as const;

export type EmailContactClientType = (typeof EMAIL_CONTACT_CLIENT_TYPES)[number];

export const EMAIL_CONTACT_CLIENT_TYPE_LABELS: Record<EmailContactClientType, string> = {
  UNCLASSIFIED: "Unclassified",
  EXPERT_EDUCATOR: "Expert / educator",
  BRAND_LIFESTYLE: "Brand / lifestyle",
  AGENCY_STUDIO: "Agency / studio",
  REAL_ESTATE_ARCHITECTURE: "Real estate / architecture",
  SAAS_TECH: "SaaS / tech",
  OTHER: "Other",
};

export const EMAIL_CONTACT_STATUSES = ["ACTIVE", "DO_NOT_CONTACT", "BOUNCED", "ARCHIVED"] as const;
export type EmailContactStatus = (typeof EMAIL_CONTACT_STATUSES)[number];

export const EMAIL_CONTACT_STATUS_LABELS: Record<EmailContactStatus, string> = {
  ACTIVE: "Ready to contact",
  DO_NOT_CONTACT: "Do not contact",
  BOUNCED: "Bounced",
  ARCHIVED: "Archived",
};

export const EMAIL_CONTACT_ORIGINS = ["PAST_CLIENT", "INBOUND", "MANUAL"] as const;
export type EmailContactOrigin = (typeof EMAIL_CONTACT_ORIGINS)[number];

export const EMAIL_CONTACT_ORIGIN_LABELS: Record<EmailContactOrigin, string> = {
  PAST_CLIENT: "Past client",
  INBOUND: "Inbound",
  MANUAL: "Manual",
};

export function isEmailContactClientType(value: unknown): value is EmailContactClientType {
  return typeof value === "string" && EMAIL_CONTACT_CLIENT_TYPES.includes(value as EmailContactClientType);
}

export function isEmailContactStatus(value: unknown): value is EmailContactStatus {
  return typeof value === "string" && EMAIL_CONTACT_STATUSES.includes(value as EmailContactStatus);
}

export function isEmailContactOrigin(value: unknown): value is EmailContactOrigin {
  return typeof value === "string" && EMAIL_CONTACT_ORIGINS.includes(value as EmailContactOrigin);
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
}

export function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
