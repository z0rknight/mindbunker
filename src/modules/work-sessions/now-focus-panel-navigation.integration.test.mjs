import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

// Sep 18 Afternoon Readiness Refinement — Fix 1: NowFocusPanel is the one
// shared "what am I working on right now" surface (Dashboard, War Room,
// Productivity all render the same component), and neither of its two
// video links (Open Workspace / Start Working) carried the caller's own
// page back as returnTo. From War Room specifically, this dropped the
// operator into Productivity's generic video-not-found fallback with no
// way back — the same lost-context pattern already fixed for Sensor/
// Production-Order navigation. Source-level checks, matching this repo's
// own established convention for verifying component wiring
// (master-qa-wave1.integration.test.mjs), since this codebase has no
// component-render test harness.

test("NowFocusPanel opens the shared entity inspection contract without rebuilding routes", () => {
  const panel = source("../../components/work-sessions/NowFocusPanel.tsx");
  assert.match(panel, /EntityInspectionTrigger/u);
  assert.match(panel, /openEntity\(\{ type: "video", id: recommended\.videoId \}\)/u);
  assert.match(panel, /entity=\{\{ type: "session", id: current\.sessionId \}\}/u);
  assert.doesNotMatch(
    panel,
    /`\/productivity\?video=/u,
    "the shared panel must not rebuild entity routes locally",
  );
});

test("canonical execution projections preserve the Dashboard and sole War Room return paths", () => {
  const dashboard = source("../../app/page.tsx");
  const dashboardData = source("../operating-reality/data.ts");
  const warRoom = source("../../app/war-room/page.tsx");
  const productivity = source("../../app/productivity/page.tsx");
  assert.match(dashboard, /getOperatingReality/u);
  assert.match(dashboardData, /getExecutionSnapshot\("\/"\)/u);
  assert.match(warRoom, /getCurrentExecution\("\/war-room"\)/u);
  assert.match(warRoom, /getExecutionRecommendation\([\s\S]{0,400}"\/war-room"\)/u);
  assert.match(productivity, /redirect/u);
  assert.doesNotMatch(productivity, /getCurrentExecution|getExecutionRecommendation/u);
});

// Fix 2: LET'S COOK's "New Production Order" form re-asked for a client
// and project the operator (or a direct link from a Project page) already
// specified — a real re-entry of a fact the system already had.
test("LET'S COOK: AssignToProductionOrderButton's empty-batch link carries the current project forward", () => {
  const button = source("../../app/projects/[id]/AssignToProductionOrderButton.tsx");
  assert.match(button, /href=\{`\/productivity\/orders\/new\?projectId=\$\{projectId\}`\}/u);
});

test("LET'S COOK: the new-order page reads ?projectId= and passes it to the ingest form", () => {
  const page = source("../../app/productivity/orders/new/page.tsx");
  const form = source("../../app/productivity/orders/new/IngestForm.tsx");
  assert.match(page, /searchParams/u);
  assert.match(page, /initialProjectId=\{initialProjectId\}/u);
  assert.match(form, /initialProjectId/u);
  // Both dependent fields (client, then project) derive from the same
  // looked-up project -- never just the project id alone, which would
  // leave the client dropdown empty and the project dropdown disabled.
  assert.match(form, /useState<number \| "">\(initialProject\?\.clientId \?\? ""\)/u);
  assert.match(form, /useState<number \| "">\(initialProject\?\.id \?\? ""\)/u);
});
