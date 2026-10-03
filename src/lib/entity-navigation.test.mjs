import assert from "node:assert/strict";
import test from "node:test";
import {
  entityFullPageHref,
  entityInspectionHref,
  inspectableEntityFromHref,
  parseEntityReference,
  serializeEntityReference,
} from "./entity-navigation.ts";

test("entity references round-trip only for the four supported types", () => {
  for (const type of ["client", "project", "video", "session"]) {
    const ref = { type, id: 42 };
    assert.equal(serializeEntityReference(ref), `${type}:42`);
    assert.deepEqual(parseEntityReference(`${type}:42`), ref);
  }
  assert.equal(parseEntityReference("invoice:42"), null);
  assert.equal(parseEntityReference("video:0"), null);
  assert.equal(parseEntityReference("video:not-a-number"), null);
});

test("inspection href preserves surface state and adds one centralized parameter", () => {
  assert.equal(
    entityInspectionHref({ type: "project", id: 9 }, "/projects?client=2&sort=recent#active"),
    "/projects?client=2&sort=recent&inspect=project%3A9#active",
  );
});

test("full page destinations remain separate from inspection state", () => {
  assert.equal(entityFullPageHref({ type: "client", id: 2 }), "/crm/2");
  assert.equal(entityFullPageHref({ type: "project", id: 7 }), "/projects/7");
  assert.equal(entityFullPageHref({ type: "video", id: 11 }), "/productivity?video=11");
  assert.equal(entityFullPageHref({ type: "session", id: 13 }), "/productivity/sessions?view=table#session-13");
});

test("canonical management hrefs can be promoted to inspection references", () => {
  assert.deepEqual(inspectableEntityFromHref("/crm/2"), { type: "client", id: 2 });
  assert.deepEqual(inspectableEntityFromHref("/projects/7"), { type: "project", id: 7 });
  assert.deepEqual(inspectableEntityFromHref("/productivity?video=11"), { type: "video", id: 11 });
  assert.deepEqual(inspectableEntityFromHref("/productivity/sessions?view=table#session-13"), { type: "session", id: 13 });
  assert.equal(inspectableEntityFromHref("https://example.com"), null);
});
