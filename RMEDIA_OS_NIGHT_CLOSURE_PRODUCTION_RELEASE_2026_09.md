# RMEDIA OS — Night Closure Production Release

**Date:** 2026-09-21 · **Status:** release surfaces GREEN; one separately observed Sensor Activity console warning remains untriaged.

## Scope and source

- Operator code: `88252f6e8550de0238ff1e51245a9b2fc5852341` in canonical `mindbunker-final-convergence`; docs-only closure commit is the final release/`production/current` descendant.
- Public and recovered `/book` source: local, no-remote `rmedia-public-site` commit `1ce62599fdedf62afa45c2f8dd0879f963ae328a`. The canonical `/book` source is `book-worker/src/index.js` plus `book-worker/public/index.html` and `book-worker/wrangler.jsonc` in that commit. The deployed baseline Worker script was recovered before the present visual-only edit; booking logic, route and D1 binding are unchanged.
- Public primary accent and Operator primary accent: YouTube Red `#FF0000`; Client Portal not recoloured. `/start` accent tokens alone changed to red for Home-to-intake continuity. Semantic success/confirmed remains green, warning amber, unknown neutral/dashed and derived labelled/hatched.
- No new migration, notification table, duplicate Lead store, Client deploy or Sensor-native change.

## Gates before production

Public focused tests **23/23**. Operator focused tests **25/25**. Operator full suite **1478/1478**. Typecheck, build and diff check GREEN. ESLint **0 errors, 3 pre-existing unused-disable warnings**. Sandbox scenarios A–F passed on a fully migrated SQLite chain; row counts returned to the recorded empty baseline and FK check was clean. Contrast: `#09090b` on `#FF0000` **4.98:1**, `#0a0a0a` on `#FF0000` **4.95:1**, light red text on dark **6.57:1**, NEW text on dark red **8.51:1**.

## One deploy per affected runtime

| Runtime | Previous / rollback | Current |
|---|---|---|
| Public `late-disk-3e57` | `d4ce7afe-65f7-4870-8508-371ed1ce5691` | `e3e35906-ff1c-471b-b37c-217d94c2c7bb` |
| Separate `/book` `rmedia-book` | `55561e13-ee70-4d46-9cc5-61d7c98a6fcb` | `06bd4bd2-f275-489f-bf88-b75aee057b5d` |
| Operator `mindbunker` | `1362c77c-f19a-4603-adb6-b0d0214a3d6c` | `c87dba7e-ba59-4161-9501-24576daa3a5a` |
| Client `white-wave-1af9` | unchanged | `cf5be8f8-ae5a-426d-ac59-b59ee58620dc` |

No runtime had been deployed by the interrupted attempt. Versions were freshly queried first; only the three missing affected runtimes were then deployed, once each.

## Live public and operator QA

Home visibly uses red for the mark, CTA and links; hero text reveals once with restrained 300ms opacity/8px rise. Offscreen sections remain one-shot and zero elements had an infinite animation. `/book` uses the shared RMEDIA mark, red date selection and primary action; its ordinary keyboard-reachable `← Back to RMEDIA` anchor reached `/`, and its calendar loaded 21 available dates and visible slots. Book uses finite 8px entrance and has a reduced-motion immediate CSS branch. At 390×844 and 375×667 the pages had no document-level horizontal overflow; date choices scroll inside their strip. `/start` and `/start?ref=pdbm` displayed the existing card flow, now red; the latter retained its PDBM banner. GET views left D1 at **6 Leads / 267 events / 1 unread**. Public browser console had no errors.

Authenticated CRM exposed `All | Inbound 1`; Inbound showed the pre-existing unread event without an automatic GET ack. Dashboard, War Room, CRM/Inbound and Finance rendered the red active/brand state while green success, amber warning and neutral insufficient/unknown states remained distinguishable. The new Inbound CTA was keyboard-accessible, used black text on red and included the word/count `NEW`, not colour alone. No runtime console errors were observed on the release-specific public and Inbound checks.

**Separate finding:** a fresh load of the Operator's existing `/productivity/sensor` web page emitted reproducible React hydration error `#418` in the browser console while the page rendered and Sensor data remained visible. Its page source was not changed by this release, so causation is unproven; it prevents an unqualified “operator console has zero errors” claim. No speculative source change or second deploy was made in this closure.

## Controlled production custody E2E and cleanup

Pre-E2E production baseline: **6 clients, 267 CRM events, 1 unread intake**. That unread item was real pre-existing event `270` on Lead `8` and was neither acknowledged nor deleted.

Exactly one synthetic `/start?ref=pdbm` submission (`rmedia-night-closure-qa-20260921@example.com`, key `night-closure-20260921-pdbm-qa-001`) returned `deduped=false` and “Repeatable production.” It created canonical Lead `9`, `source=referral:pdbm`, and only the `lead_created` event `273` plus immutable `guided_intake.submitted` event `274` (`schemaVersion=1`, server-derived `REPEATABLE_PRODUCTION`, PDBM referral and original context). The global unread count moved **1 → 2**. Inbound and canonical CRM rendered its readable PDBM/volume/path projection.

Opening only QA Lead `9` through the real Inbound button appended one `system_intake.seen` event `275`, payload `{"sourceEventId":274}`, key `system-intake-seen:274`; the original intake remained unchanged. Reload showed the QA row reviewed and global unread **2 → 1**. A repeated opening left the QA ack count at exactly one. The unrelated pre-existing event `270` remained unread.

Before cleanup, counts for 17 downstream relationship families were all zero: Projects, Videos, Work Sessions, Production Orders, Quotes, Bookings, Gateway invitations, intake submissions, commercial contracts, billing evidence, transactions, payment requests, decisions, promoted captures, production memory, protected terms and export reminders. An exact guarded delete required the QA Lead identity/status/source, exactly three QA events with expected IDs/payload/key, and absence of direct downstream relations. It removed **4 rows** (Lead `9` + cascading events `273`–`275`). Post-cleanup exact QA selectors returned zero; counts returned to **6 / 267 / 1**, pre-existing unread event `270` was still present, `PRAGMA foreign_key_check` returned zero rows. Production migration head remained `0053_slow_shen.sql`; this train applied none.

## Product custody model

`CRM → Inbound` is an authenticated projection of canonical `clients` plus registered immutable intake events, not a second CRM. Manual Leads without a system-intake event are excluded. Later genuine submissions reuse the same Lead and preserve each historical intake. Notification count is the number of unseen intake **events**, persisted across reload/session. First explicit open POSTs idempotent append-only ack event(s) only for the selected Lead's unread intake IDs; ordinary GETs write nothing. Source/referral, received timestamp, payload, server-derived path and Lead identity remain traceable after Lead edits. Future machine sources can be registered in the explicit intake-event registry without changing this custody rule.
