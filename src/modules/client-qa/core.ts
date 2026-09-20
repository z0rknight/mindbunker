// Client protected terms + export reminders -- pure rules (no DB, no framework).
// See config.ts for the two-concept rationale. Nothing here reads or writes a
// video's status, sessions or money: this whole feature is a read-only
// reminder surface plus operator CRUD on two client-scoped lists.

import {
  MAX_EXPORT_REMINDERS_PER_CLIENT,
  PROTECTED_TERM_KINDS,
  type ProtectedTermKind,
} from "./config.ts";

// The ONLY generic checks. Static product copy on purpose: never stored in D1,
// never per-client, and not to be extended without new repeated-error evidence
// (Wave 4 evidence supports exactly these two).
export const GENERIC_EXPORT_CHECKS = [
  { label: "Captions / text", text: "Check spelling and doubled / extra words." },
  { label: "Clean cut", text: "Check for leftover greeting, scuff or dead material." },
] as const;

export type ProtectedTermInput = { term: string; kind: ProtectedTermKind | null; note: string | null };
export type ExportReminderInput = { text: string };

type Validation<T> = { success: true; data: T } | { success: false; errors: Record<string, string> };

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

export function isProtectedTermKind(value: unknown): value is ProtectedTermKind {
  return typeof value === "string" && (PROTECTED_TERM_KINDS as readonly string[]).includes(value);
}

export function validateProtectedTermInput(values: Record<string, unknown>): Validation<ProtectedTermInput> {
  const errors: Record<string, string> = {};
  // The term IS the exact form to protect: only trimmed, never re-cased.
  const term = typeof values.term === "string" ? values.term.trim().slice(0, 120) : "";
  if (term === "") errors.term = "Enter the exact term.";

  let kind: ProtectedTermKind | null = null;
  if (values.kind !== undefined && values.kind !== null && values.kind !== "") {
    if (isProtectedTermKind(values.kind)) kind = values.kind;
    else errors.kind = "Choose Person, Program, Brand or Phrase, or leave it blank.";
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { term, kind, note: optionalText(values.note, 300) } };
}

export function validateExportReminderInput(values: Record<string, unknown>): Validation<ExportReminderInput> {
  const text = typeof values.text === "string" ? values.text.trim().slice(0, 200) : "";
  if (text === "") return { success: false, errors: { text: "Write the reminder." } };
  return { success: true, data: { text } };
}

const norm = (value: string) => value.trim().toLowerCase();

/** Friendly pre-check; the UNIQUE(client_id, term) index is the hard guarantee. */
export function isDuplicateTerm(
  existing: readonly { id: number; term: string }[],
  term: string,
  excludeId: number | null = null,
): boolean {
  return existing.some((row) => row.id !== excludeId && norm(row.term) === norm(term));
}

export function isDuplicateReminder(
  existing: readonly { id: number; text: string }[],
  text: string,
  excludeId: number | null = null,
): boolean {
  return existing.some((row) => row.id !== excludeId && norm(row.text) === norm(text));
}

export function canAddReminder(currentCount: number): boolean {
  return currentCount < MAX_EXPORT_REMINDERS_PER_CLIENT;
}

export type PreExportView<TMemory> = {
  terms: Array<{ id: number; term: string; kind: ProtectedTermKind | null; note: string | null }>;
  reminders: Array<{ id: number; text: string }>;
  generic: typeof GENERIC_EXPORT_CHECKS;
  memories: TMemory[];
};

/**
 * Assembles the read-only "Before you export" view. With no client data the
 * result is exactly the two static generic checks -- never anything borrowed
 * from another client. Reminders are capped so this stays a short list.
 */
export function buildPreExportView<TMemory>(input: {
  terms?: PreExportView<TMemory>["terms"];
  reminders?: PreExportView<TMemory>["reminders"];
  memories?: TMemory[];
}): PreExportView<TMemory> {
  return {
    terms: input.terms ?? [],
    reminders: (input.reminders ?? []).slice(0, MAX_EXPORT_REMINDERS_PER_CLIENT),
    generic: GENERIC_EXPORT_CHECKS,
    memories: input.memories ?? [],
  };
}
