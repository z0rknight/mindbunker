import assert from "node:assert/strict";
import test from "node:test";

import {
  checkReferenceVideo,
  isDuplicateMemoryName,
  templateLocationHref,
  validateProductionMemoryInput,
} from "./core.ts";
import { PRODUCTION_MEMORY_STATUSES } from "./config.ts";

test("status vocabulary is exactly the four fact-strength values (no workflow states)", () => {
  assert.deepEqual([...PRODUCTION_MEMORY_STATUSES], ["OBSERVED", "OPERATOR_CONVENTION", "CLIENT_APPROVED", "HISTORICAL"]);
  for (const foreign of ["DRAFT", "ACTIVE", "ARCHIVED", "READY", "DELIVERED"]) {
    const result = validateProductionMemoryInput({ name: "X", status: foreign });
    assert.equal(result.success, false, `${foreign} must be rejected`);
    assert.ok(result.errors.status);
  }
});

test("only a name is required: every other fact may stay unknown (NULL, no placeholders)", () => {
  const result = validateProductionMemoryInput({ name: "  Content Waterfall  " });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    name: "Content Waterfall",
    useCase: null,
    status: null,
    approvalEvidence: null,
    preferenceNotes: null,
    recipeNotes: null,
    templateLocation: null,
    referenceVideoId: null,
    referenceUrl: null,
  });
});

test("blank strings collapse to NULL, never to a placeholder", () => {
  const result = validateProductionMemoryInput({
    name: "Lecture Format", useCase: "  ", status: "", approvalEvidence: "", preferenceNotes: " ",
    recipeNotes: "", templateLocation: "  ", referenceVideoId: "", referenceUrl: "",
  });
  assert.equal(result.success, true);
  for (const [key, value] of Object.entries(result.data)) {
    if (key !== "name") assert.equal(value, null, `${key} must be null`);
  }
});

test("name is required", () => {
  for (const name of [undefined, null, "", "   ", 5]) {
    const result = validateProductionMemoryInput({ name });
    assert.equal(result.success, false);
    assert.ok(result.errors.name);
  }
});

test("approval truth: CLIENT_APPROVED needs evidence; other statuses do not", () => {
  const bare = validateProductionMemoryInput({ name: "A", status: "CLIENT_APPROVED" });
  assert.equal(bare.success, false);
  assert.ok(bare.errors.approvalEvidence);
  const ok = validateProductionMemoryInput({ name: "A", status: "CLIENT_APPROVED", approvalEvidence: "Taryn asked to keep it" });
  assert.equal(ok.success, true);
  for (const status of ["OBSERVED", "OPERATOR_CONVENTION", "HISTORICAL"]) {
    assert.equal(validateProductionMemoryInput({ name: "A", status }).success, true);
  }
});

test("reference link must be HTTPS without credentials; template location stays free text", () => {
  for (const bad of ["http://x.com/a", "javascript:alert(1)", "ftp://x", "https://u:p@x.com", "not a url"]) {
    const result = validateProductionMemoryInput({ name: "A", referenceUrl: bad });
    assert.equal(result.success, false, bad);
    assert.ok(result.errors.referenceUrl);
  }
  assert.equal(validateProductionMemoryInput({ name: "A", referenceUrl: "https://example.com/v" }).success, true);
  // a local path is a legitimate template pointer
  const path = validateProductionMemoryInput({ name: "A", templateLocation: "/Users/x/Templates/lecture.prproj" });
  assert.equal(path.success, true);
  assert.equal(path.data.templateLocation, "/Users/x/Templates/lecture.prproj");
});

test("template location renders as a link only when it is a safe HTTPS URL", () => {
  assert.equal(templateLocationHref("https://drive.example.com/f/1"), "https://drive.example.com/f/1");
  assert.equal(templateLocationHref("/Users/x/lecture.prproj"), null);
  assert.equal(templateLocationHref("javascript:alert(1)"), null);
  assert.equal(templateLocationHref(null), null);
});

test("referenceVideoId must be a positive integer when given", () => {
  assert.equal(validateProductionMemoryInput({ name: "A", referenceVideoId: "12" }).data.referenceVideoId, 12);
  for (const bad of ["abc", "0", "-3", "1.5"]) {
    assert.equal(validateProductionMemoryInput({ name: "A", referenceVideoId: bad }).success, false, bad);
  }
});

test("reference video safety: must exist, same client, real deliverable", () => {
  assert.equal(checkReferenceVideo({ clientId: 2, isOperationalContainer: false }, 2), null);
  assert.match(checkReferenceVideo(null, 2), /doesn't exist/u);
  assert.match(checkReferenceVideo({ clientId: 9, isOperationalContainer: false }, 2), /different client/u);
  assert.match(checkReferenceVideo({ clientId: null, isOperationalContainer: false }, 2), /different client/u);
  assert.match(checkReferenceVideo({ clientId: 2, isOperationalContainer: true }, 2), /container/u);
});

test("duplicate-name pre-check is exact-ish (trim + case) and excludes the row being edited", () => {
  const rows = [{ id: 1, name: "Lecture Format" }, { id: 2, name: "Content Waterfall" }];
  assert.equal(isDuplicateMemoryName(rows, "  lecture format "), true);
  assert.equal(isDuplicateMemoryName(rows, "Client Success Format"), false);
  assert.equal(isDuplicateMemoryName(rows, "Lecture Format", 1), false);
  assert.equal(isDuplicateMemoryName(rows, "Lecture Format", 2), true);
});
