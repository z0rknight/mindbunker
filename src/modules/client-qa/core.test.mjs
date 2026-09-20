import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERIC_EXPORT_CHECKS,
  buildPreExportView,
  canAddReminder,
  isDuplicateReminder,
  isDuplicateTerm,
  validateExportReminderInput,
  validateProtectedTermInput,
} from "./core.ts";
import { MAX_EXPORT_REMINDERS_PER_CLIENT, PROTECTED_TERM_KINDS } from "./config.ts";
import { INITIAL_TARYN_EXPORT_REMINDERS, INITIAL_TARYN_PROTECTED_TERMS } from "./initial-taryn.ts";

test("term kinds are exactly Person / Program / Brand / Phrase", () => {
  assert.deepEqual([...PROTECTED_TERM_KINDS], ["PERSON", "PROGRAM", "BRAND", "PHRASE"]);
});

test("protected term: only the term is required; kind and note may stay unknown", () => {
  const ok = validateProtectedTermInput({ term: "  CEO Clubhouse " });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.data, { term: "CEO Clubhouse", kind: null, note: null });
  for (const bad of [undefined, null, "", "   ", 7]) {
    const result = validateProtectedTermInput({ term: bad });
    assert.equal(result.success, false);
    assert.ok(result.errors.term);
  }
});

test("protected term keeps the EXACT casing given (no normalisation)", () => {
  assert.equal(validateProtectedTermInput({ term: "PDBM" }).data.term, "PDBM");
  assert.equal(validateProtectedTermInput({ term: "iPhone Reels" }).data.term, "iPhone Reels");
});

test("protected term kind must be one of the four values, or blank", () => {
  for (const kind of ["PERSON", "PROGRAM", "BRAND", "PHRASE", "", null, undefined]) {
    assert.equal(validateProtectedTermInput({ term: "X", kind }).success, true, String(kind));
  }
  for (const kind of ["person", "COMPANY", "DRAFT", "ACTIVE"]) {
    const result = validateProtectedTermInput({ term: "X", kind });
    assert.equal(result.success, false, kind);
    assert.ok(result.errors.kind);
  }
});

test("export reminder: text required, trimmed; no completion/severity fields exist", () => {
  assert.deepEqual(validateExportReminderInput({ text: "  B-roll shows the correct person. " }).data, { text: "B-roll shows the correct person." });
  for (const bad of [undefined, "", "  ", 3]) assert.equal(validateExportReminderInput({ text: bad }).success, false);
  // extra keys are ignored, never persisted
  assert.deepEqual(Object.keys(validateExportReminderInput({ text: "x", checked: true, required: true, severity: "high" }).data), ["text"]);
});

test("duplicate pre-checks are trim + case-insensitive and exclude the row being edited", () => {
  const terms = [{ id: 1, term: "CEO Clubhouse" }];
  assert.equal(isDuplicateTerm(terms, " ceo clubhouse "), true);
  assert.equal(isDuplicateTerm(terms, "CEO Clubhouse", 1), false);
  assert.equal(isDuplicateTerm(terms, "PDBM"), false);
  const reminders = [{ id: 1, text: "Keep it short." }];
  assert.equal(isDuplicateReminder(reminders, "keep it short."), true);
  assert.equal(isDuplicateReminder(reminders, "Keep it short.", 1), false);
});

test("reminder cap keeps the list short", () => {
  assert.equal(MAX_EXPORT_REMINDERS_PER_CLIENT, 6);
  assert.equal(canAddReminder(5), true);
  assert.equal(canAddReminder(6), false);
});

test("generic baseline is exactly the two supported static checks", () => {
  assert.equal(GENERIC_EXPORT_CHECKS.length, 2);
  assert.deepEqual(GENERIC_EXPORT_CHECKS.map((c) => c.label), ["Captions / text", "Clean cut"]);
  assert.equal(GENERIC_EXPORT_CHECKS[0].text, "Check spelling and doubled / extra words.");
  assert.equal(GENERIC_EXPORT_CHECKS[1].text, "Check for leftover greeting, scuff or dead material.");
});

test("a client with no data gets ONLY the generic baseline (missing vocabulary/reminders/memory)", () => {
  const view = buildPreExportView({});
  assert.deepEqual(view.terms, []);
  assert.deepEqual(view.reminders, []);
  assert.deepEqual(view.memories, []);
  assert.equal(view.generic.length, 2);
});

test("view carries client data when present and caps reminders", () => {
  const reminders = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, text: `r${i}` }));
  const view = buildPreExportView({ terms: [{ id: 1, term: "CEO Clubhouse", kind: "PROGRAM", note: null }], reminders, memories: [{ id: 1, name: "Lecture Format" }] });
  assert.equal(view.terms.length, 1);
  assert.equal(view.reminders.length, 6);
  assert.equal(view.memories.length, 1);
  assert.equal(view.generic.length, 2);
});

test("Taryn seed: exactly the 3 approved terms and 3 approved reminders", () => {
  assert.deepEqual(INITIAL_TARYN_PROTECTED_TERMS.map((t) => [t.term, t.kind]), [
    ["CEO Clubhouse", "PROGRAM"],
    ["Perfect Day Business Mentorship", "PROGRAM"],
    ["PDBM", "PROGRAM"],
  ]);
  assert.deepEqual(INITIAL_TARYN_EXPORT_REMINDERS.map((r) => r.text), [
    "B-roll shows the correct person.",
    "Keep skin tone natural; avoid pale / washed appearance.",
    "Horizontal videos should fill the intended frame with no unintended black bars.",
  ]);
  for (const t of INITIAL_TARYN_PROTECTED_TERMS) assert.equal(validateProtectedTermInput(t).success, true);
  for (const r of INITIAL_TARYN_EXPORT_REMINDERS) assert.equal(validateExportReminderInput(r).success, true);
});

test("uncertain / out-of-scope terms and rejected checks are NOT seeded", () => {
  const all = JSON.stringify([INITIAL_TARYN_PROTECTED_TERMS, INITIAL_TARYN_EXPORT_REMINDERS]);
  for (const forbidden of ["Jannalee", "100 Lead Game", "Buy Line", "CEO Strong", '"Taryn"', "thumbnail", "private", "microphone|mic ", "V1", "V2", "V3"]) {
    assert.doesNotMatch(all, new RegExp(forbidden, "iu"), forbidden);
  }
});
