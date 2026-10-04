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
  assert.equal(videoWorkspaceHref(12, undefined), "/war-room/workspace?video=12", "no origin -> canonical War Room workspace");
});

const src = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("deep management links preserve origin while global inspection owns Sessions", () => {
  const dashboard = src("../../components/operating-reality/DashboardOperatingReality.tsx");
  const dashboardData = src("../operating-reality/data.ts");
  assert.match(dashboardData, /getExecutionSnapshot\("\/"\)/u);
  assert.match(dashboard, /EntityInspectionTrigger/u);
  assert.match(dashboard, /type: "session"/u);
  assert.match(dashboard, /type: "video"/u);
  const crm = src("../../app/crm/[id]/ClientIntelligencePanel.tsx");
  assert.match(crm, /videoWorkspaceHref\(note\.videoId, returnTo\)/u);
  assert.match(src("../../app/crm/[id]/page.tsx"), /returnTo=\{`\/crm\/\$\{client\.id\}`\}/u);
  const sessions = src("../../app/productivity/sessions/WorkSessionHistoryTable.tsx");
  assert.match(sessions, /EntityInspectionTrigger/u);
  assert.match(sessions, /type: "video"/u);
  assert.match(sessions, /type: "session"/u);
  for (const rel of ["../../components/operating-reality/DashboardOperatingReality.tsx", "../../app/crm/[id]/ClientIntelligencePanel.tsx", "../../app/productivity/sessions/WorkSessionHistoryTable.tsx"]) {
    assert.doesNotMatch(src(rel), /href=\{`\/productivity\?video=\$\{/u, `${rel} has no raw origin-less video link left`);
  }
});
