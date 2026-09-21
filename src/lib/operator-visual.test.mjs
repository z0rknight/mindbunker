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

test("quick actions and attention are neutral surfaces while severity remains visible", () => {
  const page = source("../app/page.tsx");
  const actions = source("../components/ui/QuickActions.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /border-l-\[3px\] bg-zinc-900\/60/);
  assert.match(page, /border-l-red-600/);
  assert.match(page, /border-l-amber-500/);
  assert.equal((actions.match(/className="operator-command"/g) ?? []).length, 6);
  assert.match(css, /\.operator-command-primary\s*\{[^}]*inset 3px 0 #ff0000/s);
  assert.doesNotMatch(css, /\.operator-command\s*\{[^}]*background:\s*#ff0000/s);
});

test("active navigation retains aria-current with a narrow red edge", () => {
  const sidebar = source("../components/layout/Sidebar.tsx");
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(sidebar, /border-l-2 border-l-red-600 bg-zinc-900/);
  assert.doesNotMatch(sidebar, /bg-violet-600\/20/);
});
