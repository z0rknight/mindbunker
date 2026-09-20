// Taryn's initial pre-export data, exactly as approved for Wave 4
// (2026-09-19). Only spellings/reminders with sufficient support are here.
//
// Deliberately NOT seeded (see the Wave 4 report):
//  - "Jannalee", "100 Lead Game", "Buy Line": their spellings rest on an AI
//    summary of Slack only; never guessed.
//  - "CEO Strong": that program belongs to Bonnie's context, not Taryn's.
//  - "Taryn": no error evidence, no product value.
//  - thumbnail / private-review-link / mic-glitch checks and the V1/V2/V3
//    ritual: isolated incidents or explicitly not adopted.
// No client id on purpose: the operator insert resolves it from production.
import type { ExportReminderInput, ProtectedTermInput } from "./core.ts";

export const INITIAL_TARYN_PROTECTED_TERMS: readonly ProtectedTermInput[] = [
  { term: "CEO Clubhouse", kind: "PROGRAM", note: null },
  { term: "Perfect Day Business Mentorship", kind: "PROGRAM", note: null },
  // An abbreviation of a program name: a PROGRAM, not a free phrase.
  { term: "PDBM", kind: "PROGRAM", note: "Short form of Perfect Day Business Mentorship." },
];

export const INITIAL_TARYN_EXPORT_REMINDERS: readonly ExportReminderInput[] = [
  { text: "B-roll shows the correct person." },
  { text: "Keep skin tone natural; avoid pale / washed appearance." },
  { text: "Horizontal videos should fill the intended frame with no unintended black bars." },
];
