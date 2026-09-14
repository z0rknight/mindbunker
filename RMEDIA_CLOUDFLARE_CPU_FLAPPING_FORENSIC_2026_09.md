# RMEDIA OS — P0 Platform Limit Forensic
## Cloudflare CPU Flapping — Proving the Effective Limit

**Mode:** Forensic observation only. No code change, no deploy, no D1 mutation, no Taryn work, no Spatial UI work.

---

## 1. Executive Verdict

**UPDATE, post-report: Emmanuel confirmed via the Cloudflare dashboard that this account is on the Workers Free plan.** This resolves §3 definitively and changes the classification below from Branch B to **Branch A — root cause PROVEN.**

Every single failure captured across this investigation — 14+ occurrences, spanning three separate observation sessions over several hours, across **four different routes** (Sensor Catalog, War Room, Productivity, and the original incident's own samples) — showed the **exact same signature**: `outcome: exceededCpu`, `cpuTime: 10` (milliseconds), never any other value. That value is not a coincidence or a measurement artifact — it is the Workers Free plan's documented 10ms-per-invocation CPU limit, applied exactly as configured, every time it triggers.

The routine successes at 200–605ms (20×–60× over that limit) are **not** evidence against Free — they are Cloudflare's own documented "runtime flexibility" tolerance in practice, and empirically it is far more generous and far less predictable than the phrase suggests: many requests needing hundreds of milliseconds of CPU are simply let through, while others needing only single-digit-to-tens of milliseconds are killed at precisely the 10ms mark. The account's plan is the single, confirmed root cause; the *inconsistency* itself is just how Cloudflare's Free-tier enforcement behaves under this tolerance mechanism, not a separate mystery to solve.

**No application code defect was found**, and none was needed to explain the incident — every route audited (Sensor auth path, Sensor catalog handler, War Room's data-fetching) does bounded, reasonable work for the actual data volume in this database. War Room is the heaviest route tested and fails most often in absolute terms, but it is not pathological — it simply has the least CPU headroom to lose before crossing the 10ms ceiling.

**Confidence: PROVEN.** **Recommended branch: A — upgrade to Workers Paid.** No architecture change, no route optimization, no code change is warranted or recommended to chase a <10ms budget.

---

## 2. Current Worker / Account / Config

Verified at the start of this wave (2026-09-14T15:20:55Z) and re-confirmed at the end:

| Fact | Value |
|---|---|
| Operator Worker version | `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b`, 100% traffic — unchanged throughout |
| `production/current` | `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` — unchanged |
| D1 migration head | `0049_certain_frog_thor.sql` — no pending migrations |
| Account | `a2511426086f83bc2d6031478dbf2e69` |
| Zone `emmanueldarosa.com` | Confirmed on the **same account** (`account.id` matches exactly) |
| Route table (`zones/{id}/workers/routes`) | `emmanueldarosa.com/mindbunker*` → script `mindbunker`. Confirmed directly, no dispatch namespace, no service binding, no alternate Worker anywhere in the chain |
| All scripts on this account | `late-disk-3e57`, `mindbunker`, `rmedia-book`, `tiny-truth-4730`, `white-wave-1af9` — all report `usage_model: "standard"` (this field is a legacy artifact in current Cloudflare pricing and does **not** distinguish Free vs. Paid — confirmed by its uniform value across every script regardless of role) |
| `wrangler.jsonc` | No `limits` block, no `account_id` override, single flat config, single environment, no `env` blocks |
| Cron triggers / Queues / Durable Objects / scheduled handlers | **None found** anywhere in this repo |

**CURRENT_WINDOW at start of wave: HEALTHY** (22+ minutes unbroken success immediately prior). **By the end of this wave, the window had flapped again** — see §4.

---

## 3. Workers Plan Evidence

**WORKERS PLAN: FREE — confirmed by Emmanuel directly via the Cloudflare dashboard**, after this session's own attempts were blocked: this session's OAuth token has no billing-read scope — `GET /accounts/{id}/subscriptions` returns `Authentication error` (code 10000) consistently, and the token's own scope list (`user:read`, `account:read`, `workers:write`, etc.) confirms no billing/subscription scope was ever granted. That was a hard capability limit on this session, not a retry-able gap — the dashboard check was always the correct next step, and it is now done.

This confirmation resolves the ambiguity the rest of this report was written under: the exact, invariant `cpuTime: 10` failure signature (§5–§6) is the Workers Free plan's documented 10ms limit, applied as designed. The 200–605ms successes are not evidence against Free — see the updated §1 for why.

**One relevant, if indirect, data point:** the zone's *website* plan (`Free Website`) was confirmed via `GET /zones?name=emmanueldarosa.com` — but per explicit instruction and Cloudflare's own architecture, **this is a completely separate subscription from the Workers compute plan** and carries no information about the Worker's CPU-time allowance. Noted only to rule it out as a source of confusion, not as evidence of the Workers plan itself.

---

## 4. Timeline (spanning ~4 hours of intermittent observation, with a dense final 50-minute window)

Built from Cloudflare Analytics (`workersInvocationsAdaptive`, minute-granularity) cross-verified against direct `wrangler tail` captures where available:

| UTC window | Sensor outcome | State |
|---|---|---|
| 14:08–14:36 | success | HEALTHY (28 min) |
| **14:37:55–14:56:54** | **exceededResources, every minute** | **FAILING (19 min, unbroken)** |
| **14:57:56–15:21:55** | success, every minute | **HEALTHY (24 min, unbroken)** |
| 15:23:24–15:24:22 | mixed — sensor OK throughout, but **War Room fails 4 times in ~57 seconds** while root/CRM succeed | **MIXED — route-dependent, sub-minute granularity** |
| 15:24:56 onward | success | HEALTHY again |

**Transitions are not periodic, not obviously quota-window-aligned in a clean way, and not idle/wake-aligned** (the Sensor's own ~60s cadence never varied; failures and successes both occur at the same `:5x` second mark every time, ruling out any client-side timing explanation). The clearest new finding this wave: **the mixed window (15:23–15:24) shows sub-minute-scale route-dependent flapping**, which a pure 20-minute-scale account-wide toggle does not explain on its own — see §5 and §15.

---

## 5. Sensor Success/Failure CPU Distribution

From all directly-tail-captured Sensor Catalog events across this investigation (17 total, deduplicated):

| | n | min | median | p90 | max |
|---|---|---|---|---|---|
| **Healthy (`ok`)** | 10 | 8ms | 17ms | 39ms | 39ms |
| **Failed (`exceededCpu`)** | 7 | 10ms | 10ms | 10ms | 10ms |

**Every single failure is exactly 10ms — zero variance across 7 independent occurrences spanning hours.** Healthy requests never approach 10ms at the low end (8ms) and never exceed 39ms at the observed high end. This means: on a request that is allowed to run normally, the Sensor Catalog route needs on the order of 10–40ms of real CPU — **already brushing directly against a literal 10ms ceiling even when healthy**. This route is inherently borderline for a 10ms budget; it is comfortably clear of a Paid-tier budget (30,000ms default).

---

## 6. Control-Route Comparison — SENSOR ONLY or WORKER-WIDE?

**Verdict: WORKER-WIDE, not sensor-only.** Directly proven this wave:

| Route | Samples | Outcomes | CPU range (ok) |
|---|---|---|---|
| `/mindbunker` (root) | 4 | 4/4 ok | 207–268ms |
| `/mindbunker/productivity` | 5 | 4 ok, **1 exceededCpu@10ms** | 32–564ms |
| `/mindbunker/projects` | 2 | 2/2 ok | 52–605ms |
| `/mindbunker/crm` | 3 | 3/3 ok | 36–351ms |
| `/mindbunker/war-room` | 7 | 2 ok (early), **then 4 consecutive exceededCpu@10ms**, then 1 ok | 23–62ms (ok) |
| `/mindbunker/api/sensor/v1/observations` | 2 | 2/2 ok | 7–11ms |
| `/mindbunker/api/sensor/v1/catalog` | 17 | 10 ok, 7 exceededCpu@10ms | 8–39ms (ok) |

Two different routes (`productivity`, `war-room`) were directly caught failing with the identical `exceededCpu`/`cpuTime:10` signature as the Sensor route, during the same investigation. **This rules out any Sensor-specific cause** (its auth path, its specific headers, its specific caller) as the root mechanism — whatever is happening is a property of the Worker/account, expressed differently depending on how much CPU each specific request happens to need.

**The starkest single data point:** at `15:23:24Z`, `/mindbunker` succeeded using 207ms and `/mindbunker/crm` succeeded using 351ms — both comfortably clear of 10ms. One second later, at `15:23:25Z`, `/mindbunker/war-room` was killed at exactly 10ms. Same Worker. Same version. Same account. One second apart.

---

## 7. Sensor Cadence / Retry Findings

**No retry storm.** Verified two independent ways:

1. Every directly-tail-captured Sensor Catalog request lands once, at the `:5x`-seconds-past-the-minute mark, one per minute — never two in the same minute in any raw capture.
2. The Cloudflare Analytics API occasionally reports `sum.requests: 10` or `sum.requests: 11` in a single one-second bucket (seen at `12:26:55`, `13:41:55`, `13:51:55`, `14:30:55`, `14:42:55`, `15:15:55`). **This was cross-checked directly against raw `wrangler tail` output for the exact same timestamps** (e.g. `13:41:55`, which the Analytics API reported as `exceededResources 10`) — the raw tail capture shows exactly **one** real request at that timestamp, not ten. **Conclusion: the "10-count" bucket values are an artifact of Cloudflare's adaptive-sampling extrapolation in the low-traffic Analytics API, not real duplicate/retried requests.** This is stated as a finding, not an assumption — it is directly falsifiable and was falsified against ground-truth tail data.

Polling cadence: confirmed steady ~60 seconds, no drift, no acceleration after a failure (a failed minute is followed by the next attempt roughly 60s later, same as a successful one — the Sensor does not appear to retry immediately on failure).

---

## 8. Sensor Instance Count

**EXPECTED SENSOR CLIENTS:** 1 (a single operator, single Mac).
**OBSERVED DISTINCT CLIENT/DEVICE IDENTITIES:** 2 registered in `sensor_devices` — but only 1 is active.

| id | name | last_seen_at |
|---|---|---|
| 1 | Emmanuel Mac Sensor Production | 2026-09-14T15:21:55 (actively polling, matches live cadence) |
| 2 | Emmanuel's Mac | `null` — never successfully authenticated |

Device 2 has never completed an authenticated request (its `last_seen_at`, which is unconditionally updated on every successful `authenticateSensorRequest` call, is null). It is not contributing to current traffic or to the observed CPU pattern. Not touched this wave (out of scope — data-only findings, no mutation).

---

## 9. Auth-Path Audit (`authenticateSensorRequest` and its imports)

Read-only source inspection, `src/modules/sensor/server.ts` and `src/modules/sensor/core.ts`:

| Step | Classification | Notes |
|---|---|---|
| `parseSensorToken` (regex match on a short string) | TRIVIAL | Simple bounded regex, no backtracking risk (anchored, fixed-length patterns) |
| `hashSensorToken` → `crypto.subtle.digest("SHA-256", ...)` | TRIVIAL in steady state; **POTENTIALLY MATERIAL on a cold isolate** | Single-round SHA-256 over a short token — not PBKDF2, not iterated. WebCrypto subsystem initialization on a Worker's first crypto call in a fresh isolate is a plausible, real one-time cost; steady-state cost is negligible |
| DB SELECT (`sensor_devices` by publicId+tokenHash) | TRIVIAL (D1 wait, not CPU) | Indexed lookup, single row |
| DB UPDATE (`lastSeenAt`) | TRIVIAL (D1 wait, not CPU) | Single-row update by primary key |

**No expensive iterated hashing, no synchronous loops, no large in-memory structure built per request.** This path was already inspected in the original incident and is re-confirmed clean this wave.

---

## 10. Catalog-Path Audit

`src/app/api/sensor/v1/catalog/route.ts`, stage by stage:

| Stage | Work | Classification |
|---|---|---|
| AUTH | see §9 | TRIVIAL–POTENTIALLY MATERIAL (cold-start only) |
| READS | 3 parallel D1 queries, each with an explicit `.limit()` (100/200/500) | TRIVIAL at current data volume (see §11) |
| TRANSFORMS | 3 `.map()` calls over already-small result arrays | TRIVIAL |
| SORTS / FILTERS | Done entirely in SQL (`orderBy`, `where`) — **no client-side sort or filter** | TRIVIAL |
| SERIALIZATION | `Response.json(...)` over a small object | TRIVIAL at current data volume |
| RESPONSE | One header set | TRIVIAL |

**No repeated scans, no nested loops, no large object spreads, no client-side date formatting, no client-side hashing beyond the one auth SHA-256.** This route was already the subject of a full line-by-line audit during the original incident and remains clean on re-inspection. **Module-scope cost is the only material candidate found** — see §12.

---

## 11. Data-Size Sensitivity

Read-only counts, current production D1:

| Table | Rows | Route's own `.limit()` | Headroom |
|---|---|---|---|
| `clients` (non-Geladeira) | 5 (of 5 total) | 100 | 20× under limit |
| `projects` (non-archived, non-Geladeira client) | ~9 | 200 | 22× under limit |
| `video_logs` (via non-archived project join) | ≤66 (of 66 total video_logs in the whole DB) | 500 | 7.6× under limit |

**The catalog route is nowhere near its own explicit bounds today.** It scales with *current non-archived* rows, not full historical rows (archived projects/Geladeira clients are excluded by the query's own `WHERE` clause), and every dimension has a hard `.limit()` ceiling regardless. **It will not become "progressively worse over time"** in an unbounded way — worst case, it eventually saturates at 500 videos / 200 projects / 100 clients and stays there. At the *current* scale, this stage of the request is trivially cheap; the CPU cost of a healthy request (8–39ms) is not plausibly explained by this stage alone.

---

## 12. Cold/Warm Findings

**No reliable Cloudflare-exposed cold-start marker was found** — `wrangler tail`'s JSON output does not include an explicit `coldStart` boolean or isolate-age field in this account's tier. Per instruction, this is reported as **UNKNOWN**, not invented.

**Indirect evidence, however, is suggestive:** `src/db/index.ts` does `import * as schema from "./schema"`, and `schema.ts` is **2,793 lines, defining 58 tables and 110 indexes**. Every route that touches the database (which is nearly all of them, including the Sensor Catalog) pulls in this entire module graph. Building 58 Drizzle `sqliteTable()` definitions with their column/index/foreign-key metadata is real, non-trivial JS object construction — paid once per fresh isolate, reused for free on every subsequent request to that same warm isolate. This is a **plausible, concrete candidate for why a request's CPU cost can vary so widely (8ms vs. 605ms) on the identical route** depending on whether the isolate serving it happens to be warm already. **Classification: PLAUSIBLE, not proven** — this session cannot directly observe isolate lifecycle from outside the Worker.

---

## 13. Aggregate CPU / Quota Hypothesis

Tested and **not supported** by the evidence:

- If a rolling/replenishing account-wide CPU quota were the mechanism, heavier-traffic periods should predict failure onset. No such correlation was found — the 14:37 failure onset followed a *quiet* period (root/CRM/etc. were not being hit heavily beforehand), and the 15:23 War Room failures occurred in the *same second* as successful, CPU-heavy requests to other routes (207–351ms), which a shared, currently-exhausted quota should have blocked too.
- If it were periodic (e.g., every 20 minutes on the clock), the transition timestamps should show a clean modulus. They do not: 14:37, 14:57 (20 min later), but then healthy for 24 min before the next mixed window at 15:23 (26 min later) — inconsistent spacing.

**This hypothesis is falsified as a *primary* explanation**, though a per-isolate (not per-account) micro-quota interacting with cold-start timing (§12) remains an open, plausible variant not fully distinguishable from outside the platform.

---

## 14. Cloudflare Configuration Audit

Re-confirmed, read-only, this wave:

- `wrangler.jsonc`: no `limits.cpu_ms`, no `account_id` override, single environment.
- Worker script settings API (`/workers/scripts/mindbunker/settings`): no `limits` key present at all.
- No Smart Placement config found.
- No secondary/hidden deployment: `wrangler deployments list` shows a single deployment history, one version at 100% traffic throughout this entire investigation.
- `wrangler.maintenance.jsonc` exists in this repo but declares the **same** script name (`mindbunker`) — it is an alternate deploy *config* for the same script, not a second live Worker; not relevant to routing since `wrangler deployments list` confirms only one live version exists.

**No explicit CPU override anywhere in this account's configuration that this token can read.**

---

## 15. Root-Cause Classification

| Candidate | Verdict |
|---|---|
| A. Workers Free / flat 10ms limit | **Contradicted** — routine successes at 200–605ms rule out a flat, always-on 10ms ceiling |
| B. Workers Paid but inconsistently applied | **Best-supported by evidence** — explains both the high-CPU successes and the exact, invariant 10ms kills, and explains why the split changes from second to second |
| C. Cloudflare platform/runtime behavior (isolate placement, cold-start interaction with a real limit) | **Plausible, overlapping with B** — §12's cold-start candidate could be *why* a request occasionally lands under a stricter effective budget, without contradicting B |
| D. Route-specific/runtime-specific issue | **Not supported as primary cause** — two different routes (Sensor, War Room, Productivity) show the identical signature; not isolated to one code path |
| E. Application CPU pathology | **Not found** — every audited stage (§9, §10) is bounded and lean at current data volume; War Room is heavier than Sensor by design (12 parallel data sources vs. 3) but nothing in it is an accidental quadratic scan, unbounded loop, or obvious defect |

**Confidence: HIGH** that this is B/C (platform-side inconsistency), not A, D, or E. **Not PROVEN** — proof requires either Cloudflare's own internal telemetry or a confirmed, stable plan-tier answer from Emmanuel's dashboard that this session cannot obtain.

---

## 16. Confidence Level

**HIGH** on: worker-wide scope (not sensor-only), no retry storm, no application CPU bug, no config override, no dispatch/service-binding misdirection, exact invariant 10ms failure signature.
**MEDIUM** on: cold-start-interacting-with-a-real-limit as the specific mechanism behind B/C.
**UNKNOWN, explicitly not guessed:** the actual Workers plan tier; the exact Cloudflare-side reason enforcement is inconsistent.

---

## 17. Emergency Mitigation Ranking

Evaluated, **not implemented**, per instruction. RMEDIA is a one-person business — proportional response strongly favors options that trade a small recurring cost for eliminated engineering/maintenance burden.

| Option | Operator impact | Engineering time | Maintenance burden | Risk | Rank |
|---|---|---|---|---|---|
| **A. Workers Paid** | None (transparent) | Zero (account setting only) | Zero | Low — standard, well-documented Cloudflare product | **1st — if plan tier turns out to be the actual gap** |
| C. Cache the catalog response briefly (e.g., 30–60s) | Slightly staler Sensor data, imperceptible in practice | Small, bounded | Low, one cache-control decision | Low | 2nd — cheap, real mitigation regardless of root cause, but treats a symptom |
| B. Sensor polls less frequently | Slightly less real-time device activity data | Trivial (native app config) | Low | Low, but doesn't address root cause and reduces a working feature's fidelity | 3rd |
| E. Optimize the route further | None | Small–moderate | Low | Low, but likely low-yield — the route is already lean (§10), and the failures aren't confined to it (§6) | 4th |
| D. Separate minimal Sensor API Worker | None | Moderate–high (new deploy target, new routing, new maintenance surface) | **Ongoing, permanent** | Adds real architectural complexity for a problem that isn't proven to be Sensor-specific (§6 shows it isn't) | **Last — actively discouraged given §6's evidence** |

**If Emmanuel confirms Workers Paid is already active:** Option D should not be built reflexively — the evidence in §6 already shows this is worker-wide, so isolating the Sensor route into its own Worker would not fix War Room or Productivity's failures, and would add a permanent second deploy target for a one-person business to maintain going forward.

---

## 18. Recommended Decision Branch

**Branch B — prepare for the possibility that Workers Paid is active but inconsistently enforced.**

Given this session cannot confirm the plan tier, the concrete next step is still gated on Emmanuel's dashboard check (§3). Two sub-paths follow directly from that check:

- **If the dashboard shows Free:** this collapses cleanly to Branch A. Upgrade to Workers Paid (Option A above) is the correct, proportional fix — a few dollars a month, zero code change, zero new maintenance surface. After upgrading, re-run the exact verification already used successfully once before in this engagement: `wrangler tail` for a few minutes, confirm ≥3 Sensor Catalog requests all `ok`, then hold the account-wide Analytics view open for a sustained window (ideally the full 20+ minutes this wave's mission asked for, not yet completed — see §20) before declaring it closed.
- **If the dashboard already shows Paid, Standard, active, current billing:** this is Branch B confirmed, and the support-evidence package in §19 is ready to hand to Cloudflare support as-is.

---

## 19. Cloudflare Support Package (ready to file if Branch B is confirmed)

- **Account ID:** `a2511426086f83bc2d6031478dbf2e69`
- **Worker:** `mindbunker`, version `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b` (single deployed version throughout the entire incident window, confirmed via `wrangler deployments list`)
- **Route:** `emmanueldarosa.com/mindbunker*` (confirmed via zone route table, no dispatch/service-binding layer)
- **Failure window examples (UTC):** `14:37:55–14:56:54` (19 min unbroken), `15:23:25–15:24:22` (War Room specifically, 4 occurrences in 57s)
- **Failed request example:** `cf-ray: a3afc1396a971b26`, `2026-09-14T13:41:55.402Z`, `GET /mindbunker/api/sensor/v1/catalog`, `outcome: exceededCpu`, `cpuTime: 10`, `wallTime: 13`
- **Successful >10ms example, same Worker/version, same hour:** `2026-09-14T15:23:24.767Z`, `GET /mindbunker/crm`, `outcome: ok`, `cpuTime: 351`
- **Route trace:** documented in full in §2 — no dispatch namespace, no service binding, no alternate script anywhere in the request path
- **No CPU override proof:** `wrangler.jsonc` has no `limits` block (repo, this session); Worker script settings API returns no `limits` key (live account state, this session)

---

## 20. Exact Next Action

~~Emmanuel checks the Cloudflare dashboard...~~ **Done — see §21.**

---

## 21. WORKERS PAID RESOLUTION

**Dashboard confirmation:** Emmanuel confirmed Workers Paid plan purchased and active, with the included allowance of **30 seconds CPU per request** (3,000× the Free plan's 10ms).

**Application state, verified unchanged before and after activation:**
- Operator Worker version: `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b`, 100% traffic — same version throughout, no deploy at any point in this whole investigation or its resolution.
- `production/current`: `0de8a93d2ca88f3cbd3665a6e3ff7b08cba67079` — unchanged.
- D1 migration head: `0049_certain_frog_thor.sql` — unchanged, no pending migrations.
- No D1 mutation at any point.

**Post-upgrade live verification** (`wrangler tail`, continuous capture, 2026-09-14T15:48:55Z–16:02:55Z, ~14 minutes):

| | n | outcome | cpuTime range |
|---|---|---|---|
| Sensor Catalog | 15 | **15/15 ok** | 11–19ms (tightly clustered — the same route that was killed at exactly 10ms throughout the incident now runs consistently just above that old ceiling, comfortably under the new one) |
| Sensor Observations | 5 | 5/5 ok | 7–13ms |
| `/mindbunker` (root) | 1 | ok | **529ms** — the single highest CPU request observed in this entire investigation, succeeded cleanly |
| `/mindbunker/crm` | 1 | ok | 405ms |
| `/mindbunker/productivity` | 1 | ok | 252ms |
| `/mindbunker/projects` | 1 | ok | 24ms |
| `/mindbunker/war-room` | 1 | ok | 35ms — the single most failure-prone route in the entire pre-upgrade investigation (4 of 5 rapid attempts failed just before the upgrade) succeeded cleanly here |

**25 of 25 directly-captured live events: `ok`. Zero `exceededCpu`. Zero `exceededResources`. Zero occurrences of the `cpuTime: 10` signature.**

Cross-checked against Cloudflare Analytics for the same window (15:48:00Z onward): **33 of 33 requests `success`**, independently confirming the tail capture.

**Sustained observation duration:** ~15 minutes of continuous, zero-failure production traffic (short of the originally-requested 30–45 minutes — Emmanuel reviewed this evidence, including the two highest-stress data points available (the 529ms root request and War Room's full recovery), and explicitly closed P0 on that basis rather than waiting out the remainder of the window). Recorded here accurately rather than overstated.

**No code change, no deploy, no D1 mutation was required or performed** to resolve this incident — exactly as this report's Branch A recommendation anticipated.

### Final root cause, precisely stated

**PROVEN:** production was running under the Workers Free plan (10ms CPU/request) while this application's real request-handling cost — even for already-lean routes, and especially for data-heavier routes like War Room — routinely needed more than that, particularly on any request that also paid a module-initialization cost (see §12).

**OBSERVED, not further speculated on:** the Cloudflare runtime did not enforce that 10ms Free-plan ceiling on every single request — many requests needing tens to hundreds of milliseconds succeeded anyway, while others needing only slightly more than 10ms were killed at exactly that value. This session does not know, and does not claim to know, the internal tolerance/enforcement algorithm behind that inconsistency — only that it stopped being observable at all once the account moved to a plan whose allowance (30s) is so far above this application's real usage that the question is now moot.

---

## FINAL CLOSURE OUTPUT (supersedes the pre-upgrade block below, kept for the historical record)

**WORKERS PLAN:** PAID — CONFIRMED (30s CPU/request allowance)

**OPERATOR VERSION:** `cf8b54bc-d0ce-42ad-ad74-acbcfb4af81b` — unchanged throughout

**SENSOR:** GREEN (15/15 post-upgrade)

**CONTROL ROUTES:** GREEN (5/5 post-upgrade, including War Room)

**VIDEO WORKSPACE:** NOT PERFORMED — NO SAFE AUTH (no production credentials available to this agent; not fabricated)

**POST-UPGRADE OBSERVATION:** ~15 minutes continuous, zero failures (Emmanuel closed P0 on this evidence rather than waiting the full originally-requested 30–45 minutes)

**EXCEEDED CPU:** 0

**EXCEEDED RESOURCES:** 0

**10MS FAILURE SIGNATURE:** ABSENT

**CODE CHANGE:** NONE

**DEPLOY:** NONE

**D1 MUTATION:** NONE

**P0:** CLOSED

**MONDAY PILOT:** SAFE TO RESUME

**STOP.**

---

## Final Output — pre-upgrade record (superseded above, kept for history)

**WORKERS PLAN:** FREE — confirmed

**CURRENT SENSOR:** FLAPPING (expected and now explained — Free plan's tolerance-based enforcement is inherently inconsistent request-to-request, not a separate open question)

**FAILURE SCOPE:** WORKER-WIDE

**HEALTHY SENSOR CPU:** median 17ms / p90 39ms / max 39ms

**FAILED SENSOR CPU:** exact 10ms signature, zero variance, n=7 — the Free plan's documented per-invocation limit, applied as designed

**MULTIPLE SENSOR INSTANCES:** NO (2 registered, only 1 active)

**RETRY STORM:** NO

**ROOT CAUSE:** Workers Free plan's 10ms CPU-time limit, applied to this Worker's requests — confirmed by account plan and fully consistent with every observed failure and success in this investigation.

**CONFIDENCE:** PROVEN

**RECOMMENDED BRANCH:** A — upgrade to Workers Paid. No code change, no architecture change, no route optimization needed or recommended.
