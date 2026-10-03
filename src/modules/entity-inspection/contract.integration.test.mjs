import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = (...segments) => readFileSync(path.join(dir, ...segments), "utf8");

test("one App Shell host owns every drawer", () => {
  const shell = source("..", "..", "components", "layout", "AppShell.tsx");
  const provider = source("..", "..", "components", "entity-inspection", "EntityDrawerProvider.tsx");
  assert.equal((shell.match(/<EntityDrawerProvider>/gu) ?? []).length, 1);
  assert.equal((provider.match(/<EntityDrawerHost \/>/gu) ?? []).length, 1);
  assert.match(provider, /openEntity/u);
  assert.match(provider, /closeEntity/u);
  assert.match(provider, /ENTITY_INSPECTION_QUERY_PARAM/u);
  assert.match(provider, /window\.history\.pushState/u);
  assert.match(provider, /window\.history\.replaceState/u);
  assert.match(provider, /popstate/u);
});

test("the host is accessible, responsive and restores shell context", () => {
  const host = source("..", "..", "components", "entity-inspection", "EntityDrawerHost.tsx");
  assert.match(host, /role="dialog"/u);
  assert.match(host, /aria-modal="true"/u);
  assert.match(host, /event\.key === "Escape"/u);
  assert.match(host, /event\.key !== "Tab"/u);
  assert.match(host, /max-h-\[88dvh\]/u);
  assert.match(host, /overflow-y-auto/u);
  assert.match(host, /Open full page →/u);
});

test("inspection data composes canonical owners instead of copying their rules", () => {
  const data = source("data.ts");
  const host = source("..", "..", "components", "entity-inspection", "EntityDrawerHost.tsx");
  assert.match(data, /canonicalClientId/u);
  assert.match(data, /getRelationshipIntegrity/u);
  assert.match(data, /getExecutionSnapshot/u);
  assert.match(data, /getProjectsOverview/u);
  assert.match(data, /videoClosedSeconds/u);
  assert.match(data, /getProjectNextAction/u);
  assert.match(data, /getVideoNextAction/u);
  assert.match(host, /startWork\(/u);
  assert.match(host, /endWorkSession\(/u);
  assert.doesNotMatch(data, /insert\(|update\(|delete\(/u);
});

test("Taryn inspection resolves canonical relationship and retains alias context", () => {
  const data = source("data.ts");
  assert.match(data, /const canonicalId = canonicalClientId\(ref\.id\)/u);
  assert.match(data, /canonicalClientId\(row\.id\) === canonicalId/u);
  assert.match(data, /isOperationalAliasClientId/u);
  assert.match(data, /Operational context:/u);
});

test("high-friction surfaces use the global trigger and the old Session drawer is removed", () => {
  const surfaces = [
    ["Dashboard / War Room NOW", "..", "..", "components", "work-sessions", "NowFocusPanel.tsx"],
    ["War Room", "..", "..", "app", "war-room", "restaurant", "WarRoomRestaurantStage.tsx"],
    ["Projects", "..", "..", "app", "projects", "page.tsx"],
    ["CRM", "..", "..", "app", "crm", "page.tsx"],
    ["Sessions timeline", "..", "..", "app", "productivity", "sessions", "SessionTimeline.tsx"],
    ["Sessions table", "..", "..", "app", "productivity", "sessions", "WorkSessionHistoryTable.tsx"],
  ];
  for (const [label, ...segments] of surfaces) {
    assert.match(source(...segments), /EntityInspection|openEntity/u, label);
  }
  assert.equal(
    existsSync(path.join(dir, "..", "..", "app", "productivity", "sessions", "SessionInspectorPanel.tsx")),
    false,
  );
});

test("Productivity route remains present and its canonical execution contract is unchanged", () => {
  const page = source("..", "..", "app", "productivity", "page.tsx");
  assert.match(page, /getCurrentExecution/u);
  assert.match(page, /getExecutionRecommendation/u);
  assert.match(page, /ExecutionQueueSection/u);
});
