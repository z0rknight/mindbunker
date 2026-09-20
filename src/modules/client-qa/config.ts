// Client protected terms + export reminders (Wave 4, 2026-09-19).
//
// Two deliberately separate, operator-only, client-scoped concepts:
//  - PROTECTED TERM: durable client knowledge -- an exact wording / spelling /
//    casing that must appear as written (a person, program, brand, phrase).
//  - EXPORT REMINDER: a lightweight operational nudge before a client-facing
//    export. It has NO completion state on purpose: the surface that shows it
//    is a read-only reminder, not a QA ledger, and never gates a status.
//
// The generic two-line baseline is static product copy (core.ts), never D1.
export const PROTECTED_TERM_KINDS = ["PERSON", "PROGRAM", "BRAND", "PHRASE"] as const;
export type ProtectedTermKind = (typeof PROTECTED_TERM_KINDS)[number];

export const PROTECTED_TERM_KIND_LABELS: Record<ProtectedTermKind, string> = {
  PERSON: "Person",
  PROGRAM: "Program",
  BRAND: "Brand",
  PHRASE: "Phrase",
};

// The surface shows a short list; anything beyond this is not a reminder.
export const MAX_EXPORT_REMINDERS_PER_CLIENT = 6;
