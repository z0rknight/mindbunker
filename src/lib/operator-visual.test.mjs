import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard's three action triggers use one neutral command grammar with one priority signal", () => {
  const actions = source("../components/ui/ProductivityQuickActions.tsx");
  assert.match(actions, /NewWorkButton[\s\S]*?className="operator-command operator-command-primary"/);
  assert.match(actions, /StartWorkButton[\s\S]*?className="operator-command"/);
  assert.match(actions, /FinishedVideoButton[\s\S]*?className="operator-command"/);
  assert.equal((actions.match(/className="operator-command operator-command-primary"/g) ?? []).length, 1);
});

test("Dashboard reality cards stay neutral while factual signal severity remains visible", () => {
  const dashboard = source("../components/operating-reality/DashboardOperatingReality.tsx");
  const css = source("../app/globals.css");
  assert.match(dashboard, /bg-zinc-900\/35/);
  assert.match(dashboard, /signal\.severity === "ACTION"[\s\S]*border-red-800\/50/);
  assert.match(dashboard, /signal\.severity === "WATCH"[\s\S]*border-amber-800\/50/);
  assert.doesNotMatch(dashboard, /StartWorkButton|FinishedVideoButton|QuickActions/u);
  assert.match(css, /\.operator-command-primary\s*\{[^}]*inset 3px 0 #ff0000/s);
  assert.doesNotMatch(css, /\.operator-command\s*\{[^}]*background:\s*#ff0000/s);
});

test("active navigation retains aria-current with a narrow red edge", () => {
  const sidebar = source("../components/layout/Sidebar.tsx");
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(sidebar, /border-l-2 border-l-red-600 bg-zinc-900/);
  assert.doesNotMatch(sidebar, /bg-violet-600\/20/);
});
