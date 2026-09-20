import assert from "node:assert/strict";
import test from "node:test";

import { batchLinkFromVideo, buildProductionContext, linkifyText } from "./core.ts";
import { isSafeInternalPath } from "../../utils/navigation.ts";
import { videoWorkspaceHref } from "../productivity/core.ts";

const base = { batch: null, project: null, sources: [], video: null, formatNames: [] };

test("nothing recorded -> no rows, and the block says so once", () => {
  const ctx = buildProductionContext(base);
  assert.deepEqual(ctx.rows, []);
  assert.equal(ctx.noSourceContext, true);
});

test("rows exist only for recorded facts (no empty placeholders); blanks count as absent", () => {
  const ctx = buildProductionContext({
    batch: { id: 1, label: "B", notes: "   " },
    project: { id: 1, name: "P", notes: null },
    sources: [{ id: 1, location: " ", profile: null, approxSizeLabel: "", sourceUrl: null, notes: null }],
    video: { reviewUrl: "", deliveryUrl: null, publishedUrl: "  " },
    formatNames: ["", "  "],
  });
  assert.deepEqual(ctx.rows, []);
  assert.equal(ctx.noSourceContext, true);
});

test("batch notes come from the batch and project notes from the project (never merged)", () => {
  const ctx = buildProductionContext({
    ...base,
    batch: { id: 1, label: "17SEP", notes: "Watch clip 4" },
    project: { id: 15, name: "Sept CW", notes: "Source: https://youtube.com/x" },
  });
  assert.deepEqual(ctx.rows.map((r) => [r.key, r.text]), [
    ["batch-notes", "Watch clip 4"],
    ["project-notes", "Source: https://youtube.com/x"],
  ]);
  assert.equal(ctx.noSourceContext, false);
});

test("source references, review, delivery and formats appear only when recorded", () => {
  const ctx = buildProductionContext({
    ...base,
    sources: [{ id: 3, location: "NAS", profile: "LOG", approxSizeLabel: "~800 GB", sourceUrl: "https://dropbox.com/s", notes: null }],
    video: { reviewUrl: "https://frame.io/r", deliveryUrl: null, publishedUrl: "https://youtu.be/p" },
    formatNames: ["Lecture Format", "Content Waterfall"],
  });
  assert.deepEqual(ctx.rows.map((r) => r.key), ["source", "review", "published", "formats"]);
  assert.equal(ctx.noSourceContext, false, "source media counts as source context");
  assert.deepEqual(ctx.rows.find((r) => r.key === "formats").names, ["Lecture Format", "Content Waterfall"]);
});

test("order scope (video=null) never produces review/delivery rows; there is no invented 'cut sheet' row", () => {
  const ctx = buildProductionContext({ ...base, batch: { id: 1, label: "B", notes: "cut sheet: https://notion.so/x" } });
  assert.deepEqual(ctx.rows.map((r) => r.key), ["batch-notes"]);
  for (const row of ctx.rows) assert.doesNotMatch(row.label, /cut sheet/iu);
});

test("linkify: only well-formed HTTPS URLs become links; punctuation and text are preserved", () => {
  const parts = linkifyText("Source: https://www.youtube.com/watch?v=abc. Clips (https://notion.so/p?x=1), see http://insecure.example and javascript:alert(1)");
  const links = parts.filter((p) => p.type === "link");
  assert.deepEqual(links.map((l) => l.href), ["https://www.youtube.com/watch?v=abc", "https://notion.so/p?x=1"]);
  assert.equal(parts.map((p) => p.value).join(""), "Source: https://www.youtube.com/watch?v=abc. Clips (https://notion.so/p?x=1), see http://insecure.example and javascript:alert(1)");
  assert.equal(linkifyText("https://user:pw@evil.com/x").some((p) => p.type === "link"), false);
  assert.deepEqual(linkifyText("plain"), [{ type: "text", value: "plain" }]);
});

test("video -> batch link returns to THAT video and carries the video's own origin; the value is a safe internal path", () => {
  const videoHref = videoWorkspaceHref(9, "/war-room");
  const href = batchLinkFromVideo(4, videoHref);
  assert.equal(href, `/productivity/orders/4?returnTo=${encodeURIComponent("/productivity?video=9&returnTo=%2Fwar-room")}`);
  const returnTo = new URL(href, "https://x.test").searchParams.get("returnTo");
  assert.equal(returnTo, "/productivity?video=9&returnTo=%2Fwar-room");
  assert.equal(isSafeInternalPath(returnTo), true, "the order page will honour it");
  assert.equal(isSafeInternalPath(new URL(videoHref, "https://x.test").searchParams.get("returnTo")), true);
});
