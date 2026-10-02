import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("client reality scopes reconciliation overrides through the client's contracts", async () => {
  const source = await readFile(new URL("./data.ts", import.meta.url), "utf8");
  const query = source.match(/SELECT rn\.contract_id,rn\.note[\s\S]*?\.bind\(clientId, start, end\)/u)?.[0] ?? "";

  assert.match(query, /JOIN commercial_contracts cc ON cc\.id=rn\.contract_id/u);
  assert.match(query, /WHERE cc\.client_id=\?1 AND rn\.date>=\?2 AND rn\.date<\?3/u);
});
