# Pre-Dogfood Hardening + 09AM Steering — 09 Oct 2026

## Authority and scope

This closure resumes the local candidate based on `ef50e1fdf1993a44250ba222365bfb9b61c0423e` and applies only the evidence-backed hardening authorized before Dogfood 02. It does not reopen Great Reset strategy, add a parallel owner, change schema, migrate or mutate production.

## Hardening result

### Daily Operating Reality

- Work Sessions remain the only intentional-work authority and preserve `CLIENT`, `INTERNAL`, `ADMIN` and `LEAD` separately.
- Sensor remains observation authority for foreground apps, idle, temporal coverage and aggregate input telemetry.
- `getDailyRealityCoverage` now reports:
  - `NO_EVIDENCE` when neither source exists;
  - `PARTIAL` when only one source exists or Session time lacks Sensor coverage;
  - `COMPLETE` only when both sources exist and intentional time is fully covered.
- Missing input telemetry renders `Input telemetry not captured`, never a fabricated zero.
- Local Safari QA at a normal desktop viewport passed both the empty-day state and an exact temporary partial-coverage fixture. Empty visibly says `NO EVIDENCE`, `No Session`, `No Sensor app evidence today`; partial visibly says `30m` canonical CLIENT work, `20m` Premiere observation, `67%` coverage and `10m` intentional time without Sensor evidence. The fixture was guard-deleted and all six QA rows returned to zero.
- Automated coverage proves Sensor + Sessions, Sensor-only, Session-only, partial day, empty day, internal work, client work, lead work, idle and missing input telemetry.

### Project / Video lifecycle invariant

The current architecture supports this explicit invariant:

- an `active` or `review` Project may contain all-DONE Videos because Project closure is a separate decision;
- a `delivered` Project may not contain a non-DONE, non-cancelled, non-container deliverable because delivered Projects are otherwise projected as completed and removed from Current;
- an `archived` Project may intentionally preserve incomplete historical work.

The candidate:

- blocks future `delivered` transitions while an eligible child remains open;
- reports `DELIVERED_PROJECT_OPEN_VIDEO` in relationship integrity;
- ranks the mismatch above ordinary Project exceptions;
- keeps the Project in Current and removes it from Completed;
- shows a client-safe `Active` Project label while an owned child remains open.

Production was inspected read-only. Taryn's preview currently says `0 active projects` while showing `Front Door Video 1 · In production` inside `GEOFF - September Long Form Videos`; this confirms the known Project 19 mismatch. No remote row was changed because Cloudflare authority could not be freshly verified.

### Delivery ledger usability

The existing immutable `deliveries` ledger remains the canonical owner. The candidate adds no table and no alternate delivery model.

- The Video workspace shows recent versions and their labels/URLs.
- The ordinary action explicitly creates the next version (`Record delivery vN`).
- A label such as `Final export` uses the existing delivery note field.
- The server continues to assign version and timestamp, append history, preserve prior rows and leave Video lifecycle unchanged.
- Client/CRM projections are revalidated after the append.
- UI copy states that a new delivery version does not imply client approval.

## Taryn DFY portal audit

### ALREADY GOOD

- One canonical Taryn relationship remains visible operator-side; `Taryn DFY` is shown as operational context/alias rather than a second client.
- Portal access is active. Review and priority capabilities are visible; financial summary is hidden.
- The authenticated client dashboard and the operator's exact client-safe preview expose only two current items: `Front Door Video 1` in production and `Offer Doc` delivered.
- Current content, status, latest watch link, priority control and recent delivery are legible at a normal desktop viewport.
- The authenticated video detail contract already supports review/changes, Recipe progress, delivery availability and an approved Quote when one exists.
- No Work Session, Sensor, key/mouse, idle, private note, fee, margin or internal profitability data appeared in the preview.

### POLISH

- The overview is compact and understandable, but `DIRECT` versus `DFY` is not explained client-side. This is not automatically a defect: the client should see one relationship and the relevant work, not internal allocation terminology.

### REAL GAP

- Project 19's delivered/open-child contradiction produces `0 active projects` beside an in-production Video. The hardening candidate fixes the projection and future invariant, but the current production row still requires a guarded reconciliation after authority is restored.
- The preview does not expose immutable delivery-version history; it exposes the current safe URL. The operator ledger is now usable, but a client-history projection remains a separate evidence-backed decision.

### OPERATOR-ONLY

- Direct/DFY hour split, external registered time, platform fees, received cash, internal notes, source paths and evidence completeness remain operator-only.

### NEEDS CLIENT EVIDENCE

- Whether Taryn wants delivery-version history, a direct/DFY explanation or quality comparisons in daily use.

## Quality Evidence feasibility

Real Dogfood 01 material was inspected:

- color before: PNG, 1920×1080, SHA-256 `6e573325e31fcf244ad580381565e9157a2755ec0a8d83ace32470defaf23dd3`;
- color after: PNG, 1920×1080, SHA-256 `603d810da1ad09576f14b88e58d80b605617b7b58f9c561443ae3b35d18c86cb`;
- audio before: MP3, 48 kHz stereo, 1073.645333 seconds, SHA-256 `75e6ba988ea06a0f49f019fff4db2709101793cc86e040a820a23c2e0eab1677`;
- audio after: MP3, 48 kHz stereo, 1073.645333 seconds, SHA-256 `51aec56ac6f5a8086676ebe2e800b413064c427a41138205628f92e1d78d5e32`.

Existing Assets can point to provider-independent HTTPS references and can belong to a Video, but they do not canonically express:

- before/after pair identity;
- comparison type;
- compatible frame/time context;
- operator-private versus client-approved evidence;
- client-safe media URLs for these local files.

Therefore a comparison UI was **not implemented**. Encoding pairing in names/notes would create a hidden parallel contract, and local filesystem existence cannot become canonical Delivery or client proof automatically. The evidence enriches the existing reusable-artifact / quality-evidence thread; it does not justify a no-schema shortcut.

## Video economics contract

- Finance owns contracts, billing evidence, allocations, fees and received transactions.
- Work Sessions own intentional production time.
- A Video may expose agreed value only through a real approved Quote or explicit billing allocation.
- Operator projection may show attributable agreed/billed/received/outstanding/time figures; absent attribution remains `UNKNOWN`.
- Taryn is hourly via Upwork. Her relationship evidence is not a defensible per-Video price. No amount should be divided across Videos by count, Sensor duration or Session duration.
- Client projection should keep financials hidden unless the existing capability is deliberately enabled and the underlying evidence is attributable.

## Stage / tool intelligence contract

Delivery Recipe events already preserve ordered transitions and `occurred_at`. Work Sessions preserve intentional intervals. Sensor can provide app/window observation.

Defensible future stage time requires Recipe interval × canonical Work Session overlap, with coverage disclosed. `Safari` or `Firefly` observation alone cannot define image-generation work. Dogfood 02 must produce real Recipe transitions before a derived read model is justified.

## Email action custody

`email_contacts` correctly owns outreach contacts without promoting them to CRM. `crm_events` owns Client/Lead events, not Email Contact history, and there is no canonical Campaign/Email Action owner today.

`TARGETED`, `SENT`, `REPLIED`, `INTERESTED`, `NO_RESPONSE`, `BOUNCED`, `DNC` and `CONVERTED` cannot be added truthfully as contact statuses: they are time-stamped events and several are non-terminal. A future bounded event ledger may be warranted, but reusing contact state or CRM events would duplicate authority. No sender, automation, promotion or vocabulary patch was added.

## Authentication recommendation

Current production already has two secure paths:

- persistent email/password login with reset and rate limiting;
- revocable/expiring secure portal capability link requiring no password.

The login page explicitly tells the client to open the secure link directly. Taryn's portal access is active. No reproduced login blocker exists. Slack OTP would add an external dependency while duplicating a working secure-link pattern, so the recommendation is **NO CHANGE** until client friction is observed.

## Release delta and rollback

### Exact delta

- Daily coverage semantics and missing-input copy.
- Delivered/open-deliverable invariant in Project action, views, integrity and client-safe label.
- Existing Delivery ledger made visible and append-version action made explicit.
- Tests only; no schema, migration, seed or production-data mutation.

### Promotion gate

1. Restore and verify Cloudflare account/resource authority.
2. Verify production D1 head remains `0058`, take a fresh backup and run read-only baseline checks.
3. Deploy the exact candidate only after source authority matches.
4. Reconcile Project 19 through the existing guarded Project action; do not hardcode or rewrite Video history.
5. Smoke Dashboard, Projects, Video workspace and Taryn preview; run FK/quick checks.

### Rollback

- Code: restore the currently deployed Worker version `85a7dfcf-aec2-4455-8bc7-b47853c44b44` if promotion introduces a concrete regression.
- Data: this wave made no production write, so there is no data rollback now. Any later Project 19 status correction must be recorded as a guarded, reversible lifecycle action after backup.

## Gates

- Focused tests: 103/103 GREEN.
- Full suite: 1,624/1,624 GREEN.
- Typecheck: GREEN.
- Production build: GREEN.
- Lint: 0 errors; 3 pre-existing warnings.
- Local D1: existing migration `0058` applied locally for QA; `foreign_key_check` empty; `quick_check = ok`.
- New migration/schema: none.
- Production deploy/write: none.
- Remote authority: BLOCKED by Cloudflare error 7403 before SQL execution.

One unrelated local-dev observation remains outside this wave: the operator CRM emitted a hydration warning because server and Safari formatted the same capacity timestamp with different locales. It did not appear on the Dashboard or the production client preview and is not evidence of a Taryn portal regression; preserve as repeat evidence instead of expanding this closure.

## Next gate

Dogfood 02 remains the next real validation: attach a Delivery Recipe from the start of one real Video and record only genuine stage transitions while editing.
