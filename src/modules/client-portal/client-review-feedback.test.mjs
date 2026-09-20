// Train M2: client review / approval / delivery feedback. Presentation only:
// the canonical action (READY_FOR_REVIEW -> DONE) is untouched; these tests pin
// that the UI follows server truth, blocks double submit, and never blurs
// approval, completion and delivery.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

import { summarizeBatchProgress } from "./batch-progress.ts";
import { clientVideoStatusLabel } from "./core.ts";
import { deliveryPanelState } from "./delivery-state.ts";
import {
  INITIAL_REVIEW_STATE,
  REVIEW_ERROR_FALLBACK,
  isAcknowledged,
  reviewAcknowledgement,
  reviewAnnouncement,
  reviewReducer,
} from "./review-flow.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const load = (p) => tsImport(p, import.meta.url);
const run = (events, from = INITIAL_REVIEW_STATE) => events.reduce(reviewReducer, from);

// ── state machine ────────────────────────────────────────────────────────
test("approval: submit -> submitting is pending only; success only from submitting", () => {
  const submitting = run([{ type: "submit", target: "DONE" }]);
  assert.equal(submitting.phase, "submitting");
  assert.equal(isAcknowledged(submitting), false, "nothing is acknowledged while pending");
  assert.equal(reviewAcknowledgement(submitting), null);
  const done = run([{ type: "succeeded" }], submitting);
  assert.equal(done.phase, "approved");
  assert.deepEqual(reviewAcknowledgement(done), { title: "Approved — thank you!", detail: "Your approval is recorded." });
});

test("no optimistic approval: success without a submit, or from ready, is ignored", () => {
  assert.equal(run([{ type: "succeeded" }]).phase, "ready");
  assert.equal(run([{ type: "succeeded" }, { type: "succeeded" }]).phase, "ready");
  assert.equal(isAcknowledged(run([{ type: "succeeded" }])), false);
});

test("double submit is prevented: a second submit (or the other button) is ignored while submitting", () => {
  const a = run([{ type: "submit", target: "DONE" }, { type: "submit", target: "DONE" }]);
  assert.equal(a.phase, "submitting");
  const b = run([{ type: "submit", target: "DONE" }, { type: "submit", target: "CHANGES_REQUESTED" }]);
  assert.equal(b.target, "DONE", "the first choice wins");
  const c = run([{ type: "submit", target: "DONE" }, { type: "succeeded" }, { type: "submit", target: "CHANGES_REQUESTED" }, { type: "succeeded" }]);
  assert.equal(c.phase, "approved", "a confirmed outcome is final in the UI");
});

test("failure returns to ready with the server message; canonical state is not claimed", () => {
  const failed = run([{ type: "submit", target: "DONE" }, { type: "failed", error: "This video isn't awaiting your review." }]);
  assert.equal(failed.phase, "ready");
  assert.equal(failed.error, "This video isn't awaiting your review.");
  assert.equal(isAcknowledged(failed), false);
  assert.equal(reviewAnnouncement(failed), "Not saved. This video isn't awaiting your review.");
  assert.equal(run([{ type: "submit", target: "DONE" }, { type: "failed", error: "" }]).error, REVIEW_ERROR_FALLBACK);
  // a retry is allowed and clears the error
  assert.equal(run([{ type: "submit", target: "DONE" }], failed).error, null);
  // failure without a pending submit is ignored
  assert.equal(run([{ type: "failed", error: "x" }]).error, null);
});

test("changes requested is acknowledged separately from approval", () => {
  const s = run([{ type: "submit", target: "CHANGES_REQUESTED" }, { type: "succeeded" }]);
  assert.equal(s.phase, "changes_requested");
  assert.equal(reviewAcknowledgement(s).title, "Changes requested.");
  assert.equal(reviewAnnouncement(s), "Changes requested. Your request was sent.");
});

// ── approval / delivery truth ────────────────────────────────────────────
test("approval does not imply delivery, delivery does not imply approval", () => {
  assert.equal(clientVideoStatusLabel("DONE", false), "Completed");
  assert.equal(clientVideoStatusLabel("DONE", true), "Delivered");
  assert.equal(clientVideoStatusLabel("READY_FOR_REVIEW", true), "Review", "a delivery link does not make it approved");
  // completed, no link: the panel says so plainly and owns no link
  assert.deepEqual(deliveryPanelState({ status: "DONE", publishedUrl: null, primaryHref: null, deliveryUrl: null }), { show: true, href: null });
  // completed with a delivery link: available
  assert.deepEqual(
    deliveryPanelState({ status: "DONE", publishedUrl: null, primaryHref: "https://d.example/x", deliveryUrl: "https://d.example/x" }),
    { show: true, href: "https://d.example/x" },
  );
  // a delivery link on a video still in review shows no delivery panel and no approval
  for (const status of ["READY_FOR_REVIEW", "IN_PROGRESS", "PLANNED", "CHANGES_REQUESTED"]) {
    assert.equal(deliveryPanelState({ status, publishedUrl: null, primaryHref: "https://d.example/x", deliveryUrl: "https://d.example/x" }).show, false, status);
  }
  // a published link stays the primary action (unchanged behaviour)
  assert.equal(deliveryPanelState({ status: "DONE", publishedUrl: "https://p.example", primaryHref: "https://p.example", deliveryUrl: "https://d.example/x" }).show, false);
});

// ── batch progress ───────────────────────────────────────────────────────
test("batch composition keeps review distinct from done and updates when a child changes", () => {
  const items = [
    { id: 1, status: "DONE" }, { id: 2, status: "DONE" }, { id: 3, status: "READY_FOR_REVIEW" },
    { id: 4, status: "IN_PROGRESS" }, { id: 5, status: "PLANNED" },
  ];
  const before = summarizeBatchProgress(items);
  assert.equal(before.summary, "2 of 5 completed · 1 in review · 1 in production · 1 planned");
  assert.deepEqual(before.segments.map((s) => s.status), ["done", "done", "review", "progress", "planned"]);
  const after = summarizeBatchProgress(items.map((i) => (i.id === 3 ? { ...i, status: "DONE" } : i)));
  assert.equal(after.summary, "3 of 5 completed · 1 in production · 1 planned");
  assert.deepEqual(after.segments.map((s) => s.id), [1, 2, 3, 4, 5], "stable keys so the segment transitions in place");
  assert.equal(summarizeBatchProgress([{ id: 9, status: "CHANGES_REQUESTED" }]).segments[0].status, "progress");
  assert.equal(summarizeBatchProgress([]).total, 0);
});

// ── presentation (server-rendered, no motion involved) ───────────────────
test("ReviewActionsView: ready, submitting, approved, failed", async () => {
  const { ReviewActionsView } = await load("../../app/client/dashboard/ReviewActionsView.tsx");
  const view = (state, props = {}) => renderToStaticMarkup(createElement(ReviewActionsView, { state, onDecide: () => {}, ...props }));
  const ready = view(INITIAL_REVIEW_STATE);
  assert.match(ready, />Approve<\/button>/);
  assert.match(ready, />Request changes<\/button>/);
  assert.doesNotMatch(ready, /Approved|role="alert"|aria-busy/);
  assert.match(ready, /role="status" aria-live="polite" class="sr-only"><\/p>/, "live region exists before it speaks");
  assert.doesNotMatch(ready, /data-flash/, "no flash on first render");

  const submitting = view(run([{ type: "submit", target: "DONE" }]));
  assert.doesNotMatch(submitting, /Approved — thank you/, "never Approved while pending");
  assert.equal((submitting.match(/aria-disabled="true"/g) ?? []).length, 2, "both controls blocked");
  assert.equal((submitting.match(/aria-busy="true"/g) ?? []).length, 1, "only the pressed control is busy");
  assert.doesNotMatch(submitting, /disabled=""/, "aria-disabled, not disabled: focus is kept");

  const approved = view(run([{ type: "submit", target: "DONE" }, { type: "succeeded" }]));
  assert.match(approved, /Approved — thank you!/);
  assert.match(approved, /Your approval is recorded\./);
  assert.match(approved, /<svg class="os-ck[^"]*"[^>]*aria-hidden="true"/, "check is decorative; the text carries the state");
  assert.match(approved, />Approved\. Your approval was saved\.<\/p>/, "live region announces it");
  assert.doesNotMatch(approved, />Approve<\/button>/);
  assert.match(approved, /tabindex="-1"/, "acknowledgement can receive focus after the buttons unmount");

  const failed = view(run([{ type: "submit", target: "DONE" }, { type: "failed", error: "Video not found." }]));
  assert.match(failed, /role="alert"[^>]*>Video not found\.<\/p>/);
  assert.match(failed, />Approve<\/button>/, "buttons stay available");
  assert.doesNotMatch(failed, /aria-busy|Approved — thank you/);

  const hinted = view(INITIAL_REVIEW_STATE, { showHint: true });
  assert.match(hinted, /aria-describedby="review-hint"/);
  assert.match(hinted, /Delivery is a separate step\./);
});

test("ClientStatusBadge keeps the canonical label/classes and does not animate first render", async () => {
  const { ClientStatusBadge } = await load("../../app/client/dashboard/ClientStatusBadge.tsx");
  const html = renderToStaticMarkup(createElement(ClientStatusBadge, { status: "DONE", label: "Completed", className: "rounded-full border" }));
  assert.match(html, /class="rounded-full border os-color-fade"/);
  assert.match(html, /data-status="DONE"/);
  assert.match(html, />Completed<\/span>/);
  assert.doesNotMatch(html, /data-enter/);
});

test("DeliveryAvailability: not available vs available, no green, no first-render animation", async () => {
  const { DeliveryAvailability } = await load("../../app/client/dashboard/DeliveryAvailability.tsx");
  const none = renderToStaticMarkup(createElement(DeliveryAvailability, { href: null }));
  assert.match(none, /Not available yet/);
  assert.doesNotMatch(none, /<a /);
  const yes = renderToStaticMarkup(createElement(DeliveryAvailability, { href: "https://d.example/x", label: "Watch" }));
  assert.match(yes, /data-tone="brand"/);
  assert.match(yes, />Available<\/span>/);
  assert.match(yes, /href="https:\/\/d\.example\/x" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(yes, /data-enter|data-flash|success/);
});

test("BatchProgress renders composition text, decorative rail, and nothing for a single item", async () => {
  const { BatchProgress } = await load("../../components/os/BatchProgress.tsx");
  assert.equal(renderToStaticMarkup(createElement(BatchProgress, { items: [{ id: 1, status: "DONE" }] })), "");
  const html = renderToStaticMarkup(createElement(BatchProgress, {
    items: [{ id: 1, status: "DONE" }, { id: 2, status: "READY_FOR_REVIEW" }, { id: 3, status: "PLANNED" }],
  }));
  assert.match(html, /class="os-segbar" aria-hidden="true"/);
  assert.match(html, /data-status="review"/);
  assert.match(html, /1 of 3 completed · 1 in review · 1 planned/);
});

// ── wiring, boundary, reduced motion, a11y ───────────────────────────────
test("container waits for server truth: success dispatched only after result.success, refresh only after", () => {
  const src = read("../../app/client/dashboard/ReviewActions.tsx");
  const call = src.indexOf("await decide.run(target)");
  const guard = src.indexOf("if (!result.success)");
  const ok = src.indexOf('dispatch({ type: "succeeded" })');
  const refresh = src.indexOf("router.refresh()");
  assert.ok(call > 0 && call < guard && guard < ok && ok < refresh, "order: server answer -> success check -> succeeded -> refresh");
  assert.doesNotMatch(src.slice(0, call), /type: "succeeded"/, "no success dispatch before the server answers");
  assert.match(src, /transitionVideoStatusAsClient\(videoId, target\)/);
  assert.match(src, /if \(busy\.current \|\| state\.phase !== "ready"\) return;/);
  assert.match(src, /if \(!acknowledged && status !== "READY_FOR_REVIEW"\) return null;/);
  assert.match(src, /ackRef\.current\?\.focus/);
  assert.match(src, /clearTimeout\(refreshTimer\.current\)/);
});

test("reduced motion: check drawing, entry and segment fills degrade to static markers", () => {
  const css = read("../../app/globals.css");
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  :root,"), css.indexOf('html[data-motion="reduced"],\nhtml[data-motion="reduced"] [data-intensity]'));
  assert.match(reduced, /\.os-ck path \{ animation: none !important; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.os-enter\[data-enter\] \{ animation: none; \} \}/);
  assert.match(css, /--os-motion-scale: \.0001/);
  const seg = css.slice(css.indexOf(".os-segbar"), css.indexOf("M3: operator feedback"));
  assert.doesNotMatch(seg, /@keyframes|animation:/, "segments use transitions only; nothing loops or plays on first render");
});

test("the client surfaces use the shared pieces; no operator or payment scope leaked", () => {
  const detail = read("../../app/client/dashboard/videos/[id]/page.tsx");
  assert.match(detail, /<ReviewActions videoId=\{video\.id\} status=\{video\.status\} showHint \/>/);
  assert.match(detail, /ClientStatusBadge/);
  assert.match(detail, /deliveryPanelState/);
  const card = read("../../app/client/dashboard/VideoCard.tsx");
  assert.match(card, /holdRefreshMs=\{1400\}/);
  const dash = read("../../app/client/dashboard/page.tsx");
  assert.match(dash, /<BatchProgress items=\{activeBatch\.items\} \/>/);
  assert.match(dash, /item\.statusLabel/);
  for (const f of ["ReviewActions.tsx", "ReviewActionsView.tsx", "DeliveryAvailability.tsx", "ClientStatusBadge.tsx"]) {
    assert.doesNotMatch(read(`../../app/client/dashboard/${f}`), /payment|Payment|@\/modules\/(finance|sensor|production-memory)/, f);
  }
});
