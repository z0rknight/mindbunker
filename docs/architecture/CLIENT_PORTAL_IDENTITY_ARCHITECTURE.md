# Client Portal Identity Architecture

**Sprint 1.2.2 — Client Portal Identity, Intelligence & Delivery Surface**
Status: local implementation complete, not deployed. This is the one durable document for this round — it supersedes nothing, and nothing else needs to restate this content.

## 1. Auth model

Two doors, one authorization boundary.

**Door A — Capability token** (`/client/[token]`, pre-existing). A `gateway_invitations` row, token-hashed (SHA-256 hex), TTL 14 days, revocable. No persistent session. This is unchanged this round — `buildClientPortalProjects` and `CLIENT_VIDEO_STATUS_LABELS` in `src/modules/client-portal/core.ts` were not modified, and their existing test contract (`core.test.mjs`) still passes untouched.

**Door B — Persistent client account** (`/client/login`, new). Email + password, operator-issued (Door B is not self-serve signup — a person who has never talked to Emmanuel cannot create an account). Reuses the admin auth stack's primitives verbatim: PBKDF2-SHA256 password hashing (`createPasswordHash`/`verifyPassword` in `src/lib/auth-core.ts`), no new crypto written. A new signed session token family was added alongside the existing admin one:

- Cookie: `mb_client_session` (separate from admin's `mb_session`)
- Token version tag: `cs1` (admin is `v1`) — a client token and an admin token can never cross-verify even though both may be signed with the same `AUTH_SESSION_SECRET`. Tested in `src/lib/auth-core.test.mjs`.
- The clientId is embedded *inside* the signed payload, not read from the URL or request body anywhere downstream — `verifyClientSessionToken` only returns a clientId after the HMAC over the full payload (including that clientId) verifies. No code path trusts a client-supplied `clientId`.
- **Live revocation.** A signed token alone can't know about a password reset or an operator revoking access that happened after it was issued. `isClientAuthenticated()` (`src/lib/client-portal-session.ts`) additionally reads `clients.portalPasswordHash`/`portalPasswordSetAt` on every check: a null hash means access was revoked, and a `portalPasswordSetAt` newer than the token's issue time (reconstructed from `expiresAt - CLIENT_SESSION_MAX_AGE_SECONDS`) invalidates the session immediately, not after 30 days. This is stricter than the admin session, which has no equivalent revocation check — a deliberate asymmetry, because a "revoke this client's access" button now exists and must actually work.
- Rate limiting reuses the existing `auth_attempts` table (no new table) via a fingerprint namespaced `client:{ip}:{email}` — failed logins against one client don't lock out a different client on the same network, and repeated guesses against one account are still throttled regardless of source IP.

Both doors resolve through the same `buildClientPortalProjects`/`buildClientDashboard` projection layer and the same D1 database — there is no second "Vault" system. ("Client Portal" and "The Vault" are the same feature under two names — an architectural note already on file from a prior round, reconfirmed, not re-litigated.)

Operator setup lives in the CRM: `src/app/crm/[id]/PortalAccessPanel.tsx` issues/resets/revokes a client's password. `setClientPortalPassword` (`src/modules/client-portal/actions.ts`) refuses to enable Door B for a client with no email on file, and refuses to create a second portal-enabled client sharing another client's email (checked at write time — the read-time credential lookup in `verifyClientCredentials` also refuses an ambiguous match as defense in depth, in case that invariant is ever violated some other way).

Password reset: `requestPortalPasswordReset` always returns the same generic result regardless of whether the email matched (no enumeration). No email-sending integration exists in this environment — in development the raw reset token is returned directly and rendered as a clickable link (clearly labeled "Development only"), mirroring the existing `qa-login` dev-only pattern. **Production gap, not silently papered over:** wiring a real transactional-email provider at `requestPortalPasswordReset`'s dev-token branch is a required follow-up before this reset flow is usable by a real client outside this environment.

## 2. Client-safe data contract

The dashboard (`getClientDashboardView` → `buildClientDashboard`, both new) and the token-only Vault (`getClientPortalView` → `buildClientPortalProjects`, pre-existing and untouched) are two separate, additive projection functions over the same tables — this was a deliberate choice to avoid changing the tested contract of the existing function.

Client-safe, exposed today: client's own name; project name/status/deadline; video title (or date fallback); video lifecycle status (via `CLIENT_VIDEO_STATUS_LABELS`, never the raw internal status token); delivery/watch URL (HTTPS-only, sanitized); cover image URL (same HTTPS-only sanitization — this one matters more, since it becomes a live `<img>` src); orientation and content type (from the new canonical enums); last-updated/delivered timestamp.

Never exposed, structurally: Work Session duration/ActivityWatch data, `crm_events.description` bodies (including Video Memory notes), `clients.notes`/`qualificationNotes`/`totalRevenue`, War Room analytics, health data, another client's anything. Ownership is re-derived inside the projection function itself (not just at the query level) — the same defense-in-depth pattern the original `buildClientPortalProjects` established, reused rather than replaced.

**Numbers are honest about what they measure.** "Completed this week" and "recent deliveries" are both derived from `crm_events` rows of type `video.finished` (the moment a video was marked DONE), *intersected with videos that are currently still DONE* — a video completed Monday and reopened Friday (`CHANGES_REQUESTED`) does not count as "completed this week" and does not appear in recent deliveries, because it would directly contradict the "in production" count showing it there instead. This was caught by a test during this round (`buildClientDashboard`'s first isolation test), not assumed correct — see `src/modules/client-portal/core.test.mjs`.

**Deliberately not shown:** "created this week" (too easily conflated with "completed this week") and "worked on this week" (would require exposing Work Session data, which is private regardless of framing).

**Unknown ≠ zero**, honored two ways: a video with no `contentType` is counted in `unclassifiedCompletedCount`, a distinct field from any real content-type bucket — the dashboard never presents "0 long-form videos" when the true state is "not classified yet." Zero videos overall renders one honest empty state, not six empty sections.

## 3. Video visual metadata rules

Three new nullable `video_logs` columns, additive migration `0015_fixed_slipstream.sql`:

- `cover_url` (text, HTTPS-only, same validator as `delivery_url`)
- `orientation` (`LANDSCAPE` | `VERTICAL` | `SQUARE`, DB `CHECK` constraint + TS type guard)
- `content_type` (`short-form` | `long-form` | `mini-doc` | `testimonial` | `other` — deliberately the *same* vocabulary as the existing Gateway `SERVICE_INTEREST_OPTIONS`, not a second invented taxonomy)

All three default to `NULL` and are only ever set explicitly by the operator on the existing Video edit surface (`VideoEditor.tsx` — extended, not duplicated into a separate "admin metadata manager"). Nothing infers orientation or content type from a title string or filename.

Card rendering (`src/app/client/dashboard/VideoCard.tsx`) picks a fixed-aspect container by orientation (`aspect-video` for landscape/unknown, `aspect-[9/16]` capped at `max-h-80` for vertical, `aspect-square` for square) with `object-cover` — a 9:16 asset cannot stretch a mobile card to 900px tall. A missing cover renders a placeholder, never a broken image or blank space. Images are rendered `unoptimized` (no server-side fetch/proxy of an arbitrary client-supplied URL — the browser fetches it directly), which sidesteps SSRF risk from the image path entirely rather than requiring a remote-pattern allowlist.

## 4. Private data boundary

Unchanged from the boundary already documented in the Sunday Systems Round report, reconfirmed rather than re-derived: Work Session duration/ActivityWatch/operator productivity, internal revenue/margin/finance, internal CRM notes, raw Video Memory / Session Narrative notes, health data, internal lead intelligence, another client's data, raw `crm_events`. The new `ClientIntelligenceSummary` type (from the prior round) is explicitly internal-only and was not touched or exposed this round.

## 5. Known gaps

- Password reset has no real email delivery in this environment (see §1). Production-blocking until a provider is wired in.
- `DONE` → labeled "Delivered" to the client is still just "the operator marked it finished," not a separately-confirmed delivery event. Documented in the prior round's report, not resolved here — out of scope for this round's auth/identity focus.
- `clients.email` has no DB-level uniqueness constraint (it's free-text CRM data, not a signup field). Ambiguity is guarded in application code at both write time (`setClientPortalPassword`) and read time (`verifyClientCredentials`), not by a schema constraint. A future round could add a partial unique index scoped to `portal_password_hash IS NOT NULL` if this ever becomes a real operational pain point — not done here to avoid a schema change unjustified by current data.
- No automated authorization test exercises `transitionVideoStatusAsClient`'s ownership check or `requireClientAuth`'s cross-client redirect end-to-end, because both depend on `next/headers`/`next/navigation` request context that this codebase's existing test harness (node:sqlite fixtures, no Next runtime) doesn't mock anywhere else either — the admin equivalents (`requireAuth`, `isAuthenticated`) have never had this kind of test either. What *is* tested: the signed-token layer underneath both (tamper/expiry/cross-version rejection), and the pure projection/ownership-filtering logic those functions delegate to. This is a real coverage gap, not hidden — see the round report's TESTS section.
- Visual/responsive QA (Phase 12/13) is structural only — verified in source (aspect-ratio containers, `min-h-10`/`min-h-11` touch targets, Tailwind breakpoint usage matching the rest of the app) but never rendered in an actual browser against the running app, because this sandbox cannot reliably hold a `next dev`/`next build` process alive across tool calls (a previously-documented environment limitation, reconfirmed this round). Do not read "structural QA passed" as "visually verified."

## 6. Deferred (not built this round)

Everything on the brief's explicit "do NOT build" list (event bus, websockets, generic RBAC, org/multi-tenant abstractions, chat, comments, notifications, AI insights, DAM, billing, third-party integrations) — none of it was needed for identity/intelligence/delivery and none of it was started. Also deferred, listed as P2 in the round report: full taxonomy UI polish for unclassified legacy videos, a bulk operator tool for setting cover/orientation/content-type across many videos at once, and any self-serve client signup flow (Door B stays operator-issued only, matching this business's actual onboarding process).
