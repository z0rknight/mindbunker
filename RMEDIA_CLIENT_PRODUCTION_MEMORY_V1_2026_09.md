# Client Production Memory V1 (Wave 3, 2026-09-19 operator-local)

## 1. Source authority
GREEN. Start: HEAD = release = `production/current` = `f5f52bbb3`; no pending migrations. Product commit `b14008f`; migration head now 0051 (applied to production D1). Wave 2 PDBM referral untouched (production `/quoteavideo?ref=pdbm` still 200 with the referral line).

## 2. Archaeology
No vault/recipe/template concept exists in `src` or production tables. The word "Vault" already names the client-facing portal (`/client/[token]`), so the UI says "Production memory" and nothing in the navigation is called Vault.

## 3. Structures evaluated (and why none fit)
| Structure | Verdict |
|---|---|
| `clients.notes` / `qualification_notes` | one blob per client; empty for Taryn; holding three recipes with URLs and status here is structured facts hidden in free text |
| `projects` / `video_logs` / `production_orders` `.notes` | per-batch, job-specific (e.g. project 15 source + cut-sheet links, order 1 clip-4 tip) |
| `assets` | project-required (a recipe spans Taryn's five projects); DRAFT/READY/DELIVERED and `deliveryUrl` mean other things |
| `source_media_references`, `decisions`, `production_checklist_items`, `contentType` | raw-media pointers / signal follow-ups / fixed generic steps / no format names |

## 4. Canonical owner
The **client**. New table `client_production_memory` (migration `0051_narrow_living_tribunal.sql`, additive: one `CREATE TABLE` + two indexes, no backfill). Managed in the CRM dossier ("Production memory"); Project and Production Order pages read it in place as a collapsed "Formats for <client> (N)".

## 5. Why a new table (not a new domain)
A named, reusable, client-scoped format cannot be stored without abusing batch notes, assets or generic notes. It is one small leaf table with no workflow; it is not a DAM/wiki, has no nav entry, and never stores files (pointers only).

## 6. Evidence used
Operator's Wave 3 brief, and the "Waves de Sabado" log's summary of the Taryn Slack ("Client Success = teal, Lecture = black, white/black text, rounded corners, Content Waterfall template"). The original chat exports are no longer at their old paths and the primary Slack messages are not in the repo. No URLs, template paths or approval records exist in that evidence.

## 7–9. The three records (production, client id resolved live = 2)
| Record | Status | Stored (KNOWN FACT) | NULL / not recorded |
|---|---|---|---|
| Content Waterfall | OPERATOR_CONVENTION | use case (recurring multi-deliverable batch from an editor cut sheet); recipe: assemble listed segments in order, remove DELETE lines, delivered as several clips | approval evidence, preference, template location, reference |
| Lecture Format | CLIENT_APPROVED | approval evidence: Taryn asked to keep it "in the vault as the lecture format" (date not recorded); preference: black overall treatment, white text box with black bold text, rounded video corners | use case, recipe, template location, reference |
| Client Success Format | OBSERVED | preference: teal visual treatment, rounded video corners | use case, recipe, approval, template location, reference |

Not copied: project-15 batch URLs (job-specific). Not claimed: any client-approved template for Content Waterfall, any approval for Client Success, any typography/LUT/colour values.

## 10. Code/data changes
Schema + migration; `modules/production-memory/{config,core,data,actions,initial-taryn}`; CRM `ProductionMemoryPanel`/`Editor` (create, view, edit, delete; no modal, no history); `FormatsForClient` + `ProductionMemoryDetails` components; Project, Production Order and CRM pages wired. Statuses only OBSERVED / OPERATOR_CONVENTION / CLIENT_APPROVED / HISTORICAL (DB CHECK, nullable). `UNIQUE(client_id, name)` plus a case-insensitive friendly pre-check. `reference_video_id`: FK `ON DELETE SET NULL`; application rule = must exist, same client, real deliverable (not a batch container). One deliberate rule beyond the brief: **CLIENT_APPROVED requires an approval-evidence note** (approval truth). Production data writes: migration 0051 + exactly 3 rows.

## 11. Unknown facts left NULL
Template location ×3, approved reference (video/URL) ×3, Content Waterfall approval evidence, use case ×2, recipe ×2, preference ×1: none guessed. Human data still needed: which Premiere project is each template and where it lives; which delivered video is the approved example for Lecture and Client Success; any evidence of client approval for Client Success; the Lecture use-case wording.

## 12. Tests
28 new (`production-memory/`): additive migration (all pre-existing DDL byte-identical, no backfill), table shape, status CHECK, unique per client, FK behaviour, optional NULLs, edit/delete scoped by client, cross-client / ghost / container reference rejection, client isolation, the three Taryn fixtures without production IDs and without guessed values, operator-only (no portal/g/client file references it; reads and writes authenticate), contextual retrieval on Project and Production Order, read-only hot path, no nav entry. Targeted 28/28; full 1271/1271; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build OK; `git diff --check` clean.

## 13. Deploy
Migration 0051 applied to production D1 first (pre-checked: only 0051 pending; counts identical before/after; table empty), then Operator Worker `8260546f-b354-42ad-80f3-bd4397ab3da9`. Client Worker (`6a619197…`), Sensor, public site, PDBM referral: untouched. Rollback: Operator `6f490b8e-199b-48aa-a1b6-326b0ec74d90` (old code ignores the new table, so rolling back the Worker alone is safe); D1 pre-migration Time Travel bookmark `000002ba-0000043a-000050ec-4e85cded9e069e8fb27e77bca0746f6a`, or `DROP TABLE client_production_memory` (additive, only these 3 rows).

## 14. Functional QA
**Local/sandbox (real form + server actions, migrated local D1):** created all three through the UI; duplicate name rejected; CLIENT_APPROVED without evidence rejected; edit and delete work; Production Order and Project pages show "Formats for Taryn Dubreuil (3)" collapsed by default, 1 click opens the list, a 2nd opens a format; missing template/example render "Not recorded"; Dave's project/order/CRM show nothing. Sandbox restored to an empty table.
**Production deploy/reachability:** unauthenticated `/crm/2`, `/projects/2`, `/productivity/orders/1` → 307 to login; PDBM page 200. **Production D1 read-back:** 3 rows, client 2, right names/statuses, no references/templates, every other count unchanged.
**Production authenticated UI acceptance: NOT RUN** (no operator session; I do not type the password). Retrievability is proven from the deployed code's data and the identical local run, but the acceptance test was not performed in the production UI.

## 15. Deferred
Pre-export QA, protected vocabulary, caption validation, AI analysis, client-visible recipes, version history, and filling the NULL template/reference facts above. Production memory is shaped so a later client-aware QA wave can reference `client_production_memory` by client and name.
