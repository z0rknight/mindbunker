# Light Pre-Export QA + Client Vocabulary V1 (Wave 4, 2026-09-19 operator-local)

## 1. Source authority
GREEN. Start: HEAD = release = `production/current` = `aa4e0f31c`, no pending migrations, Wave 3 state verified (Taryn had exactly Content Waterfall / Lecture Format / Client Success Format). Product commit `2627ca2`; migration head now 0052 (applied to production D1). Wave 2 referral and Wave 3 production memory untouched.

## 2. Migration 0052 (additive)
Exact SQL: two `CREATE TABLE` (with FK to `clients` ON DELETE CASCADE) plus their indexes; no INSERT/UPDATE/DELETE/DROP/ALTER, no backfill.
- `client_protected_terms(id, client_id, term, kind, note, created_at, updated_at)`; `kind` NULL or CHECK in (PERSON, PROGRAM, BRAND, PHRASE); `UNIQUE(client_id, term)`.
- `client_export_reminders(id, client_id, text, created_at, updated_at)`; `UNIQUE(client_id, text)`; no completion / checked / required / severity columns.
Proven: pre-existing DDL byte-identical, existing rows unchanged, both tables start empty (test + production before/after counts). D1 Time Travel bookmark before applying: `000002ba-000004a4-000050ec-3e53a01d1e85df51351d9b390e14bd0d`.

## 3. Seeded data (production, Taryn client id resolved live = 2)
Protected terms (3): **CEO Clubhouse** (PROGRAM), **Perfect Day Business Mentorship** (PROGRAM), **PDBM** (PROGRAM; note "Short form of Perfect Day Business Mentorship." — PDBM is an abbreviation of a program).
Export reminders (3): "B-roll shows the correct person." / "Keep skin tone natural; avoid pale / washed appearance." / "Horizontal videos should fill the intended frame with no unintended black bars."

## 4. Generic baseline (static product copy, not in D1)
1. Captions / text — Check spelling and doubled / extra words.
2. Clean cut — Check for leftover greeting, scuff or dead material.

## 5. Evidence rejected as uncertain / out of scope
All evidence is the "Waves de Sabado" AI summary of the Taryn Slack; the primary messages are not available.
- Not seeded: **Jannalee**, **100 Lead Game**, **Buy Line** (spelling/capitalisation rests on the AI summary only); **CEO Strong** (Bonnie's program context); **Taryn** (no error evidence, no product value).
- Not promoted (isolated or not adopted): thumbnail/text tweaks, private-review-link, tolerated mic glitch, the V1/V2/V3 approval ritual.
- Existing `production_checklist_items` (8 fixed generic steps, "Advanced / history") was NOT reused: in production it has 1 row overall and 0 QA-step rows, i.e. effectively unused.

## 6. The surface
"Before you export" card in the Video Workspace modal, directly under the Lifecycle controls. Read-only and ephemeral: no checkboxes, buttons, disabled states, storage or writes. Order: Protected terms, client reminders, Quick check (generic), Production memory (collapsed). The client is derived from the **video row** (never a caller-supplied id); a video with no client, or a client with no data, gets only the two generic lines.

## 7. Production Memory integration
Reuses the Wave 3 read-only components and reader. No video→format association exists, so formats are shown as an optional client-level reference; nothing is inferred from titles, no FK added, no memory copied into reminders.

## 8. Client isolation, portal boundary, side effects (all pinned by tests)
Other-client video shows only the generic baseline; no client portal / gateway file references the new modules or tables; every read/write authenticates; edits/deletes scoped by id AND client. The module never references status transitions, work/sensor sessions, billing, transactions or payment requests; `planVideoTransition` takes no QA input (READY_FOR_REVIEW keeps its pre-existing review-link rule; DONE unchanged); reading the view leaves videos, sessions, billing, money and CRM events byte-identical.

## 9. CRUD
CRM dossier, section "Before-you-export reminders" beside Production memory: add/edit/delete protected terms and reminders inline (case-insensitive duplicate pre-check, reminder cap 6). No modal, page, bulk editor or navigation entry.

## 10. Tests
35 new (`client-qa/`). Targeted 35/35; full 1306/1306; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build exit 0; `git diff --check` clean.

## 11. Deploy
Migration 0052 applied to production D1 first (only 0052 pending; counts identical before/after), then Operator Worker `27626530-2200-4730-999d-5d6177728fb5`. Client Worker (`6a619197…`), Sensor, public site, PDBM referral untouched. Rollback: Operator `8260546f-b354-42ad-80f3-bd4397ab3da9` (old code ignores the new tables); D1 via the Time Travel bookmark above or `DROP TABLE` of the two additive tables.
Production D1 writes: migration 0052 + exactly 6 Taryn rows (3 terms, 3 reminders), read back and verified; all other counts unchanged.

## 12. Functional QA
**Local/sandbox (real form, real server actions, real Video Workspace):** created the 6 rows through the CRM UI; duplicate (case-insensitive) and empty term rejected; edit, delete and the 6-reminder cap work. Taryn video ("Content Waterfall - Video 1"): the card shows the 3 terms, the 3 reminders, the 2 generic lines with **zero clicks**, and production formats one click away (Lecture Format detail two clicks); 0 checkboxes, 0 buttons. Dave video: only the two generic lines, no Taryn term/reminder/format. Video statuses, work sessions, billing, transactions unchanged. Sandbox restored.
**Production deploy/reachability:** unauthenticated `/productivity?video=9` and `/crm/2` → 307 to login; PDBM referral page 200; client portal login 200.
**Production authenticated UI: NOT RUN** (no operator session; I do not type the password). The production data is read back and correct, and the identical build ran locally, but the card was not viewed in the live operator UI.

## 13. Deferred
Automated text/caption/B-roll analysis, per-video format association, persistent QA state, more generic checks, the uncertain terms above (add them in the CRM dossier once their spelling is confirmed).
