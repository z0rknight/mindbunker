# Client Portal — Production Readiness Review

Adversarial research round against the Sprint 1.2.2 implementation. Read-heavy: the repository was traced end to end (auth, projection, lifecycle, schema, tests, git state) before any conclusion below was written. Four small, deterministic fixes were made where the defect was unambiguous; everything else is analysis and recommendation, not new product surface.

## 1. Executive verdict

The portal is architecturally sound for what it claims to do, and honest about what it doesn't yet do. Client isolation holds at the server/data boundary everywhere it was tested, not just in the UI. Two real (not hypothetical) defects were found and fixed this round: four new pages were missing the explicit `force-dynamic` marker every other authenticated page in this codebase carries, and the client login had a timing side-channel that could leak which emails have portal access. Everything else found is a semantic honesty question (is "Delivered" true?) or a product-scope question (what metrics are actually safe), not a security hole.

## 2. Current auth model

Unchanged from last round's design, reconfirmed by re-reading `auth-core.ts` and `client-portal-session.ts` line by line: two doors (capability token, persistent password) into one boundary. `mb_client_session` cookie, `cs1` token version tag, clientId bound inside the signed payload, live revocation via `portalPasswordSetAt` comparison. Cookie flags confirmed: `httpOnly`, `secure` in production, `sameSite: "strict"`. `sameSite: strict` alone defeats most CSRF against this cookie; Next.js Server Actions additionally enforce an Origin-header same-site check by default, and `next.config.ts` doesn't weaken it (`experimental.serverActions.allowedOrigins` is not set). No session-fixation path exists — `createClientAuthSession` only ever runs after a verified credential check, never before, and always mints a fresh random nonce.

## 3. Authorization analysis

Traced every point clientId is derived, accepted, queried, and filtered:

- **Derived**: only from `verifyClientSessionToken`'s HMAC-verified payload (`isClientAuthenticated`) or from `verifyClientCredentials`'s DB lookup at login. Never from a route param, query string, or form field.
- **Accepted as ground truth for authorization**: only the session-derived clientId. `requireClientAuth(loginPath, expectedClientId)` compares a route's expected clientId against the session's — a mismatch redirects to login rather than proceeding, and nothing in the client-portal module trusts a client-supplied `clientId` for a query `WHERE` clause.
- **Filtered**: `getClientDashboardView`/`getClientPortalView` scope every query by the authenticated clientId at the SQL level, and `buildClientDashboard`/`buildClientPortalProjects` re-derive ownership again in pure code afterward (defense in depth, not just UI hiding) — confirmed by the existing `core.test.mjs` ownership tests plus this round's IDOR-shaped tests.

**IDOR attempts specifically tried (by reading, not by running a live attacker):**
- Client A requesting `/client/dashboard` after Client B's session cookie: blocked — the dashboard resolves clientId from the cookie, there's no client-supplied id anywhere in the URL to substitute.
- `transitionVideoStatusAsClient(videoId, target)` called with a videoId belonging to a different client: the function fetches the video by id, then checks `video.clientId !== sessionClientId` and returns the *same* "Video not found" error as a genuinely missing video — no existence oracle.
- A capability-token visitor (`/client/[token]`) attempting to reach `/client/dashboard` or vice versa: the two surfaces share a database but not a session — a token alone never sets `mb_client_session`, and the dashboard's `requireClientAuth` doesn't accept a token as a substitute for a cookie.

No query in the client-portal module was found returning another client's projects, videos, events, or metadata under any input tried.

## 4. Delivery semantics

Semantic table, current-code-accurate as of this round:

| Internal state | Actual current meaning | Client label | Evidence | Ambiguity | Risk |
|---|---|---|---|---|---|
| PLANNED | Not yet started | (not shown as a card) | none needed | none | none |
| IN_PROGRESS | Operator is actively producing | "In production" | `video.started` crm_event | Low | Low |
| READY_FOR_REVIEW | Operator believes it's ready; client hasn't acted yet | "Review" | `video.ready_for_review` crm_event | Low | Low |
| CHANGES_REQUESTED | Either party asked for rework | "Updates in progress" | `video.changes_requested`, actor distinguishes who | Low | Low |
| DONE (reached via IN_PROGRESS → DONE, operator-only, client never saw READY_FOR_REVIEW) | Operator finished production and closed it out without routing through client review | "Delivered" | `video.finished` crm_event, `actor: "admin"` | **High** | **Medium** |
| DONE (reached via READY_FOR_REVIEW → DONE by client Approve) | Client explicitly reviewed and approved | "Delivered" | `video.finished` crm_event, `actor: "client"` | Low | Low |
| DONE (reached via READY_FOR_REVIEW → DONE by operator, bypassing client) | Operator overrode without waiting for client action | "Delivered" | `video.finished` crm_event, `actor: "admin"` | High | Medium |

**The finding:** both rows labeled High/Medium collapse to the identical client-facing label "Delivered," but only one of the three DONE paths (client-actor Approve) has any evidence the client actually saw or agreed to it. The `actor` field on the `video.finished` event *already distinguishes these paths in the data* — the dashboard just doesn't use that distinction yet.

**A second, independent finding:** nothing in `planVideoTransition`/`VIDEO_STATUS_TRANSITIONS` requires `deliveryUrl` to be set before a video can reach DONE. A video can be labeled "Delivered" on the client's dashboard with no Watch button at all (the card's `deliveryUrl && <a>Watch</a>` conditional simply renders nothing). Not observed in the current 1-video local dataset, but structurally reachable today with legacy or fast-moving data.

**Recommendation (documented, not implemented — this is a product decision, not a bug):** (C) from the brief's own menu — derive a lightweight distinction from evidence that already exists, rather than adding a new lifecycle state. Two options ranked by cost: (1) label copy fix — show "Delivered" only when `deliveryUrl` is present, otherwise "Completed" (truthful, zero schema change, one conditional in `buildClientDashboard`); (2) trust fix — treat `video.finished` events with `actor: "client"` as "Approved & delivered" and `actor: "admin"` as "Marked complete," two distinct client labels from data that already exists. Both are cheap. Neither was implemented this round because it changes what text a paying client sees, which is a product call for Emmanuel, not an engineering unilateral.

## 5. Review semantics

Adversarial sequences traced against the actual code (`applyVideoStatusTransition`'s optimistic-concurrency `WHERE status = current.status` clause is the load-bearing mechanism here):

- **READY_FOR_REVIEW → Approve → Request changes**: the second call re-checks `current.status !== "READY_FOR_REVIEW"` (it's now DONE) and is rejected with "This video isn't awaiting your review." No contradictory event written.
- **Two simultaneous Approve requests**: the conditional `UPDATE ... WHERE status = 'READY_FOR_REVIEW'` means only the first to commit succeeds; the second finds zero matching rows and returns "This video changed elsewhere," writing no duplicate `crm_event`. D1/SQLite's single-writer execution model makes true double-application effectively impossible here, not just unlikely.
- **Client A acts on Client B's video**: blocked at the ownership check before the transition helper is ever called (see §3).
- **Revoked session attempts a mutation**: `isClientAuthenticated()` returns `false` before any DB write is attempted; the action returns "Please log in to review this video."
- **Replay of an already-successful Approve**: rejected the same way as the "double approve" case above — safe-by-rejection, not silently idempotent-success, which is the right behavior (a second success would double-write history).
- **Client approval vs. operator completion**: NOT indistinguishable — `crm_events.actor` is `"client"` vs `"admin"`, and the description text differs ("Client moved..." vs "...moved to..."). This directly answers the brief's stated concern: the data already keeps them apart, even though the *client-facing label* doesn't yet use that distinction (see §4).

No gap found here worth a code change. One test-shaped gap: none of this is covered by an automated authorization test, because `next/headers`/`next/navigation` aren't mocked anywhere in this test harness (true for the admin auth equivalents too — not a regression this round introduced). Verified by careful reading, not by execution.

## 6. Password reset production design

No email provider exists anywhere in this repository or its dependencies (checked `package.json`, `.dev.vars.example`, and a repo-wide search) — there is nothing to reuse from elsewhere in the RMEDIA ecosystem. This section is a design, not code.

```ts
type SendClientPasswordResetInput = {
  email: string;
  resetUrl: string;      // fully-formed, ready to click — no token assembly in the caller
  expiresAt: Date;
};

async function sendClientPasswordReset(input: SendClientPasswordResetInput): Promise<
  { success: true } | { success: false; error: string }
>;
```

- **Required config**: one secret (`RESET_EMAIL_PROVIDER_API_KEY` or similar), one verified sending domain, one "from" address (e.g. `noreply@rmedia...`). No other config.
- **Rate limit**: reuse the existing `requestPortalPasswordReset` call site — it already only proceeds to the (future) send call when exactly one portal-enabled client matches, so the natural ceiling is "one send per matched request." Add a simple per-email cooldown (e.g. don't re-send within 60 seconds) purely to stop a form-refresh spam loop, not as a security control (the generic response already prevents enumeration).
- **Expiry**: already defined — `PORTAL_RESET_TOKEN_TTL_MS` (1 hour), unchanged.
- **Single-use**: already enforced — `resetPortalPasswordWithToken` clears `portalResetTokenHash` on success, so a used or superseded token can't be replayed (verified in §4 of the prior round's tests, reconfirmed by reading).
- **Generic response behavior**: unchanged — `requestPortalPasswordReset` always returns the same shape regardless of match. The adapter call site should be wrapped so a *provider failure* (API down, bad address) also degrades to the same generic message to the client, logged internally instead of surfaced — a failed send must not become an information-disclosure oracle ("that email doesn't exist" vs "email failed to send" would leak exactly what this design otherwise prevents).
- **Failure behavior**: log the provider error server-side (not the token, not the password) for the operator to see; never retry automatically more than once (avoid duplicate emails); never fall back to displaying the token client-side outside development.
- **Logging policy**: log that a send was attempted and its provider-level success/failure. Never log the token itself, the email body, or the reset URL in full (log the client id, not the URL).

This can be built locally today up to the actual provider call — the interface above, the cooldown, and the failure-degrades-to-generic-response wrapper are all pure/local. Only the literal HTTP call to a provider requires a credential this environment doesn't have, so that one function is the entire, isolated production dependency.

## 7. Client-safe BI matrix

| Metric | Classification | Notes |
|---|---|---|
| Completed videos (total) | SAFE + USEFUL NOW | shown |
| In production / ready for review | SAFE + USEFUL NOW | shown |
| Completed this week | SAFE + USEFUL NOW | shown, semantics fixed this round (see prior round's report) |
| Recent deliveries | SAFE + USEFUL NOW | shown |
| Active projects | SAFE + USEFUL NOW | shown |
| Videos by content type (completed) | SAFE + USEFUL NOW | shown, unclassified tracked separately from zero |
| Total videos across all states | SAFE BUT LOW VALUE | mixes states, less informative than the existing breakdown |
| Videos per project | SAFE BUT LOW VALUE | derivable, borders on dashboard confetti |
| Days since last delivery | SAFE BUT LOW VALUE | derivable, easy future add |
| Output by week/month trend | NEEDS MORE DATA | too low-volume today for a "trend" to mean anything rather than noise |
| Average delivery cadence | AMBIGUOUS / MISLEADING | small-N average risks reading as an implied SLA |
| Turnaround time (start → delivery) | AMBIGUOUS | edges toward operational timing data; not designed or authorized as a client-facing promise |
| Revisions count | PRIVATE-LEANING | reads as either internal friction or a judgment of the client's own feedback volume |
| Approval rate | MISLEADING | a small-N score that isn't RMEDIA's own output and isn't something the brief authorizes exposing |
| Delivery streak | MISLEADING / REJECTED | gamification-flavored framing, same category the War Room XP/Level critique already flagged |
| Backlog size | AMBIGUOUS | same numbers as "in production," but the *framing* ("backlog") reads negatively for the same data |
| Work hours / margin / EHR / ActivityWatch / internal notes | PRIVATE | never exposed, never queried by this module |

## 8. Client value hierarchy

Ranked by (client value, data reliability, current availability, cost) — all four already shipped are also the four highest-ranked candidates, which is a reasonable sign the last round prioritized correctly rather than by luck:

1. What's waiting for me to review — highest value, fully reliable, available, shipped.
2. What's being produced right now — high value, reliable, available, shipped.
3. What's already been delivered — high value, reliable (modulo the DONE-evidence gap in §4), available, shipped.
4. How much content has RMEDIA produced overall — medium value, reliable, available, shipped (completed total).
5. What changed this week — medium value, reliable now that the semantics were fixed, available, shipped.
6. Where do I watch/download — high value per-item, reliable when `deliveryUrl` exists, embedded contextually in each card rather than a separate section (deliberate — a global "things to watch" list would just duplicate Recent Deliveries).
7. Recent output cadence (trend) — lower value at current data volume, not reliable yet, not available, not worth building until real usage exists (§7).

## 9. Video presentation audit

- 16:9/9:16 semantics: correct — `aspect-video` and `aspect-[9/16] max-h-80` are genuinely different containers, not the same box with a class swapped.
- Square/unknown: both fall back sanely (`aspect-square`, `aspect-video` respectively) — no crash, no unbounded box.
- Missing/broken image: a missing `coverUrl` renders the placeholder path deterministically (conditional on `video.coverUrl` truthiness, not on load success/failure). A *broken* URL (exists but 404s/CORS-fails) is not caught by an `onError` handler — the placeholder only covers "no URL," not "bad URL." This is a real, minor gap: a client could see a broken-image icon inside the aspect container instead of the graceful placeholder. Low severity (operator controls what URLs get entered), easy future fix (`onError` swap to placeholder state), not fixed this round since it's a UI polish item, not a security/authorization defect.
- HTTPS-only validation: sufficient for the stated threat (no `javascript:`/`data:`/`file:` URLs reach the DOM) — confirmed via the existing `validateCoverUrl` tests.
- Tracking/privacy via arbitrary image URLs: real but inherent to embedding any third-party image, browser-default-mitigated (`strict-origin-when-cross-origin` sends only the origin, not the path or any token, to the image host — no explicit `Referrer-Policy` is set anywhere in the app, but the modern browser default already limits exposure). Cross-origin `<img>` requests do not carry this app's cookies (origin-scoped by the browser), so no session/capability leakage via the image request itself.
- Scale (1/10/100+ cards): no N+1 — `getClientDashboardView` issues exactly 3 queries via `Promise.all` regardless of video count. The videos query itself has no `LIMIT` (unlike the completion-events query, capped at 100) — at SMB scale (dozens to low hundreds of videos per client over years) this is not yet a problem; flagged as the point where a limit would become necessary if a single client's video count grows well past what a dashboard page should render at once (see §13).

## 10. Gateway / Vault / /client terminology

Reconstructed relationship, not renamed (renaming was explicitly out of scope):

- **Gateway** (`/g/[token]`) — the pre-portal door: briefing form + booking, for a lead/prospect who isn't yet a full client-portal user.
- **Vault** (product branding) and **Client Portal** (code/schema naming) — the same feature under two names, both referring to `/client/[token]` (token-only, read-only status view). Reconfirmed this round, not re-litigated.
- **`/client/login` → `/client/dashboard`** — new this sprint, the second authentication door into the *same* underlying data/projection layer as the Vault, not a third product.

**Canonical terminology proposal** (naming only, no code renamed): call the whole client-facing surface "the Client Portal" externally and internally consistently; "Vault" can remain as a legacy/marketing synonym Emmanuel may still use in conversation, but new internal docs should prefer "Client Portal" to stop the two-names-one-thing confusion a prior round already got bitten by once. `/g/[token]` (Gateway) is conceptually upstream of the Portal, not part of it — a lead uses Gateway before becoming a client; a client uses the Portal.

## 11. Geladeira interaction

**Current behavior, confirmed by reading, not assumed:** archiving a client to Geladeira (`archiveClient`) does **not** touch `portalPasswordHash`, `portalPasswordSetAt`, or the gateway invitation. An archived client can still log in via `/client/login` and see their full dashboard, exactly as before archival. This matches an *existing, explicit* product precedent: `GeladeiraControl.tsx` already tells the operator, in its own copy, "This client still has active private access. Archiving does not revoke it" — for the Gateway/Vault capability link specifically. The same policy now applies, un-warned, to the new persistent password door too.

**Recommendation, not implemented this round** (a UI/copy addition, not a bug fix): extend `GeladeiraControl`'s existing amber warning to also check `portalPasswordHash`, so an operator archiving a client with an *active password* gets the same heads-up they already get for an active Gateway link. This is P1 for next round — small, matches an established pattern exactly, but is new UI surface, not a defect in existing code.

**Policy answer to the brief's question:** archival should **not** auto-revoke access, for the same reason Geladeira never auto-touches any other child data — it's explicitly a visibility flag, not a security boundary. If an operator wants to cut off an archived client's access, that should stay a deliberate, separate, visible action (as it already is for Gateway links) — automating it would be the first exception to an invariant every other Geladeira interaction in this codebase honors.

## 12. Historical boundary

Grepped the entire client-portal module and every `/client` route for any reference to `hist_*` tables or the `historical` module: zero matches. No reconstructed historical evidence, revenue, hours, or identity-match data can reach `/client` through any code path that exists today — the isolation is structural (nothing imports the historical module), not just a convention. `totals.completed` and every other dashboard number reads only from `video_logs`/`crm_events`/`projects` (native tier). If a future round wants lifetime output to include pre-MindBunker historical records, that would require a deliberate, explicit promotion decision (and almost certainly a distinct, separately-labeled figure, per the standing historical/native boundary invariant) — nothing in this round moved that line either direction.

## 13. Scale analysis

Reasoned and synthetically tested (`buildClientDashboard`'s test suite includes a 7-video case proving the 5-item cap and sort order), not observed against real data — the local dogfooding database has only 2 clients, 2 projects, and 1 video, so there is no real-world volume to measure against yet.

- 0 videos: single empty state, verified by test and by reading the page component's `hasAnyVideos` branch.
- 1–10 videos: no different code path than the general case; every section renders or doesn't based on the same filters.
- 100–150 videos: `recentDeliveries` is hard-capped at 5 (tested) and `currentWork`/`readyForReview` are unbounded lists — at 100+ videos simultaneously `READY_FOR_REVIEW`, the "Needs your attention" grid would become a genuinely long scroll. This is the concrete point where a limit (or a "show more") becomes necessary; not needed at current or realistically near-term RMEDIA volume, but worth remembering rather than rediscovering later.
- Completion-events query is capped at 100 rows server-side; if a single client accumulates more than 100 completed videos, the oldest excess completions would silently stop being considered for "recent deliveries"/"completed this week" derivation (they'd still count in the plain `totals.completed` count, which is a separate, uncapped query). Low risk at current scale, worth a comment in code for whoever revisits this at real volume — not fixed this round, since raising or removing the cap is a judgment call about a scale that doesn't exist yet.
- No N+1 anywhere in the client-portal query paths — confirmed by reading every `db.select`/`Promise.all` in `data.ts`, not by profiling a running server (couldn't — see Cache/Privacy section's note on this sandbox's `next dev` limitation, unchanged from last round).

## 14. Cache/privacy analysis

**Found and fixed this round:** `/client/dashboard`, `/client/login`, `/client/reset`, and `/client/reset/[token]` were all missing the explicit `export const dynamic = "force-dynamic"` that every other authenticated/personalized page in this codebase carries (`/client/[token]`, `/crm/[id]`). Next.js's automatic dynamic-rendering detection via `cookies()` usage inside `requireClientAuth`/`isClientAuthenticated` should already force these dynamic, but relying on that implicitly, when the established codebase convention is to be explicit everywhere else, was an inconsistency worth closing rather than trusting. Fixed on all four pages this round — see CODE CHANGED.

`getDb()`'s use of React's `cache()` is request-scoped memoization inside a single render pass, not a cross-request cache — verified against how it's already used identically on the admin side; it cannot leak one client's projection into another request.

Capability tokens and reset tokens both live in the URL path (`/client/[token]`, `/client/reset/[token]`), which is a pre-existing architectural characteristic of bearer-link design (present before this round, unchanged by it) — tokens in a path are visible to server access logs and browser history, which is exactly the risk the new password door was partly built to offer an alternative to. Not a new risk, not fixed, correctly out of scope for "tiny local bug fix."

## 15. Logging / audit trail

**What's currently logged:** admin-triggered portal access grant/revoke (`client_portal_access_granted`/`_revoked`), and client-initiated video lifecycle transitions (`video.finished`/`video.changes_requested` etc. with `actor: "client"`). **What's not logged, checked by grep across every new file:** login success, login failure, logout, password reset request, password reset completion — zero `crm_events` writes and zero `console.*` calls anywhere in the client auth stack. This matches the existing admin login, which also logs nothing — not a regression this round introduced, but a real, pre-existing gap the brief's question surfaces.

**Recommended minimum (not implemented — a feature addition, not a bug fix):** log `client_portal_password_reset_completed` (materially changes account access, genuinely useful if a client reports "I didn't do that") and nothing else new. Do not log every login success (noise) or every reset request (already protected by the generic response; logging requests risks building exactly the enumeration signal the generic response exists to prevent). Never log passwords, tokens, or reset URLs — confirmed no code path currently does.

## 16. Threat model

| Attack | Current defense | Gap | Severity | Recommendation |
|---|---|---|---|---|
| Leaked capability link (Vault or reset) shared/forwarded | Token-hashed storage, TTL, revocable | Token lives in URL path (logs, history) | Medium | Accept — inherent to bearer links; password door is the mitigation already shipped |
| Stolen/reused client password | Rate limiting, PBKDF2-310k, live revocation | None found | Low | None |
| Random internet attacker probing `/client/login` | Rate limit (5/15min per IP+email), generic error, now-fixed timing side-channel | None found this round | Low | None |
| Curious legitimate client trying another client's data via URL/id manipulation | Session-derived clientId only, ownership re-derived in pure code, identical "not found" for missing vs. not-owned | None found | Low | None |
| Accidental operator misconfiguration (duplicate email across two portal-enabled clients) | App-level collision check at write time, ambiguity refusal at read time | No DB-level uniqueness constraint; a genuine TOCTOU race across two *concurrent admin sessions* remains theoretically possible | Low | Optional future partial unique index; not urgent for a solo-operator admin |
| Broken/malicious cover image URL | HTTPS-only validation, unoptimized render (no SSRF via proxy) | No `onError` fallback to placeholder for a URL that's valid-shaped but dead/blocked | Low | Cheap future UI fix |
| Client dashboard served from a shared cache to the wrong viewer | `force-dynamic` now explicit on every route (fixed this round), `sameSite: strict` + `httpOnly` cookie | None found after the fix | Low (was Medium before the fix) | Fixed |

## 17. Production-readiness matrix

| Area | Local status | Production blocker? | Confidence | Next action |
|---|---|---|---|---|
| Auth | Implemented, tested at the token layer | No | High | — |
| Authorization | Implemented, traced adversarially by reading | No | High | Add request-context-mocked tests when the harness supports it |
| Password reset | Design-complete, dev-token-only | **Yes** | High (on what exists) | Wire a real email provider (§6) |
| Capability access | Unchanged, pre-existing | No | High | — |
| Client isolation | Implemented, verified by reading + tests | No | High | — |
| Review actions | Implemented, adversarial sequences traced safe | No | High | — |
| Dashboard semantics | Implemented, one honest label gap (§4) | No (soft, a copy question) | High | Product decision on DONE-label fix |
| Delivery semantics | Evidence exists but underused (§4) | No | Medium | Product decision |
| Visual QA | Structural only, never rendered | Soft blocker | Low (rendering unverified) | Real browser QA once `next dev` is reachable |
| Mobile QA | Structural only (aspect containers, touch targets) | Soft blocker | Low | Same as above |
| Migration | Applied and FK-checked locally | No | High | — |
| D1 | Local only, untouched remotely | N/A this round | High | — |
| Secrets | `.dev.vars`/`.env*` gitignored, none committed | No | High | — |
| Email | Not wired | **Yes** | High (on the gap itself) | §6 |
| Logging | Minimal, matches existing precedent | No | Medium | Optional addition, §15 |
| Caching | Fixed this round | No | High | — |
| Rollback | Additive migration, nullable columns, no destructive change | No | High | — |
| Backup | Not this round's concern (local D1 only) | N/A | — | — |
| Deploy process | Not touched, not attempted | N/A this round | — | — |

## 18. P0/P1/P2/Deferred/Rejected

**P0 (found and fixed this round):** missing `force-dynamic` on four new pages; login timing side-channel.
**P1 (documented, not implemented):** DONE→"Delivered" label honesty fix (two options given); Geladeira archive warning extended to portal passwords; email provider wiring for reset.
**P2:** broken-image `onError` fallback; optional minimal audit-log addition (§15); partial unique index on portal-enabled email.
**Deferred (needs more data):** output/cadence trend metrics, turnaround-time metrics.
**Rejected:** approval rate, delivery streak, and any metric that reads as gamification or an implied SLA — consistent with this round's own BI matrix classifications.

## 19. Exact next implementation round

A decision round, not a build round: get Emmanuel's call on the DONE/Delivered label question (§4, two concrete options costed), then implement whichever is chosen (small, ~1 file). Separately, wire a real email provider using the adapter interface in §6 once a provider is chosen. Both are small, well-scoped, and blocked only on a human decision, not on more research.
