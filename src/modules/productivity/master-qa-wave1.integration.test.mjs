import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("contract and cash reconciliation use distinct domain names", () => {
  const finance = source("../finance/actions.ts");
  const cash = source("../reconciliation/actions.ts");
  const contractPage = source("../../app/finance/contracts/[id]/page.tsx");
  assert.match(finance, /export async function getContractReconciliation\(/u);
  assert.doesNotMatch(finance, /export async function getReconciliation\(/u);
  assert.match(cash, /export async function getReconciliation\(scope: CashScope\)/u);
  assert.match(contractPage, /getContractReconciliation/u);
});

// House Cleaning Wave 2 §13-14 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// LET'S COOK's ordinary child deliverables now go through the same
// canonical preparation rules Plan Video / Add Video / Add Multiple
// Videos share -- but the operational container stays its own
// explicit, order-specific insert, exactly as the mission's override
// required (Section 0: do not remove the container mechanism or push it
// through the ordinary-deliverable helper).
test("LET'S COOK shares canonical child preparation and keeps the full ingest in one atomic batch", () => {
  const ordersActions = source("../production-orders/actions.ts");
  assert.match(ordersActions, /prepareVideoLogInserts\(/u);
  assert.match(ordersActions, /isOperationalContainer:\s*true/u);
  assert.match(
    ordersActions,
    /const statements = \[\s*orderInsert,\s*containerInsert,\s*\.\.\.preparedChildren\.data\.map\(\(row\) => db\.insert\(videoLogs\)\.values\(row\)\)/u,
  );
  assert.match(ordersActions, /await db\.batch\(/u);
  // The container stays a direct, explicit db.insert -- never routed
  // through ordinary-deliverable preparation.
  const containerBlockStart = ordersActions.indexOf("isOperationalContainer: true");
  const nearbyText = ordersActions.slice(Math.max(0, containerBlockStart - 400), containerBlockStart);
  assert.match(nearbyText, /db\.insert\(videoLogs\)/u);
});

test("both canonical video creation paths derive the default kind from the owning client", () => {
  const actions = source("./actions.ts");
  const creation = source("./creation.ts");
  assert.match(creation, /videoKind: resolveVideoKindForClient\(/u);
  assert.match(actions, /prepareVideoLogInsert\(/u);
  assert.match(actions, /prepareVideoLogInserts\(/u);
});

// P0.3.1 (Tuesday Reality & Usability Patch), updated by House Cleaning
// Wave 2 §7: the direct +/- revision counter (RevisionControls,
// changeRevisionCount, and later its AddRevisionButton quick-action
// successor) is removed from every operator surface -- both mutated
// video_logs.revisionsCount with no revisions event row, a non-canonical
// write path sitting right next to the correct one (Record revision ->
// recordDetailedRevision, which inserts a revisions row AND increments
// the compat cache atomically). The card and the workspace only ever
// DISPLAY revisionsCount; the one place Productivity can change it is
// VideoEssentialsPanel's "Record revision" control.
test("revision count is read-only everywhere in Productivity except Record revision", () => {
  const card = source("../../app/productivity/VideoOperationsCard.tsx");
  const editor = source("../../app/productivity/VideoEditor.tsx");
  const essentials = source("../../app/productivity/VideoEssentialsPanel.tsx");
  const page = source("../../app/page.tsx");
  const quickActions = source("../../components/ui/ProductivityQuickActions.tsx");
  assert.doesNotMatch(card, /<RevisionControls/u);
  assert.doesNotMatch(editor, /<RevisionControls/u);
  assert.doesNotMatch(page, /AddRevisionButton/u);
  assert.doesNotMatch(quickActions, /export function AddRevisionButton/u);
  assert.match(card, /revisionCount|revisionsCount/u);
  assert.match(editor, /revisionsCount/u);
  assert.match(essentials, /recordDetailedRevision/u);
  assert.match(essentials, /Record revision/u);
});

// House Cleaning Wave 2 §3-§4, §9: the video workspace's default surface
// must not reintroduce the controls the simplification research found
// costing more attention than they returned -- Production Ticket's 8
// dropdowns, a daily Friction-logging form, Schedule call, Copy Context,
// Client follow-up, or a second manual-time entry point living inside
// every video. Those either moved to VideoAdvancedPanel's collapsed
// disclosure (Production Ticket, read-only Friction history) or were
// removed outright (the rest) -- manual time now lives only in Backfill
// / Sessions / global Quick Capture, never inline on a video.
test("Video workspace's daily surface does not reintroduce the removed Operational Memory controls", () => {
  const editor = source("../../app/productivity/VideoEditor.tsx");
  const essentials = source("../../app/productivity/VideoEssentialsPanel.tsx");
  const advanced = source("../../app/productivity/VideoAdvancedPanel.tsx");
  assert.doesNotMatch(editor, /OperationalMemoryPanel/u);
  assert.match(editor, /VideoEssentialsPanel/u);
  assert.match(editor, /VideoAdvancedPanel/u);
  assert.doesNotMatch(essentials, /PRODUCTION_STEPS/u);
  assert.doesNotMatch(essentials, /logVideoFriction/u);
  assert.doesNotMatch(essentials, /logManualWorkSession/u);
  assert.doesNotMatch(essentials, /Schedule call/u);
  assert.doesNotMatch(essentials, /Copy context/u);
  assert.match(advanced, /PRODUCTION_STEPS/u);
  assert.doesNotMatch(advanced, /logVideoFriction/u);
});

// Operator Flow round: restore visual recognition without regressing the
// truthful client/exception hierarchy. Cards remain grouped and attention-
// sorted; their covers use project -> client default -> avatar fallback.
// House Cleaning Wave 2 §15: Project Detail used to render three
// equally-prominent video-creation doors (Add Video, Add Multiple Videos,
// Plan Video) for what the mission found were overlapping intents. Add
// Video and Add Multiple Videos are now the one merged door; Plan Video
// stays reachable (it is a genuinely different intent -- future work vs.
// registering something that already exists) but as a visibly smaller,
// secondary control, not a third equal button.
test("Project Detail has one primary video-creation door, with Plan Video demoted to a secondary control", () => {
  const projectPage = source("../../app/projects/[id]/page.tsx");
  assert.doesNotMatch(projectPage, /AddVideoButton/u);
  assert.match(projectPage, /<BulkAddVideosButton/u);
  assert.match(projectPage, /<PlanVideoButton[\s\S]{0,600}compact/u);
});

test("Projects uses visual cards grouped by operational stage with client and exception context", () => {
  const projects = source("../../app/projects/page.tsx");
  assert.match(projects, /groupProjectsForOverview/u);
  assert.match(projects, /PROJECT_GROUPS/u);
  assert.match(projects, /getProjectException/u);
  assert.match(projects, /getProjectNextAction/u);
  assert.match(projects, /project\.doneVideos/u);
  assert.match(projects, /ProjectCover/u);
  assert.match(projects, /project\.coverUrl,[\s\S]*project\.clientDefaultCoverUrl,[\s\S]*project\.clientAvatarUrl/u);
  assert.doesNotMatch(projects, /2xl:grid-cols-4/u);
  assert.doesNotMatch(projects, /PROJECT #/u);
  assert.doesNotMatch(projects, /min-h-12 w-full items-center justify-center rounded-xl bg-cyan-700/u);
});

test("Dashboard and Productivity put operator capture before secondary evidence", () => {
  const dashboard = source("../../app/page.tsx");
  const productivity = source("../../app/productivity/page.tsx");
  assert.ok(dashboard.indexOf("dashboard-quick-actions") < dashboard.indexOf("dashboard-attention"));
  assert.ok(productivity.indexOf("Quick actions") < productivity.indexOf("<NeedsAttentionSection"));
  assert.doesNotMatch(dashboard, /<details open/u);
});

// House Cleaning Wave 2 §11 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// "Historical context" and "Detailed Statistics" restated ~25 of
// Dashboard's ~30 stat cards verbatim from War Room/Productivity/CRM/
// Finance/Health, by this file's own prior comments. Removed outright
// (not just left collapsed) per the mission's explicit "do not simply
// wrap them in another disclosure" instruction, along with the queries
// that only fed them -- Dashboard must not keep fetching statistics it
// no longer renders.
test("Dashboard does not restate War Room/Finance/CRM/Health statistics it already removed", () => {
  const dashboard = source("../../app/page.tsx");
  assert.doesNotMatch(dashboard, /Historical context/u);
  assert.doesNotMatch(dashboard, /Detailed Statistics/u);
  assert.doesNotMatch(dashboard, /getWarRoomData/u);
  assert.doesNotMatch(dashboard, /getFinanceSummary/u);
  assert.doesNotMatch(dashboard, /getCRMSummary/u);
  assert.doesNotMatch(dashboard, /getSalesThisMonth/u);
  assert.doesNotMatch(dashboard, /getVideoStats/u);
});

// House Cleaning Wave 2 §12: the 7-day Daily Ledger table (5 columns,
// several cells packing 2-4 sub-values) was found too dense for an
// always-open COMANDA screen. Collapsed behind the same <details>
// primitive as the BI layers below it -- not deleted, and Sessions
// (the real detailed time-history surface) is linked from the summary
// rather than duplicated.
test("War Room's Daily Ledger is collapsed by default and links to Sessions instead of duplicating it", () => {
  const warRoom = source("../../app/war-room/page.tsx");
  const ledgerStart = warRoom.indexOf("function DailyLedgerSection");
  const ledgerBody = warRoom.slice(ledgerStart, ledgerStart + 1500);
  assert.match(ledgerBody, /<details/u);
  assert.match(ledgerBody, /href="\/productivity\/sessions"/u);
});

// House Cleaning Wave 2 §18 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// Client Intelligence, Commercial Truth, and Chain of Custody -- three
// previously-separate, always-open panels -- are now one collapsed
// "Recent activity & history" disclosure, positioned after the
// Operational Dossier / Next Action (Opportunity) content an operator
// actually needs to decide what to do next. Nothing was deleted: every
// one of the three original components is still rendered, just together,
// closed by default.
test("CRM puts the operational dossier before audit evidence and folds history into one collapsed section", () => {
  const client = source("../../app/crm/[id]/page.tsx");
  const dossierPosition = client.indexOf("<ClientOperationalDossier");
  const historyPosition = client.indexOf("Recent activity");
  assert.ok(dossierPosition >= 0);
  assert.ok(historyPosition > dossierPosition);
  assert.match(client, /<details/u);
  assert.match(client, /<ClientIntelligencePanel/u);
  assert.match(client, /<ClientCommercialValuePanel/u);
  assert.match(client, /<ChainOfCustodyPanel custody=\{custody\}/u);
  // All three must sit inside the same collapsed disclosure, not three
  // separate always-open panels.
  const detailsStart = client.indexOf("<details", historyPosition - 50);
  const detailsEnd = client.indexOf("</details>", detailsStart);
  const detailsBody = client.slice(detailsStart, detailsEnd);
  assert.match(detailsBody, /<ClientIntelligencePanel/u);
  assert.match(detailsBody, /<ClientCommercialValuePanel/u);
  assert.match(detailsBody, /<ChainOfCustodyPanel/u);
});

// House Cleaning Wave 2 §19: the CRM list's per-row ClientWorkbench
// duplicated the full client page's own actions (Email, Schedule call,
// Create quote, Add follow-up, Add note, Create project) as a second,
// "faster door" action surface. Removed -- the list's job is find/
// understand/open, not a second place to manage the relationship.
test("CRM list no longer renders the row-level ClientWorkbench duplicate action surface", () => {
  const crmList = source("../../app/crm/page.tsx");
  assert.doesNotMatch(crmList, /ClientWorkbench/u);
});

test("Dashboard states the three-part intentional-work invariant and labels internal momentum", () => {
  const dashboard = source("../../app/page.tsx");
  assert.match(dashboard, /label="Client Production"/u);
  assert.match(dashboard, /label="Internal Operations"/u);
  assert.match(dashboard, /label="Total Intentional"/u);
  assert.match(dashboard, /Internal operations/u);
  assert.match(dashboard, /Client production/u);
});

// House Cleaning Wave 2 §22: Pricing Lab may carry a calculation's numbers
// into the canonical Quote flow, but it must never write a quotes row
// itself -- only navigate to CRM's own form with the numbers pre-filled.
test("Pricing Lab bridges into the canonical Quote flow without persisting a quote itself", () => {
  const pricingLab = source("../../app/pricing-lab/PricingLabClient.tsx");
  assert.doesNotMatch(pricingLab, /createQuote\(/u);
  assert.match(pricingLab, /getProductivityQuickOptions\(/u);
  assert.match(pricingLab, /router\.push\(`\/crm\/\$\{quoteClientId\}\?/u);
  assert.match(pricingLab, /createQuote: "1"/u);
});

test("QuoteCreateForm and QuotePanel accept an optional prefill without changing the DRAFT-only creation path", () => {
  const form = source("../../components/crm/QuoteCreateForm.tsx");
  const panel = source("../../app/crm/[id]/QuotePanel.tsx");
  assert.match(form, /prefill\?: QuoteCreateFormPrefill/u);
  assert.match(form, /useState\(prefill\?\.amountDollars \?\? ""\)/u);
  assert.match(panel, /autoOpen\?: boolean/u);
  assert.match(panel, /useState\(Boolean\(autoOpen\)\)/u);
});

// House Cleaning Wave 2 §23: a one-time historical reconstruction route,
// demoted out of primary sidebar navigation but never deleted.
test("All History is off the primary sidebar but still reachable from Sessions", () => {
  const sidebar = source("../../components/layout/Sidebar.tsx");
  const sessions = source("../../app/productivity/sessions/page.tsx");
  assert.doesNotMatch(sidebar, /all-history/u);
  assert.match(sessions, /href="\/all-history"/u);
});

// Hardening Round (2026-09): a ?video= value that is present but does not
// parse to a positive integer (garbled link, repeated-param array shape)
// must surface an explicit invalid state, never be treated the same as no
// video having been requested at all. A genuinely nonexistent numeric id
// was already covered by getVideoWorkspaceGroup returning null (see
// modules/productivity/core.test.mjs) -- this guard is specifically for
// the page-level parsing boundary that decides whether a value counted as
// "present" in the first place.
test("Productivity page treats a malformed ?video= value as an explicit invalid state, not a silent fallback", () => {
  const page = source("../../app/productivity/page.tsx");
  assert.match(page, /const videoParamWasSent =/u);
  assert.match(page, /const malformedVideoParam = videoParamWasSent && initialVideoId === null;/u);
  assert.match(page, /malformedVideoParam\s*\?[\s\S]{0,200}malformed and does not point/u);
  // The invalid-state section must render for EITHER a numeric id that
  // resolved to no group OR a malformed param -- not only the former.
  assert.match(
    page,
    /\(initialVideoId !== null && requestedWorkspaceGroup === null\) \|\| malformedVideoParam/u,
  );
});
