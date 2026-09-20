import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { originPathFrom, isSafeInternalPath } from "../../utils/navigation.ts";
import { videoWorkspaceHref } from "./core.ts";

// Backlog closure train: the third navigation root pattern -- inspection /
// summary surfaces (Dashboard, CRM client notes, Sessions) that open the Video
// Workspace used to drop where the operator was, so closing it landed on the
// generic default instead of the exact view (e.g. a Sessions week + filters).

test("origin path keeps the exact view, filters included", () => {
  assert.equal(originPathFrom("/productivity/sessions", "view=week&date=2026-09-14&client=2"), "/productivity/sessions?view=week&date=2026-09-14&client=2");
  assert.equal(originPathFrom("/productivity/sessions", ""), "/productivity/sessions");
});

test("an unsafe or oversized origin is dropped (the workspace falls back to its default), never trusted", () => {
  assert.equal(originPathFrom("//evil.com", ""), undefined);
  assert.equal(originPathFrom("/x", "u=https://evil.com"), undefined);
  assert.equal(originPathFrom("/x", "a=" + "b".repeat(400)), undefined);
});

test("the resulting video link round-trips through the existing returnTo gate", () => {
  const origin = originPathFrom("/productivity/sessions", "view=week&date=2026-09-14");
  const href = videoWorkspaceHref(12, origin);
  const returnTo = new URL(href, "https://x.test").searchParams.get("returnTo");
  assert.equal(returnTo, origin);
  assert.equal(isSafeInternalPath(returnTo), true);
  assert.equal(videoWorkspaceHref(12, undefined), "/productivity?video=12", "no origin -> unchanged default link");
});

const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the four inspection surfaces now build their video links with an origin", () => {
  const dashboard = src("../../app/page.tsx");
  assert.match(dashboard, /videoWorkspaceHref\(target\.videoId, "\/"\)/u);
  assert.match(dashboard, /videoWorkspaceHref\(first\.videoId, "\/"\)/u);
  const crm = src("../../app/crm/[id]/ClientIntelligencePanel.tsx");
  assert.match(crm, /videoWorkspaceHref\(note\.videoId, returnTo\)/u);
  assert.match(src("../../app/crm/[id]/page.tsx"), /returnTo=\{`\/crm\/\$\{client\.id\}`\}/u);
  for (const rel of ["../../app/productivity/sessions/SessionInspectorPanel.tsx", "../../app/productivity/sessions/WorkSessionHistoryTable.tsx"]) {
    const text = src(rel);
    assert.match(text, /useCurrentOrigin\(\)/u, rel);
    assert.match(text, /videoWorkspaceHref\(session\.videoId, origin\)/u, rel);
  }
  for (const rel of ["../../app/page.tsx", "../../app/crm/[id]/ClientIntelligencePanel.tsx", "../../app/productivity/sessions/SessionInspectorPanel.tsx", "../../app/productivity/sessions/WorkSessionHistoryTable.tsx"]) {
    assert.doesNotMatch(src(rel), /href=\{`\/productivity\?video=\$\{/u, `${rel} has no raw origin-less video link left`);
  }
});
