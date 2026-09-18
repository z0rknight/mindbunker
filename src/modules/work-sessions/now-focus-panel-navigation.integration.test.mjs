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

test("NowFocusPanel: both video links use the canonical videoWorkspaceHref helper, never a raw template string", () => {
  const panel = source("../../components/work-sessions/NowFocusPanel.tsx");
  assert.match(panel, /import \{ videoWorkspaceHref \} from "@\/modules\/productivity\/core"/u);
  assert.doesNotMatch(
    panel,
    /href=\{`\/productivity\?video=\$\{openSession\.videoId\}`\}/u,
    "the active-session link must route through videoWorkspaceHref(id, returnTo), not a bare template string that can never carry a return path",
  );
  assert.doesNotMatch(
    panel,
    /router\.push\(`\/productivity\?video=\$\{recommended\.id\}`\)/u,
    "the Start Working redirect must route through videoWorkspaceHref(id, returnTo) too",
  );
  assert.match(panel, /videoWorkspaceHref\(openSession\.videoId, returnTo\)/u);
  assert.match(panel, /videoWorkspaceHref\(recommended\.id, returnTo\)/u);
});

test("NowFocusPanel: all three real callers (Dashboard, War Room, Productivity) pass their own returnTo", () => {
  const dashboard = source("../../app/HomeTrackingPanel.tsx");
  const warRoom = source("../../app/war-room/page.tsx");
  const productivity = source("../../app/productivity/page.tsx");
  assert.match(dashboard, /<NowFocusPanel[\s\S]{0,300}returnTo="\/"/u);
  assert.match(warRoom, /<NowFocusPanel[\s\S]{0,300}returnTo="\/war-room"/u);
  assert.match(productivity, /<NowFocusPanel[\s\S]{0,300}returnTo="\/productivity"/u);
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
