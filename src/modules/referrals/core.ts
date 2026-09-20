// PDBM referral intake (Wave 2, 2026-09-20).
//
// One stable, shareable link -- /quoteavideo?ref=pdbm -- feeds the SAME
// canonical intake forms (/quoteavideo and its embedded call request) and
// stamps the resulting Lead's origin. No parallel form, no new table.
//
// Canonical owner of acquisition origin: clients.source ("for leads: where
// they came from" -- schema.ts). It already carries channel slugs
// ("quoteavideo", "book"), so a referral origin is the same kind of fact.
// It is stored as "referral:<program>" and rendered as a human label
// (describeLeadSource) everywhere the operator looks. Downstream (quote,
// booking, project) everything already hangs off the client row, so origin
// is derived from that one field rather than copied.
//
// The `ref` URL value is NEVER stored verbatim: it is resolved against this
// closed allowlist, so an arbitrary ?ref=... string cannot inject text into
// the CRM. UTM is deliberately not used -- it is not referral identity.

export type ReferralProgram = {
  key: string;
  /** Canonical value stored in clients.source. */
  source: string;
  /** Short operator-facing label. */
  label: string;
  /** Full human-readable business fact, recorded in the immutable CRM event. */
  originStatement: string;
  /** Understated line shown to the referred person (no partnership claim). */
  visitorLine: string;
};

export const REFERRAL_PROGRAMS: Record<string, ReferralProgram> = {
  pdbm: {
    key: "pdbm",
    source: "referral:pdbm",
    label: "Referral · PDBM (Taryn / CEO Clubhouse)",
    originStatement:
      "Referred through Perfect Day Business Mentorship (PDBM) — Taryn / CEO Clubhouse",
    visitorLine: "You were referred through Perfect Day Business Mentorship.",
  },
};

/** Resolve an untrusted `ref` value to a known program, or null. */
export function resolveReferral(value: unknown): ReferralProgram | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (!key || key.length > 40) return null;
  return Object.prototype.hasOwnProperty.call(REFERRAL_PROGRAMS, key) ? REFERRAL_PROGRAMS[key] : null;
}

/** The source a NEW lead gets: the referral origin wins over the channel slug. */
export function sourceForNewLead(channelSlug: string, referral: ReferralProgram | null): string {
  return referral ? referral.source : channelSlug;
}

/**
 * An EXISTING client's acquisition origin is never overwritten. It is only
 * filled when nothing was recorded at all. (The referral is still written to
 * the immutable event either way, so the fact is never lost.)
 */
export function shouldAdoptReferralSource(existingSource: string | null | undefined): boolean {
  return !existingSource || existingSource.trim() === "";
}

/** Human label for any stored source (falls back to the raw value). */
export function describeLeadSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const match = Object.values(REFERRAL_PROGRAMS).find((program) => program.source === source);
  return match ? match.label : source;
}

export function isReferralSource(source: string | null | undefined): boolean {
  return typeof source === "string" && source.startsWith("referral:");
}

/** Prefix for the immutable intake-event description; empty when not referred. */
export function referralDescriptionPrefix(referral: ReferralProgram | null): string {
  return referral ? `${referral.originStatement}. ` : "";
}
