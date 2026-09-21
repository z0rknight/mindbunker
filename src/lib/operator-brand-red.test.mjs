import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const inbound = fs.readFileSync(path.join(root, "src/app/crm/inbound/page.tsx"), "utf8");

test("operator brand aliases converge on exact YouTube Red while client palette remains bounded", () => {
  assert.match(css, /body\[data-intensity="operator"\][\s\S]*--color-violet-600: #ff0000/);
  assert.match(css, /body\[data-intensity="operator"\][\s\S]*--color-cyan-600: #ff0000/);
  assert.match(css, /--os-brand: #ff0000/);
  assert.match(css, /:is\(\.bg-violet-600, \.bg-cyan-600, \.bg-red-600\)\.text-white[\s\S]*color: #09090b/);
  assert.match(css, /\[data-intensity="client"\][\s\S]*--color-violet-600: #7c3aed/);
  assert.match(css, /--os-success: #3dd68c/);
  assert.match(css, /--os-warning: #f2b33d/);
  assert.match(css, /data-source="derived"/);
  assert.match(css, /data-source="unknown"/);
});

test("Inbound NEW state is not colour-only and exposes an accessible count", () => {
  assert.match(inbound, /NEW · \{group\.unreadCount\}/);
  assert.match(inbound, /aria-label=\{`\$\{unreadEventCount\} unread system intake events`\}/);
  assert.match(inbound, /Open canonical Lead/);
});
