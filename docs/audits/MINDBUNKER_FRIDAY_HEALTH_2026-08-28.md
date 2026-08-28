# MindBunker Friday Health Audit — 2026-08-28

## 1. EXECUTIVE HEALTH VERDICT

**YELLOW.** The live system is structurally healthy: production is reachable, auth fails closed, the D1 ledger is complete through `0034`, foreign keys are clean, the canonical Client → Project → Video → Work Session graph is coherent, and 601 tests pass. It is not GREEN because two operator-visible paths currently make claims the system cannot support:

1. the Gateway can confirm a booking while the only calendar provider is the deterministic local mock;
2. War Room labels a goal as `R$20k` while summing and formatting raw transaction amounts as USD, with no currency partition or FX conversion.

No production data was mutated. No application code, migration, config, test, or production setting was changed. This report is the only repository artifact created by the audit.

### Baseline

| Item | Observed state |
|---|---|
| Canonical repo | `/Users/emmanueldarosadillenburg/Documents/New project/mindbunker` |
| Branch / HEAD | `main` / `3f0b9d6` (`MindBunker Monday operating candidate`) |
| Worktree | 76 tracked paths modified; 83 untracked top-level/status entries; 11 untracked SQL migrations (`0024–0034`) |
| Tracked diff | 5,985 additions / 598 deletions before this report |
| Live Worker | `mindbunker`, version `9c7f0b0c-4b74-4c03-a8a7-1a78a261aa28`, 100% |
| Live route | `emmanueldarosa.com/mindbunker*` |
| D1 | `mindbunker`, `DB`, UUID `d6ada5db-1f36-4ee9-9a05-01d131abf219` |
| R2 | `mindbunker-media`, binding `MEDIA` |
| Production ledger | 35 migrations, exactly `0000_ancient_callisto.sql` through `0034_activitywatch_import.sql`; no pending migration |
| Runtime | Next.js 16.3.1, React 19.2.3, TypeScript 5.9.3, OpenNext/Cloudflare 1.20.2, Wrangler 4.124.0 |

## 2. SYSTEM MAP

The canonical operational spine remains:

`Client → Project → Video → Work Session`

Sensor sessions and passive observations are evidence beside that spine, not replacements for it. Finance, Health, and Historical remain separate fact domains.

| Domain | Canonical tables / model | Primary writers | Primary readers | Status/date/relation truth |
|---|---|---|---|---|
| Client / Lead / CRM | `clients`, `crm_events` | `modules/crm/actions.ts`, intake actions | CRM, Dashboard, Client Intelligence | `clients.status`, `archival_state`, opportunity fields; CRM event occurrence uses `created_at` |
| Project | `projects` | `modules/projects/actions.ts` | Projects, CRM, Productivity, Vault | required `client_id`; status `planned/active/review/delivered/archived`; deadline is date-only |
| Video | `video_logs`, `revisions` | `modules/productivity/actions.ts` | Productivity, Project workspace, CRM, Vault, analytics | status is authoritative; `delivered` is compatibility; `project_id/client_id`; revision rows are canonical for new events |
| Work | `work_sessions` | browser timer, approved Sensor sessions, correction actions | Dashboard, Ledger, Video, Finance reconciliation | raw Unix start/end; video is attribution authority; one global open session index |
| Sensor | `sensor_devices`, `sensor_sessions`, `device_activity_observations` | scoped bearer APIs and review actions | Sensor Inbox/detail/diagnostics | evidence remains separate; approval creates one `MAC_SENSOR_APPROVED` Work Session |
| Finance | `transactions`, settings, reserves | finance actions | Dashboard, Finance, War Room | type/currency/date are explicit; owner pay has a separate bridge |
| Owner Pay / Personal | `transactions(type=owner_pay)`, `personal_transactions` | `recordOwnerPay`, personal actions | Finance and Personal Finance | one business row ↔ one personal receipt; not income/expense |
| Debt / Subscription | `debts`, `subscriptions`, linked `transactions` | finance actions | detail histories and Finance | balances derived from payments; charges are transactions |
| Contract / billing | `commercial_contracts`, `billing_evidence`, fees, allocations, notes | finance actions | contract/reconciliation pages | tracked work, billed time, fee, invoice evidence and cash are distinct |
| FX | `fx_conversions`, `fx_manual_rates` | FX actions | FX and cash projections | movement is not revenue/expense; scope, direction and purpose explicit |
| Health | `health_logs`, `caffeine_events`, `screen_time_snapshots` | Health/Caffeine/Screen Time actions | Health, Dashboard, War Room | date-only health; occurred-at caffeine; absence often remains null |
| Historical | `hist_*`, `activitywatch_imports/events` | gated importers | All History/import | active batch + provenance; never written into native live tables |
| Quotes / intake | `quotes`, `clients`, CRM events | public intake and admin quote actions | CRM, commercial value, sales metrics | approved quote is closed value, not cash; production creation is explicit |
| Booking | `booking_settings`, `availability_windows`, `bookings` | Gateway booking actions | Gateway and CRM availability | configured enabled; provider currently always mock |
| Gateway / Vault | hashed `gateway_invitations`, client credential fields | admin issuance + public scoped actions | `/g`, token Vault, client dashboard | capability token/client session determines scope; projections strip internal fields |
| Pricing Lab | in-memory client state + pricing core | browser only | Pricing Lab | no persistence; USD configuration |
| War Room | derived read model | none | War Room | currently contains the money-unit blocker described below |

## 3. DATA TRUST

- **[NO ISSUE][CONFIRMED] Canonical hierarchy.** Production has 4 clients, 6 projects and 24 videos. The read-only mismatch query returned 0 videos whose `client_id` disagrees with the joined project's client. FK check returned zero rows.
- **[NO ISSUE][CONFIRMED] Lifecycle compatibility.** Production has 7 `DONE/delivered=1`, 15 `PLANNED/delivered=0`, 1 `IN_PROGRESS/delivered=0`, and 1 `READY_FOR_REVIEW/delivered=0`. There is no live status/delivered contradiction and no `READY_FOR_REVIEW` video without a review URL.
- **[ACCEPTABLE DEBT][LOGIC RISK] Database defaults can still manufacture a contradiction.** In `src/db/schema.ts`, `video_logs.status` defaults to `PLANNED` while legacy `delivered` defaults to true. Current application insert paths explicitly derive `delivered` from status, so production is correct; an unreviewed future raw insert could create `PLANNED + delivered=true`. Do not use `delivered` in new logic; remove it only after all legacy consumers are proven gone.
- **[NO ISSUE][CONFIRMED] Quotes and cash remain separate.** Quote helpers distinguish pipeline, approved/closed value, and realized transactions. `DONE` does not create revenue.
- **[NO ISSUE][CONFIRMED] Unknown remains unknown.** Historical coverage uses null/status rather than zero. Health and Sensor counter UIs preserve null when not measured.
- **[ACCEPTABLE DEBT][LEGACY] Revision history begins after the legacy counter.** One production video has a non-zero `revisions_count` with no `revisions` row. This is the explicitly supported legacy case; current writes create event rows and update the compatibility count together.
- **[ACCEPTABLE DEBT][LEGACY] Six approved Sensor evidence rows lack the newer direct `approved_work_session_id`, but all six match exactly one canonical Work Session through `(sensor_device_id, local_session_id)`.** There are 15 approved Sensor sessions, 15 `MAC_SENSOR_APPROVED` Work Sessions, and zero duplicate source links. This is migration-era linkage debt, not double-counting or lost work.
- **[NO ISSUE][CONFIRMED] Historical provenance.** One `hist_import_batches` row is active; native operational tables remain separate. ActivityWatch production tables are empty, which is absence of import, not zero observed work.

## 4. FINANCE HEALTH

- **[BLOCKER][CONFIRMED][LOGIC RISK] War Room has no coherent currency unit.** `src/modules/analytics/service.ts` sums every income amount into `monthlyRevenue`, all-time revenue, growth and revenue/video without currency partition or explicit conversion. `src/app/war-room/page.tsx` labels the goal `R$20k Trajectory` but calls `formatCurrency()` without a currency, so both revenue and goal render as USD. The score and pacing comparison therefore compare values of different declared meaning. Production currently has only USD transactions (2 income totaling USD 443.75, 1 expense USD 19.90, 3 owner-pay rows USD 215), so the mixed-currency branch is dormant today; the R$ goal/USD comparison is already false today.
- **[SHOULD FIX THIS WEEK][CONFIRMED][LOGIC RISK] Performance Stats repeats part of the currency and client-scope error.** `src/utils/statistics.ts` sums raw income across currencies and counts every `status=active` client, including RMEDIA/internal and any archived-surface exception. War Room already has safer external-client filtering, so the two surfaces can disagree.
- **[NO ISSUE][CONFIRMED] Core ledgers keep currencies separated.** Finance summary, personal balance and FX tests prove USD/BRL partitioning. FX is explicit derived conversion; it is not revenue or expense.
- **[NO ISSUE][CONFIRMED] Owner Pay bridge.** Production has zero orphan owner-pay business rows. Tests cover atomic pairing, idempotency, rollback, currency isolation, and personal balance semantics.
- **[NO ISSUE][CONFIRMED] Debt calculations.** Remaining balance is derived from original amount less linked payments; debt payments have edit/delete correction paths.
- **[NO ISSUE][CONFIRMED] Subscription idempotency.** The charge UI creates a per-modal idempotency key and server insertion is idempotent.
- **[SHOULD FIX THIS WEEK][CONFIRMED] Finance correction/delete UX is inconsistent and one visible action is broken.** Generic income/expense and subscription charges have no edit action, so a typo requires delete/recreate. More seriously, the main Finance table renders `DeleteTransactionButton` for Owner Pay; its receipt has an `ON DELETE RESTRICT` FK, the action does not classify the transaction first, and the client button does not handle the thrown failure. The UI offers a destructive action that cannot succeed or explain why.
- **[NO ISSUE][CONFIRMED] Opening balance, Owner Pay, FX and cash snapshots are modeled separately.** None is folded into income. Cash snapshots are observed balance evidence only.

## 5. CRM / COMMERCIAL HEALTH

- **[NO ISSUE][CONFIRMED] Lead/client identity is one row.** Conversion updates the same client record. Client deletion is dependency-guarded; archive/reactivate preserves history.
- **[NO ISSUE][CONFIRMED] Stale cached client totals are no longer used for intelligence.** `clients.total_projects` and `total_revenue` remain legacy fields, but CRM and War Room derive live project counts and currency-grouped revenue. `total_revenue` appears to have no active writer.
- **[ACCEPTABLE DEBT][LEGACY] Cached total fields remain in schema and some project actions still recompute `total_projects`.** They are compatibility debt and a future deletion candidate, not current source truth.
- **[NO ISSUE][CONFIRMED] Quote semantics.** DRAFT/SENT are pipeline, APPROVED is closed value, and only linked income is realized revenue. Production creation is idempotent and preserves the client row.
- **[NO ISSUE][CONFIRMED] Public intake is idempotent and bounded.** `/book` currently redirects to `/quoteavideo`; repeated submission reuses the idempotency key and known email rather than duplicating a lead.
- **[ACCEPTABLE DEBT][CONFIRMED] Client password reset is a non-functional production promise.** Production creates a reset token but has no email sender and still shows the generic “sent reset instructions” message. No production client currently has a portal password hash, so this is not an active incident. It must be disabled or wired before password-based Vault access is enabled.

## 6. PROJECT / VIDEO / WORK HEALTH

- **[NO ISSUE][CONFIRMED] Project requires Client.** `projects.client_id` remains NOT NULL with FK semantics. Project workspace links back to Client and into stable Video identities.
- **[NO ISSUE][CONFIRMED] Video lifecycle.** Only `DONE` counts as completed output. READY_FOR_REVIEW requires review evidence. Reopen and revision changes are audited; current edit paths preserve IDs.
- **[NO ISSUE][CONFIRMED] Work Session attribution.** Video is the sole authority; project/client derive through it. The partial unique index and atomic insert enforce at most one global open session. Production currently has zero open sessions.
- **[SHOULD FIX THIS WEEK][CONFIRMED][LOGIC RISK] Contract work-period filtering uses UTC days.** `CLIENT_OPERATIONAL_MINUTES_SQL` in `src/modules/finance/core.ts` applies `date(started_at,'unixepoch')`. A São Paulo session after 21:00 can be attributed to the next UTC date and fall into the wrong billing period. `src/modules/work-sessions/core.ts` explicitly documents the same bug and avoids this query for “today”.
- **[NO ISSUE][CONFIRMED] Video priority.** Production has no project with more than one priority video; tests cover concurrency and client isolation.
- **[SHOULD FIX THIS WEEK][CONFIRMED][LOGIC RISK] “Consistency streak” treats planned inventory as activity.** Both analytics layers add every recent `video_logs.date`, regardless of lifecycle, to the activity-date set. Planning a future video can manufacture a streak day. The metric should use an observed action (closed Work Session, lifecycle event, completed output, health entry or transaction) with a stated definition.

## 7. HEALTH / SENSOR HEALTH

- **[NO ISSUE][CONFIRMED] Health dates are date-only and editable.** Historical date validators reject impossible dates; Health corrections preserve row identity.
- **[NO ISSUE][CONFIRMED] Caffeine uses `America/Sao_Paulo` bucketing.** Tests cover the midnight boundary and distinguish no record from zero servings.
- **[NO ISSUE][CONFIRMED] Sensor evidence is not automatically canonical work.** Completed Sensor sessions enter Inbox, approval creates exactly one canonical Work Session, archive retains evidence, and passive observations remain independent.
- **[NO ISSUE][CONFIRMED] Privacy contract.** Observations store foreground metadata and aggregate input counts, not key values. Sensor APIs require hash-verified, revocable, scoped credentials and bounded bodies.
- **[ACCEPTABLE DEBT][CONFIRMED] Passive telemetry can become large.** Production has 1,618 native observations. Current Sensor review queries are bounded enough for present scale, but raw telemetry should stay windowed/paginated before it grows by orders of magnitude.

## 8. HISTORY / INTELLIGENCE HEALTH

- **[NO ISSUE][CONFIRMED] All History is a projection of an active, fingerprinted import batch.** It does not blend reconstructed facts into native Clients, Videos, Work Sessions, Finance or Sensor tables.
- **[NO ISSUE][CONFIRMED] Missing historical coverage is not rendered as zero.** The yearly summary only sums known facts and surfaces coverage counts.
- **[ACCEPTABLE DEBT][CONFIRMED] ActivityWatch single-request import duration is unproven at real export size.** The importer streams through R2 and bounds memory, but the code itself documents that a 64 MB / 100k-event confirm has not been timed against the live Worker request budget.
- **[ACCEPTABLE DEBT][LOGIC RISK] “Deep work” naming is ahead of its source.** The leverage score's concept is still derived from delivered-video output, not observed focus time. It is commented as a placeholder but can mislead future maintainers.

## 9. CLIENT / PUBLIC BOUNDARIES

- **[NO ISSUE][CONFIRMED] Admin auth fails closed.** Missing auth secrets throw, sessions are HttpOnly/Secure in production/SameSite strict/base-path scoped, login attempts are rate-limited, and unauthenticated live admin routes redirect to `/mindbunker/login`.
- **[NO ISSUE][CONFIRMED] Dev bypass is production-dead.** `/qa-login` returns 404 unless `NODE_ENV=development` and its explicit token matches.
- **[NO ISSUE][CONFIRMED] Vault isolation.** Token/session identity determines client scope; both video client and joined project client must match. Internal notes, finance, work sessions, health and CRM events are not in the client projection. Tests cover ID manipulation and cross-client isolation.
- **[NO ISSUE][CONFIRMED] Capability links.** Tokens are random and hash-only, support expiration/revocation, and invalid shapes fail before lookup. Production has 2 active and 13 expired/revoked invitations.
- **[BLOCKER][CONFIRMED][LOGIC RISK] Gateway booking is enabled in production while `getCalendarProvider()` always returns `MockCalendarProvider`.** The public flow can create a D1 row with status `confirmed`, advance the CRM opportunity and tell the visitor the call is booked, but no Google Calendar/Meet event or real external busy-time check exists. There are currently zero booking rows, so no known client has been mis-booked yet. Fail closed before the first one.
- **[NO ISSUE][CONFIRMED] Public route availability.** Live HTTP checks: login 200; admin root/projects 307 to login; `/book` 307 to `/quoteavideo`; `/quoteavideo` 200; bare `/client` 307 to client login.
- **[NO ISSUE][CONFIRMED] Secrets.** No committed production credential pattern was found. `.dev.vars` is ignored; only the safe `.dev.vars.example` placeholder is tracked.

## 10. MIGRATION / SCHEMA HEALTH

- **[NO ISSUE][CONFIRMED] Clean replay.** A fresh isolated local D1 applied all 35 migrations in order (`0000–0034`). `PRAGMA foreign_key_check` returned zero rows, `PRAGMA integrity_check` returned `ok`, and no `__new_*` table remained.
- **[NO ISSUE][CONFIRMED] Production ledger parity.** Remote read-only inspection reports the same 35 migrations and no pending migration. Production FK check is clean and temporary rebuild table count is zero.
- **[NO ISSUE][CONFIRMED] Rebuild preservation.** Existing integration tests explicitly replay and verify the data-preserving `0015` rebuild and later chains; production relational invariants agree.
- **[ACCEPTABLE DEBT][DRIFT] Migrations `0024–0034` and their snapshots are still untracked even though production has applied them.** The journal is locally updated, but Git HEAD cannot reconstruct the live production schema without the dirty worktree.

## 11. TEST HEALTH

### Validation executed

| Gate | Result |
|---|---|
| `npm test` | PASS — 601 tests, 0 failures/skips/todos |
| `npm run typecheck` | PASS |
| Scoped ESLint (`src`, `scripts`, configs) | 0 errors, 3 warnings; strict `--max-warnings=0` FAILS on unused disable comments in `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/finance/fx/FxMonthRatePanel.tsx` |
| Full `npm run lint` | Not a trustworthy gate: it traverses 4.3 GB of `_to_delete/.next-*` generated code; audit stopped it rather than treating generated snapshots as application source |
| `git diff --check` | FAIL — one extra blank line at EOF in `src/modules/client-portal/data.ts:278` |
| `npm run build` | PASS (outside filesystem sandbox because Turbopack needed local listen permission) |
| `npx opennextjs-cloudflare build` | PASS; `.open-next/worker.js` produced |
| Fresh D1 chain | PASS, 35/35 |
| Local FK / integrity | PASS / `ok` |
| Remote read-only FK / ledger | PASS / `0000–0034` |

### Coverage assessment

- **[NO ISSUE][CONFIRMED] Real behavior covered:** finance currency separation, Owner Pay atomic bridge, debt corrections, subscription idempotency, FX direction/scope, personal finance boundaries, video lifecycle/revisions/priority, Work Session concurrency/correction/attribution, Sensor approval/isolation, client portal isolation, public intake idempotency, historical dates/provenance, migration replay.
- **[SHOULD FIX THIS WEEK][CONFIRMED] Missing regression coverage:** no test asserts that production cannot use `MockCalendarProvider`; no test enforces one explicit currency/FX basis for War Room totals; no test covers São Paulo contract-period boundaries; no test prevents planned videos from creating a consistency streak; no test exercises the visible Owner Pay delete button's restricted FK behavior.
- **[ACCEPTABLE DEBT][CONFIRMED] UI/navigation coverage is mostly core/integration, not browser E2E.** Build route enumeration and live HTTP smoke are green, but authenticated click-through was not replayed during this read-only audit.

## 12. PRODUCTION DRIFT

- **[SHOULD FIX THIS WEEK][CONFIRMED][DRIFT] Live production is not represented by a recoverable Git commit.** HEAD is `3f0b9d6`; the live Worker was uploaded later and the worktree contains 76 modified plus 83 untracked status entries, including the 11 migrations production already applied. A fresh machine checking out HEAD cannot rebuild the live Worker or its schema.
- **[NO ISSUE][CONFIRMED] Cloudflare identity/config.** Authenticated account is `fotovideoportoalegre@gmail.com`, account ID `a2511426086f83bc2d6031478dbf2e69`. Worker name, route, D1 UUID and R2 binding match the canonical configuration. `workers_dev` and preview URLs remain disabled.
- **[ACCEPTABLE DEBT][DRIFT] `package.json` is modified while `package-lock.json` is untracked.** Dependency resolution is not yet checkpointed with the live source.
- **[ACCEPTABLE DEBT][DRIFT] Generated/local artifacts are not ignored.** `.round-logs/` (4.5 MB), `_to_delete/` (4.3 GB), `docs/notion-archaeology/`, `PricingLabClient.tsx.orig_check`, and a one-line moved-file tombstone remain untracked and interfere with review/lint. They are evidence to classify, not delete in this audit.

## 13. PERFORMANCE

- **[NO ISSUE][CONFIRMED] Current D1 scale is small.** War Room and Finance read whole operational tables, but the largest business tables are tens of rows. At current scale this is simpler and acceptable.
- **[ACCEPTABLE DEBT][LOGIC RISK] War Room performs whole-table reads and application-memory aggregation.** Add SQL grouping/date predicates when real transaction/video/history counts justify it, not before.
- **[NO ISSUE][CONFIRMED] All History is bounded by one active batch and four configured years.** It does not render raw ActivityWatch events.
- **[ACCEPTABLE DEBT][LOGIC RISK] Unbounded ledgers exist.** `getAllTransactions`, `getAllHealthLogs`, personal transactions and FX conversions return full history. Fine today; add pagination/month windows before hundreds/thousands of manual facts, not as speculative infrastructure now.
- **[NO ISSUE][CONFIRMED] ActivityWatch import is streaming and deduplicated.** It avoids materializing a full export in Worker memory.

## 14. LOOSE ENDS / DEAD CODE

| Classification | Evidence |
|---|---|
| **[ACCEPTABLE DEBT][DEAD CODE] DELETE CANDIDATE** | `src/components/layout/route-classification.ts` is a one-line tombstone; canonical implementation is `src/lib/route-classification.ts`. |
| **[ACCEPTABLE DEBT][DEAD CODE] DELETE CANDIDATE** | `src/app/pricing-lab/PricingLabClient.tsx.orig_check` is an untracked comparison artifact and differs from the active file. |
| **[ACCEPTABLE DEBT][DEAD CODE] ARCHIVE/DELETE CANDIDATE** | `_to_delete/` contains stale `.next` trees and temporary SQL/validation leftovers; 4.3 GB and actively harms lint. Do not delete without the separate cleanup plan. |
| **[ACCEPTABLE DEBT][LEGACY] DOCUMENT ONLY** | `.round-logs/` contains migration checkpoints, logs, backups and prior lock evidence. Keep outside release scope; archive per the existing Mac cleanup audit. |
| **[NO ISSUE][CONFIRMED] STILL ACTIVE** | ActivityWatch import route/module, Sensor APIs, `/quoteavideo`, `/book` redirect, Pricing Lab, All History import, and R2 media routes all have active callers/build routes. |
| **[ACCEPTABLE DEBT][LEGACY] UNKNOWN/HUMAN REVIEW** | `docs/notion-archaeology/` is historical evidence, not runtime; exclude from release until deliberately archived. |
| **[ACCEPTABLE DEBT][LEGACY] DOCUMENT ONLY** | `clients.total_projects`, `clients.total_revenue`, `video_logs.delivered`, and revision count cache remain compatibility fields; none should be promoted as new source truth. |
| **[ACCEPTABLE DEBT][CONFIRMED] STILL ACTIVE BUT MOCK** | Calendar provider mock is active in code; unlike ordinary test fixtures it is unsafe while public booking is enabled. This item's severity is BLOCKER in §9. |

## 15. OPERATOR FRICTION

| Workflow | Approximate interaction / context | Finding |
|---|---|---|
| Morning health | Dashboard/Health → choose date/value → save; historical rows editable in place | **[NO ISSUE][CONFIRMED]** truthful date and correction path; caffeine quick-log intentionally one tap |
| Start work | Dashboard/Productivity → Client → Project → Video → Activity → Start | **[NO ISSUE][CONFIRMED]** selection is explicit; refresh recovery and single-open guard work |
| Stop/correct work | Stop + confirmation; Ledger edit for timestamp/video/activity/note | **[NO ISSUE][CONFIRMED]** identity preserved and accidental stop guarded |
| Project → Video → back | Projects → workspace → Video with `returnTo`; explicit Client/Project links | **[NO ISSUE][CONFIRMED]** context-preserving navigation exists |
| Lead → quote → production | CRM client → quote states → explicit create production | **[NO ISSUE][CONFIRMED]** no fake intermediate records and no duplicate conversion |
| Income/expense typo | Finance row → delete confirmation → recreate every field | **[SHOULD FIX THIS WEEK][CONFIRMED]** unnecessary re-entry and audit loss |
| Owner Pay typo/delete | Finance exposes Delete → FK reject with no handled result | **[SHOULD FIX THIS WEEK][CONFIRMED]** broken visible action; correction needs an explicit paired operation |
| Subscription charge typo | Subscription history → no edit; delete is only discoverable in global Finance list | **[SHOULD FIX THIS WEEK][CONFIRMED]** context is lost and correction is non-obvious |
| Gateway booking | Visitor chooses slot → system says confirmed | **[BLOCKER][CONFIRMED]** confirmation is not backed by a real calendar event |
| End-of-day War Room | Open War Room → read pace/yield/score | **[BLOCKER][CONFIRMED]** money unit is not trustworthy |

## 16. BLOCKERS

### B1 — Public booking confirms a mock event

- **Classification:** **BLOCKER / CONFIRMED / LOGIC RISK**
- **Root cause:** `src/modules/booking/provider.ts` always returns `MockCalendarProvider`; production `booking_settings.enabled=1`; the Gateway writer persists `status=confirmed` and advances CRM.
- **Exact files/modules:** `src/modules/booking/provider.ts`, `src/modules/booking/actions.ts`, `src/modules/booking/config.ts`, `src/app/g/[token]/BookingPanel.tsx`.
- **Current behavior:** two live capability links can expose booking slots; a visitor can receive a confirmed result with no external calendar/Meet side effect or free/busy validation.
- **Expected behavior:** production must fail closed unless a real provider is configured and authorized; mock remains local/test only.
- **Smallest fix:** make provider selection environment-explicit and refuse public slot/booking operations when the selected provider is mock in production. Until Google is implemented, render booking paused and preserve the separate quote/intake path.
- **Migration required:** NO. A production settings toggle may be used as immediate operational mitigation, but that is a separate explicit data mutation.
- **Risk:** low code risk; high risk if left live.
- **Test to add:** production-mode provider selection cannot return mock/confirm; development mock remains deterministic; disabled/unavailable provider writes zero booking/CRM rows.
- **Human QA:** open a valid Gateway in production configuration and verify booking is visibly unavailable, not “confirmed”; `/quoteavideo` remains usable.

### B2 — War Room compares and formats incompatible money units

- **Classification:** **BLOCKER / CONFIRMED / LOGIC RISK**
- **Root cause:** raw `amount` sums have no currency dimension while UI hardcodes a BRL goal and uses the USD default formatter.
- **Exact files/modules:** `src/modules/analytics/service.ts`, `src/app/war-room/page.tsx`, `src/utils/statistics.ts`, `src/components/ui/PerformanceStats.tsx`.
- **Current behavior:** `R$20k` is compared with an untyped raw sum and displayed as `$20,000`; future BRL rows would be silently added to USD.
- **Expected behavior:** every money metric declares one currency or one explicit FX basis; currencies are never compared raw.
- **Smallest fix:** choose one documented War Room reporting currency, group source income by currency, and either show rows separately or convert only through the existing explicit FX resolver with provenance. Pass currency to every formatter. If no rate/coverage exists, show “not comparable”, not zero.
- **Migration required:** NO.
- **Risk:** medium because score/growth/yield consumers share the read model; no write risk.
- **Test to add:** same numeric USD+BRL inputs never sum raw; missing FX produces null/not-comparable; BRL goal renders BRL; all score inputs use the same reporting basis.
- **Human QA:** insert local USD and BRL fixture rows, inspect War Room/Performance Stats, and reconcile each number to the currency-grouped Finance ledger.

## 17. SHOULD FIX THIS WEEK

### S1 — Brazil date logic is environment-dependent and contract periods use UTC

- **Classification:** **SHOULD FIX THIS WEEK / CONFIRMED / LOGIC RISK**
- **Root cause:** `nowBrazil()` subtracts a fixed three hours and some consumers then call host-local getters; contract SQL uses UTC `date()` directly.
- **Files:** `src/utils/date.ts`, `src/modules/finance/core.ts`, `src/modules/work-sessions/core.ts`, date consumers in analytics/statistics.
- **Current behavior:** at `2026-09-01T04:00Z`, the same shifted Date reads September 1 under UTC but August 31 under a São Paulo Node process. Late-evening sessions can land in the wrong contract day.
- **Expected behavior:** one IANA-zone day-key helper (`America/Sao_Paulo`) for all operator calendar boundaries; date-only fields remain strings.
- **Smallest fix:** replace subtract-and-local-getter helpers with `Intl.DateTimeFormat(..., {timeZone})`/existing `dayKeyFor`; filter contract periods by derived Brazil day keys or correct epoch bounds.
- **Migration required:** NO.
- **Risk:** medium; touches month/day windows but no stored values.
- **Test:** UTC and São Paulo runtimes produce the same Brazil day/month; 20:59/21:00 local boundary cases; billing period inclusion.
- **Human QA:** compare Today, current month, contract hours and caffeine around midnight São Paulo.

### S2 — Live source is not recoverable from Git

- **Classification:** **SHOULD FIX THIS WEEK / CONFIRMED / DRIFT**
- **Root cause:** multiple live rounds were built from an accumulated dirty worktree after commit `3f0b9d6`.
- **Files:** all intended live source changes, migration SQL/snapshots `0024–0034`, `_journal.json`, `package-lock.json`; exclude generated/history artifacts.
- **Current behavior:** production schema and Worker are healthy, but checkout of HEAD cannot reproduce them.
- **Expected behavior:** one reviewed local checkpoint exactly represents live code/schema, with generated/local evidence excluded.
- **Smallest fix:** perform a release-scope audit, stage exact live source/migrations/tests/config, validate from the commit, and create one local checkpoint before any new feature. Do not deploy merely to create the checkpoint.
- **Migration required:** NO.
- **Risk:** medium staging risk due the large dirty tree; zero runtime risk if no deployment follows.
- **Test:** clean checkout installs from lockfile, applies `0000–0034`, passes the same 601-test/build gates, and yields no schema drift.
- **Human QA:** compare candidate route map and live feature inventory; inspect staged diff before commit.

### S3 — Money-row correction and Owner Pay deletion are unsafe/incoherent

- **Classification:** **SHOULD FIX THIS WEEK / CONFIRMED**
- **Root cause:** generic transactions lack update semantics; subscription charge correction was not added; Owner Pay is protected by a paired FK but receives the generic delete button/action.
- **Files:** `src/modules/finance/actions.ts`, `src/app/finance/DeleteTransactionButton.tsx`, `src/app/finance/page.tsx`, subscription detail/components, Owner Pay bridge tests.
- **Current behavior:** ordinary typos lose identity/history via delete/recreate; Owner Pay delete predictably rejects and the UI reports no useful error.
- **Expected behavior:** ordinary income/expense/subscription charges correct in place; Owner Pay either has an explicit atomic paired correction/reversal or no generic delete control.
- **Smallest fix:** hide/reject generic deletion by transaction type/source, return handled results, add bounded in-place correction for editable types, and keep Owner Pay bridge atomic.
- **Migration required:** NO.
- **Risk:** medium because money writes are consequential; mitigate with type-specific validation and integration tests.
- **Test:** Owner Pay generic delete is refused without throw/data change; subscription/manual transaction edit preserves ID and relation; currencies/dates remain explicit.
- **Human QA:** correct a local expense and subscription charge; attempt Owner Pay generic delete and verify an explanatory disabled/blocked path.

### S4 — Operator metrics disagree on client scope and observed activity

- **Classification:** **SHOULD FIX THIS WEEK / CONFIRMED / LOGIC RISK**
- **Root cause:** `src/utils/statistics.ts` does not reuse external-active-client scoping, and both analytics paths use any video date for consistency.
- **Files:** `src/utils/statistics.ts`, `src/modules/analytics/service.ts`, shared client/date predicates.
- **Current behavior:** RMEDIA/internal can inflate “active client” denominator; planned inventory can create streak days.
- **Expected behavior:** metrics state and share their population; streak uses observed actions, not plans.
- **Smallest fix:** centralize the already-existing external active-client predicate and define one explicit streak event set. Keep output metrics DONE-only.
- **Migration required:** NO.
- **Risk:** low; derived display only.
- **Test:** internal/Geladeira clients excluded identically; PLANNED video alone creates no streak; completed/real event does.
- **Human QA:** compare Dashboard Performance Stats and War Room using the same local fixture.

## 18. ACCEPTABLE DEBT

1. Legacy `delivered`, client cached totals and revision count remain compatibility fields but are not promoted as new truth.
2. Six migration-era Sensor approvals lack the direct FK pointer but retain an exact stable-source match.
3. One legacy revision count predates event history.
4. Whole-table reads are acceptable at current business-table scale.
5. ActivityWatch real-large-file wall time is unproven; memory architecture is bounded.
6. Client password reset must remain unused until email delivery or explicit disabling is added; production currently has zero password-enabled clients.
7. Three ESLint warning suppressions and one EOF whitespace defect should be removed in the next hygiene checkpoint.
8. Historical archaeology and prior round logs should be archived/classified, not merged into runtime code.

## 19. DO NOT TOUCH YET

- Do not rewrite Finance, CRM, Sensor or Historical into generic platforms.
- Do not backfill the six Sensor direct-link fields or the legacy revision row merely to make counts visually perfect; preserve evidence unless a separate reconciliation is approved.
- Do not delete `delivered`, cached client fields or revision count until every live consumer and rollback boundary is accounted for.
- Do not import ActivityWatch merely because production tables are empty.
- Do not add telemetry dashboards, revenue/hour, advanced BI, employee monitoring, multi-tenancy or generalized workflow engines.
- Do not delete `_to_delete`, `.round-logs`, notion archaeology or backup-like artifacts in a health patch; use the already-separated cleanup audit and explicit human approval.

## 20. RECOMMENDED NEXT PATCH

One bounded **Truth + Recovery patch**, in this order:

1. fail closed on mock Calendar booking in production;
2. make War Room/Performance Stats currency-explicit and use one reporting basis;
3. unify São Paulo day/month boundaries, including contract Work Session periods;
4. make finance corrections type-safe and remove the broken generic Owner Pay delete path;
5. correct active-client/streak populations, then checkpoint the exact live source/migrations with artifacts excluded.

No item requires a migration. Validate with focused regressions, then the current 601-test/typecheck/lint/build/OpenNext/fresh-D1 suite. Production data should remain untouched until the source checkpoint and a separate deployment gate are approved.

---

### Audit evidence summary

- Remote Cloudflare actions were strictly read-only; D1 query metadata reported `rows_written: 0` and `changed_db: false`.
- Production counts at audit time: 4 clients, 6 projects, 24 videos, 21 Work Sessions, 17 Sensor sessions, 1,618 observations, 6 business transactions, 7 personal transactions, 4 FX conversions, 4 health logs, 1 quote, 1 asset, 0 ActivityWatch events.
- No production/config/code/test/migration mutation was performed.
