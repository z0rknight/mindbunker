import {
  check,
  foreignKey,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { OPPORTUNITY_STAGES } from "../modules/gateway/config";
import { QUOTE_STATUSES, DEFAULT_QUOTE_CURRENCY } from "../modules/quotes/config";
import {
  BOOKING_STATUSES,
  CALENDAR_PROVIDERS,
  DEFAULT_BOOKING_SETTINGS,
} from "../modules/booking/config";
import { PROJECT_STATUSES } from "../modules/projects/config";
import {
  VIDEO_CONTENT_TYPES,
  VIDEO_ORIENTATIONS,
  VIDEO_STATUSES,
} from "../modules/productivity/config";
import { ASSET_TYPES, ASSET_STATUSES } from "../modules/assets/config";

// ─── PRIVATE ACCESS ──────────────────────────────────────────────────────────

export const authAttempts = sqliteTable("auth_attempts", {
  fingerprint: text("fingerprint").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStarted: integer("window_started").notNull(),
  blockedUntil: integer("blocked_until"),
});

// ─── FINANCE MODULE ───────────────────────────────────────────────────────────

// Monday Money Lab P0: `type` gains "owner_pay" -- money leaving RMEDIA
// cash for the owner's personal use. Deliberately NOT "expense": Owner Pay
// is neither a business operating cost nor revenue (see
// docs/architecture/MONDAY_MONEY_LAB_P0.md, "Three Truths" + RMEDIA cash
// flow) -- collapsing it into "expense" would misclassify it in every
// existing expense total this app has ever computed. `currency` is now
// explicit per money-movement row (never silently normalized); the
// migration backfills existing rows as "USD" because that has always been
// the only currency this table's UI (formatCurrency) has ever written or
// displayed -- making an always-true implicit fact explicit, not guessing.
// `billingEvidenceId` is optional provenance: set only when this money
// event is known to fulfill a specific piece of external billing evidence
// (see billingEvidence below) -- an income transaction with no link is
// still perfectly valid, just less traceable.
// Monday Pre-Freeze Consolidation §6/§19/§20: a Freelance income row must
// name who paid it (clientId) and, where a contract exists, which one
// (contractId) -- billingEvidenceId stays optional/preferred, never
// required, because one cash event may cover a period no evidence row has
// been registered for yet, or a lump sum spanning multiple evidence rows.
// debtId/subscriptionId let a debt or subscription PAYMENT be an ordinary
// expense transaction carrying that provenance, rather than a second,
// disconnected ledger -- see debts/subscriptions below: remaining debt
// balance and subscription payment history are both derived by summing
// transactions against these ids, never stored as a separately-mutated
// column that could drift from the real ledger.
export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["income", "expense", "owner_pay"] }).notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    date: text("date").notNull(), // ISO date string YYYY-MM-DD
    notes: text("notes"),
    currency: text("currency").notNull().default("USD"),
    billingEvidenceId: integer("billing_evidence_id").references(
      () => billingEvidence.id,
      { onDelete: "set null" },
    ),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),
    contractId: integer("contract_id").references(
      () => commercialContracts.id,
      { onDelete: "restrict" },
    ),
    debtId: integer("debt_id").references(() => debts.id, {
      onDelete: "restrict",
    }),
    subscriptionId: integer("subscription_id").references(
      () => subscriptions.id,
      { onDelete: "restrict" },
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    // Taryn August Ingest Readiness §2/§12: a client-generated, per-submit
    // idempotency key for user-initiated "record one charge/payment" flows
    // (Subscription Record Charge, Debt Record Payment). Distinct from
    // billing_evidence.idempotencyKey (a deterministic content hash used
    // to dedupe re-imports of the SAME evidence) -- this is a random key
    // minted once per form-open, so a double-click/double-submit of the
    // same intended action cannot insert two transactions. Nullable and
    // unused by ordinary addTransaction/addExpense flows; SQLite's unique
    // index permits unlimited NULLs, so it only constrains rows that
    // opted in.
    idempotencyKey: text("idempotency_key"),
    // Source identity is distinct from UI-submit idempotency above. A Wise
    // event can be attached to an existing canonical row (for example a
    // subscription charge that already has a submit key) without erasing
    // that row's original replay protection.
    externalSource: text("external_source"),
    externalId: text("external_id"),
  },
  (table) => [
    check(
      "transactions_type_check",
      sql`${table.type} in ('income', 'expense', 'owner_pay')`,
    ),
    index("transactions_billing_evidence_idx").on(table.billingEvidenceId),
    index("transactions_client_idx").on(table.clientId),
    index("transactions_debt_idx").on(table.debtId),
    index("transactions_subscription_idx").on(table.subscriptionId),
    uniqueIndex("transactions_idempotency_key_idx").on(table.idempotencyKey),
    uniqueIndex("transactions_external_identity_idx").on(
      table.externalSource,
      table.externalId,
    ),
    // §6 hard invariant: a Freelance income row can never be an orphan.
    check(
      "transactions_freelance_requires_client_check",
      sql`${table.type} != 'income' or lower(${table.category}) != 'freelance' or ${table.clientId} is not null`,
    ),
  ],
);

// ─── HEALTH MODULE ────────────────────────────────────────────────────────────

export const healthLogs = sqliteTable("health_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // ISO date YYYY-MM-DD, one per day
  sleepHours: real("sleep_hours"),
  caffeineMg: integer("caffeine_mg"),
  substancesNotes: text("substances_notes"),
  screenTimeHours: real("screen_time_hours"),
  cyclingKm: real("cycling_km"),       // km cycled
  cyclingMinutes: integer("cycling_minutes"), // duration in minutes
  walkingMinutes: integer("walking_minutes"), // walking duration in minutes
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── CRM MODULE ───────────────────────────────────────────────────────────────

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["lead", "active", "inactive"] }).notNull().default("lead"),
  email: text("email"),
  phone: text("phone"),
  instagramUsername: text("instagram_username"),
  instagramBio: text("instagram_bio"),
  instagramProfilePictureUrl: text("instagram_profile_picture_url"),
  instagramProfileUpdatedAt: integer("instagram_profile_updated_at", {
    mode: "timestamp",
  }),
  notes: text("notes"),
  totalProjects: integer("total_projects").notNull().default(0),
  totalRevenue: real("total_revenue").notNull().default(0),
  source: text("source"), // for leads: where they came from
  contacted: integer("contacted", { mode: "boolean" }).notNull().default(false),
  converted: integer("converted", { mode: "boolean" }).notNull().default(false),
  // Geladeira (Sprint 1.2 P0): reversible operational archival/visibility
  // state, orthogonal to `status`/`opportunityStage`/`converted`/`contacted`.
  // Entering Geladeira never changes any of those fields or any child row —
  // it only controls default visibility on operational surfaces. See
  // docs/architecture/GELADEIRA_DOMAIN_PROTOTYPE.md for the full domain
  // rationale.
  archivalState: text("archival_state", {
    enum: ["ACTIVE_SURFACE", "GELADEIRA"],
  })
    .notNull()
    .default("ACTIVE_SURFACE"),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  opportunityStage: text("opportunity_stage", {
    enum: OPPORTUNITY_STAGES,
  })
    .notNull()
    .default("new"),
  serviceInterest: text("service_interest"),
  qualificationNotes: text("qualification_notes"),
  nextAction: text("next_action"),
  nextActionDate: text("next_action_date"),
  lastInteractionAt: integer("last_interaction_at", { mode: "timestamp" }),
  // Client Portal Identity (Sprint 1.2.2): persistent client account,
  // orthogonal to the Gateway capability-token model below -- a client can
  // authenticate either way, but both paths resolve through the same
  // authorization boundary and the same client-safe projection. Null
  // portalPasswordHash means "no persistent account set up yet" -- the
  // client still has the token-link fallback, never a locked door.
  portalPasswordHash: text("portal_password_hash"),
  portalPasswordSetAt: integer("portal_password_set_at", { mode: "timestamp" }),
  // Single-slot reset token, mirroring the work_sessions_one_open_idx /
  // hist_import_batches_one_active_idx "at most one live X" pattern already
  // used elsewhere in this schema -- a new reset request simply overwrites
  // the previous one rather than needing its own table.
  portalResetTokenHash: text("portal_reset_token_hash"),
  portalResetExpiresAt: integer("portal_reset_expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const gatewayInvitations = sqliteTable(
  "gateway_invitations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    openedAt: integer("opened_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("gateway_invitations_token_hash_unique").on(table.tokenHash),
    index("gateway_invitations_client_id_idx").on(table.clientId),
  ],
);

export const intakeSubmissions = sqliteTable(
  "intake_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    invitationId: integer("invitation_id")
      .notNull()
      .references(() => gatewayInvitations.id, { onDelete: "cascade" }),
    serviceInterest: text("service_interest").notNull(),
    projectSummary: text("project_summary").notNull(),
    objective: text("objective").notNull(),
    contentVolume: text("content_volume"),
    references: text("references"),
    timeline: text("timeline"),
    existingAssets: text("existing_assets"),
    notes: text("notes"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("intake_submissions_invitation_id_unique").on(
      table.invitationId,
    ),
    index("intake_submissions_client_id_idx").on(table.clientId),
  ],
);

export const crmEvents = sqliteTable(
  "crm_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    videoId: integer("video_id").references(() => videoLogs.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    // "client" (Sprint 1.2.2): an authenticated client themselves took the
    // action (e.g. approved a video, requested changes) -- distinct from
    // "gateway" (an unauthenticated capability-link visitor submitting a
    // briefing) and "admin" (Emmanuel). This is a TypeScript-level
    // constraint only, same as the other three values already were -- no
    // SQL CHECK exists on this column, so adding a value here is not a
    // migration.
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] })
      .notNull()
      .default("system"),
    description: text("description").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    // Sprint 3 (/book public intake): a client-minted idempotency key so a
    // double-click/double-submit of the public booking-request form cannot
    // log the same submission twice. Same nullable-unique-index pattern as
    // transactions.idempotencyKey -- SQLite permits unlimited NULLs in a
    // unique index, so this only constrains the /book flow that opts in;
    // every other crm_events writer is unaffected.
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    index("crm_events_client_created_idx").on(table.clientId, table.createdAt),
    index("crm_events_video_created_idx").on(table.videoId, table.createdAt),
    uniqueIndex("crm_events_idempotency_key_idx").on(table.idempotencyKey),
  ],
);

// Client Service Reality Patch (25 Aug 2026): Emmanuel's commercial offer
// to a client, hand-logged from a Pricing Lab calculation (see
// modules/quotes/config.ts's header for the full rationale). Additive,
// standalone -- references clients/projects/videoLogs but nothing
// references it back, so it cannot break any existing query.
export const quotes = sqliteTable(
  "quotes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    status: text("status", { enum: QUOTE_STATUSES }).notNull().default("DRAFT"),
    currency: text("currency").notNull().default(DEFAULT_QUOTE_CURRENCY),
    amountCents: integer("amount_cents").notNull(),
    contentTypeLabel: text("content_type_label").notNull(),
    turnaroundLabel: text("turnaround_label").notNull(),
    revisionsIncluded: integer("revisions_included").notNull(),
    summary: text("summary"),
    scopeText: text("scope_text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    declinedAt: integer("declined_at", { mode: "timestamp" }),
    // Set once "Create production work" runs after approval -- never set
    // before APPROVED (enforced at the action layer, not by a DB
    // constraint, same discipline as personal_transactions' protected
    // types). A quote can exist with neither set (not yet actioned), or
    // both (the canonical production this quote authorized).
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    videoId: integer("video_id").references(() => videoLogs.id, {
      onDelete: "set null",
    }),
    // Reality Closure (26 Aug 2026) P0: the Video Commercial Terms panel
    // must be able to say "Approved Quote" vs "Manual Commercial Terms"
    // (brief's exact wording) -- a quote created by the full public
    // /quoteavideo -> DRAFT -> SENT -> APPROVED flow vs one Emmanuel
    // records directly from an existing Video workspace for a deal that
    // predates/bypassed that flow (e.g. Dave's fixed $100, agreed before
    // this system existed). Both are equally real APPROVED commercial
    // records in the same table -- this is a label on provenance, not a
    // second price model.
    origin: text("origin", { enum: ["INTAKE", "MANUAL"] })
      .notNull()
      .default("INTAKE"),
  },
  (table) => [
    index("quotes_client_id_idx").on(table.clientId),
    index("quotes_status_idx").on(table.status),
    index("quotes_video_id_idx").on(table.videoId),
    check("quotes_origin_check", sql`${table.origin} in ('INTAKE', 'MANUAL')`),
  ],
);

export const bookingSettings = sqliteTable("booking_settings", {
  id: integer("id").primaryKey().default(DEFAULT_BOOKING_SETTINGS.id),
  enabled: integer("enabled", { mode: "boolean" })
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.enabled),
  timezone: text("timezone")
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.timezone),
  durationMinutes: integer("duration_minutes")
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.durationMinutes),
  bufferMinutes: integer("buffer_minutes")
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.bufferMinutes),
  minimumNoticeHours: integer("minimum_notice_hours")
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.minimumNoticeHours),
  bookingHorizonDays: integer("booking_horizon_days")
    .notNull()
    .default(DEFAULT_BOOKING_SETTINGS.bookingHorizonDays),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const availabilityWindows = sqliteTable(
  "availability_windows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekday: integer("weekday").notNull(),
    enabled: integer("enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("availability_windows_weekday_unique").on(table.weekday),
  ],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    invitationId: integer("invitation_id")
      .notNull()
      .references(() => gatewayInvitations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CALENDAR_PROVIDERS })
      .notNull()
      .default("mock"),
    providerEventId: text("provider_event_id").notNull(),
    status: text("status", { enum: BOOKING_STATUSES })
      .notNull()
      .default("confirmed"),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
    slotKey: text("slot_key"),
    visitorTimezone: text("visitor_timezone").notNull(),
    attendeeEmail: text("attendee_email").notNull(),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("bookings_slot_key_unique").on(table.slotKey),
    uniqueIndex("bookings_provider_event_id_unique").on(table.providerEventId),
    index("bookings_client_created_idx").on(table.clientId, table.createdAt),
    index("bookings_invitation_created_idx").on(
      table.invitationId,
      table.createdAt,
    ),
    index("bookings_status_starts_idx").on(table.status, table.startsAt),
  ],
);

// ─── PRODUCTIVITY MODULE ──────────────────────────────────────────────────────

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status", { enum: PROJECT_STATUSES })
      .notNull()
      .default("planned"),
    deadline: text("deadline"),
    notes: text("notes"),
    // Wave 2E: single-slot "what's next / what are we waiting for" --
    // deliberately not a task manager, one nullable field each,
    // overwritten in place, no history table.
    nextAction: text("next_action"),
    waitingOn: text("waiting_on"),
    // Wave 2G (Economics prototype): rough, optional. Null contractType
    // means "not classified yet" -- existing projects are not assumed to
    // be either fixed or hourly.
    contractType: text("contract_type", { enum: ["FIXED", "HOURLY"] }),
    fixedPriceCents: integer("fixed_price_cents"),
    // Post-Job Commercial + Delivery Sniper §1: explicit, operator-set
    // link to the canonical commercial_contracts table (Monday Money Lab
    // P0's BILLING TRUTH, defined further below in this file -- forward
    // reference is safe, same pattern already used by
    // transactions.contractId elsewhere in this file). Distinct from
    // contractType/fixedPriceCents above (the disconnected Local Lab
    // "Economics prototype", left untouched): this is the real, reusable
    // Finance/Contracts domain. Nullable -- existing projects stay
    // unattributed until an operator explicitly links one, never
    // inferred. onDelete: set null so removing a contract record can
    // never cascade-delete project history.
    contractId: integer("contract_id").references(() => commercialContracts.id, { onDelete: "set null" }),
    // Sprint 3 P1 (Project + Video visual covers): nullable, never
    // backfilled by inference -- same convention as videoLogs.coverUrl
    // above. A Project with no coverUrl falls back through
    // Project -> its most recent Video's cover -> the client's avatar ->
    // a neutral placeholder (resolved in modules/media/core.ts, not
    // stored here).
    coverUrl: text("cover_url"),
    // Wave 4E (Local Lab): canonical, project-level tags. Comma-separated
    // plain text on purpose -- "simple strings are enough locally", no
    // taxonomy table. Videos inherit these by default (see
    // videoLogs.tagsOverride below) and can add/remove locally.
    tags: text("tags"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    index("projects_client_status_idx").on(table.clientId, table.status),
    index("projects_deadline_idx").on(table.deadline),
  ],
);

export const videoLogs = sqliteTable(
  "video_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // ISO date YYYY-MM-DD
    title: text("title"),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: VIDEO_STATUSES })
      .notNull()
      .default("PLANNED"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    revisionsCount: integer("revisions_count").notNull().default(0),
    delivered: integer("delivered", { mode: "boolean" })
      .notNull()
      .default(true),
    deliveryUrl: text("delivery_url"),
    // Monday Real-Operation Pre-Freeze §5/§6 — provider-independent review
    // and publish links. reviewUrl today may point at Frame.io, deliveryUrl
    // at Google Drive -- the schema names the CONCEPT (review vs delivery
    // vs published), never the provider, so tomorrow's tool swap needs no
    // migration. READY_FOR_REVIEW is this repo's existing name for the
    // concept the brief calls AWAITING_CLIENT_APPROVAL (see
    // VIDEO_STATUS_TRANSITIONS in modules/productivity/config.ts, already
    // gated PLANNED/IN_PROGRESS -> READY_FOR_REVIEW -> DONE/CHANGES_REQUESTED)
    // -- reusing it rather than adding a second, overlapping status.
    //
    // The "review URL required before READY_FOR_REVIEW" invariant is
    // enforced in modules/productivity/core.ts (validateVideoStatusTransition)
    // and every write path (see actions.ts), NOT as a DB-level CHECK: D1
    // always enforces foreign keys and cannot honor `PRAGMA foreign_keys=OFF`
    // during a migration, so the standard SQLite "recreate table to add a
    // CHECK constraint" strategy fails with SQLITE_CONSTRAINT_TRIGGER on
    // any table other rows reference by FK (video_logs has 5+ FK
    // referrers: work_sessions, sensor_sessions, billing_allocations,
    // reconciliation_notes, assets). App-level enforcement at every write
    // path is the honest tradeoff here, not a schema lie -- see
    // docs/architecture/MONDAY_REAL_OPERATION_PRE_FREEZE.md.
    reviewUrl: text("review_url"),
    publishedUrl: text("published_url"),
    // Post-Job Commercial + Delivery Sniper §1: explicit, video-specific
    // override of the project's contractId -- resolution order is this
    // field first, then the parent project's contractId, then (legacy,
    // preserved unchanged) the client's single ACTIVE HOURLY
    // commercial_contracts row that getCommercialTermsForVideo already
    // fell back to before this column existed. Same nullable/never-
    // inferred discipline as projects.contractId above.
    contractId: integer("contract_id").references(() => commercialContracts.id, { onDelete: "set null" }),
    notes: text("notes"),
    // Wave 2E: same single-slot next-action/waiting-on pattern as
    // projects.nextAction/waitingOn above -- see that comment.
    nextAction: text("next_action"),
    waitingOn: text("waiting_on"),
    // Video visual metadata (Sprint 1.2.2 Client Portal round). All three
    // are nullable and never backfilled by inference -- a legacy video
    // simply has no cover/orientation/contentType until the operator sets
    // one on the existing Video edit surface (single canonical write path,
    // no separate admin metadata manager).
    coverUrl: text("cover_url"),
    orientation: text("orientation", { enum: VIDEO_ORIENTATIONS }),
    contentType: text("content_type", { enum: VIDEO_CONTENT_TYPES }),
    // Brief C ("Final Local Ingest / Live Readiness") §6: lightweight,
    // nullable batch identity. Videos created together in one bulk-ingest
    // submission may share an operator-entered label (e.g. "Content
    // Waterfall — Batch 1"). Deliberately a scalar column, not a batches
    // table -- no batch analytics/throughput/dashboards are built on top
    // of this in this round; see docs/architecture/FINAL_LOCAL_LIVE_READINESS.md.
    batchLabel: text("batch_label"),
    // Lunch Reality Patch P1 §7: a single client-settable "priority now"
    // video per project. Plain boolean, not a rank/order integer -- only
    // ever one thing to express ("this is the one I need right now"), not
    // a general ordering. The "only one true per project" invariant is
    // enforced at the action layer (setVideoPriorityAsClient in
    // modules/productivity/actions.ts: clear the project's other rows,
    // then set this one), not a DB constraint -- SQLite has no native
    // "unique true per group" constraint short of a partial unique index,
    // and the write path already fully owns this invariant.
    isPriority: integer("is_priority", { mode: "boolean" })
      .notNull()
      .default(false),
    // Wave 4E (Local Lab): video inherits its Project's tags by default.
    // tagsOverride is JSON-encoded {added: string[], removed: string[]} --
    // never stores the resolved tag set itself, so a Project tag edit
    // still propagates to every Video that hasn't locally removed it. Null
    // means "no local overrides, pure inheritance". Resolution happens in
    // app code (modules/tags/core.ts), not here.
    tagsOverride: text("tags_override"),
    // Wave 4H (Local Lab): explicit classification, separate from the
    // canonical `status` state machine above (deliberately -- same reason
    // Wave 2's Lifecycle overlay never touched `status`: this is a rough
    // lab classification, not a production state-machine change).
    // CLIENT_WORK is the default so every pre-existing video stays
    // truthfully classified as real client work, never silently
    // reclassified.
    videoKind: text("video_kind", {
      enum: ["CLIENT_WORK", "SAMPLE_VIDEO", "INTERNAL", "OTHER"],
    })
      .notNull()
      .default("CLIENT_WORK"),
    // Wave 4G (Local Lab): Video Idea / Pitch, reusing the existing Video
    // model rather than a separate object, per instruction. Null
    // ideaStage means "not an idea -- an ordinary production video",
    // which is every pre-existing row and stays that way until an
    // operator explicitly creates a pitch. IDEA -> PROPOSED -> APPROVED;
    // "approved" simply clears ideaStage back to null (the row was always
    // a real video_logs row, so it needs no conversion step).
    ideaStage: text("idea_stage", { enum: ["IDEA", "PROPOSED", "APPROVED"] }),
    pitch: text("pitch"),
    intendedFormat: text("intended_format"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    index("video_logs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("video_logs_client_created_idx").on(table.clientId, table.createdAt),
    index("video_logs_project_priority_idx").on(
      table.projectId,
      table.isPriority,
    ),
    check(
      "video_logs_orientation_check",
      sql`${table.orientation} is null or ${table.orientation} in ('LANDSCAPE', 'VERTICAL', 'SQUARE')`,
    ),
    check(
      "video_logs_content_type_check",
      sql`${table.contentType} is null or ${table.contentType} in ('short-form', 'long-form', 'mini-doc', 'testimonial', 'other')`,
    ),
  ],
);

// Pre-Operation Reality Hardening §7: revisions AS HISTORICAL FACTS.
// videoLogs.revisionsCount above is a mutable integer -- correcting it
// (RevisionControls' "-" button) rewrites history in place, which is fine
// for a running tally but destroys the provenance future unit-economics
// analytics need (revision drag, revision frequency, revision timestamps).
// This table is the new source of truth for THAT: one row per revision
// event, append-mostly, independently auditable per video.
//
// videoLogs.revisionsCount is NOT removed -- it remains a derived
// cache/compatibility field (existing UI reads it directly in several
// places; recomputing it from a join everywhere would be a much bigger
// change than this hardening round calls for). The canonical action
// (recordRevisionAdded/undoLastRevision in modules/productivity/actions.ts)
// keeps the two in sync atomically on every write. Existing legacy videos
// with revisionsCount > 0 and zero rows here are a known, accepted gap --
// see that action's comment for why no historical rows are manufactured
// to "fill in" a legacy count.
export const revisions = sqliteTable(
  "revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videoLogs.id, { onDelete: "cascade" }),
    note: text("note"),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] })
      .notNull()
      .default("admin"),
    // September Local Feature Harvest (Cluster E -- QA/Rework Provenance):
    // who/what caused this revision round. TS-level enum only, no CHECK --
    // same reasoning as crm_events.actor and work_sessions.source above:
    // this vocabulary is expected to grow, and SQLite/D1 cannot cheaply
    // ALTER a CHECK on an existing table. UNKNOWN is the default so every
    // pre-existing revision row (and any caller that hasn't been updated
    // yet) stays truthfully unclassified rather than silently defaulting
    // into a specific blame bucket.
    causedBy: text("caused_by", {
      enum: ["UNKNOWN", "OUR_ERROR", "CLIENT_CHANGE", "SCOPE_CHANGE"],
    })
      .notNull()
      .default("UNKNOWN"),
    // Wave 4I (Local Lab): concise revision detail. `category` is a rough,
    // open-ended label (AUDIO/COLOR/CAPTIONS/etc -- same open-vocabulary,
    // no-CHECK convention as causedBy above), `minutesRework` an optional
    // operator estimate. `note` (already existed) carries the free-text
    // "what was corrected" description -- no new text column needed for
    // that half.
    category: text("category"),
    minutesRework: integer("minutes_rework"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("revisions_video_created_idx").on(table.videoId, table.createdAt)],
);

// September Local Feature Harvest (Cluster A -- shared primitive): ONE
// commitment/promise-tracking table used across Clients, Projects, and
// Videos rather than three bespoke "next action" fields bolted onto three
// different tables. `clients.nextAction`/`nextActionDate` (added earlier)
// stay as-is -- this table is additive, for anything that isn't a
// client-relationship next-action specifically (project deadlines the
// operator promised, video-level promises like "send draft cut Friday").
// ownerType/ownerId is a deliberate polymorphic reference (no FK -- the
// owner can be clients, projects, or video_logs, and D1/SQLite has no
// portable polymorphic FK) with correctness enforced at the application
// layer in modules/commitments, same tradeoff already documented above for
// work_sessions.sensor_local_id-style app-layer invariants.
export const commitments = sqliteTable(
  "commitments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerType: text("owner_type", {
      enum: ["CLIENT", "PROJECT", "VIDEO"],
    }).notNull(),
    ownerId: integer("owner_id").notNull(),
    description: text("description").notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }),
    status: text("status", { enum: ["OPEN", "DONE", "CANCELLED"] })
      .notNull()
      .default("OPEN"),
    // Open-ended, no CHECK -- same reasoning as work_sessions.source:
    // MANUAL today, room for a future SYSTEM-generated source later
    // without a migration.
    source: text("source").notNull().default("MANUAL"),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] })
      .notNull()
      .default("admin"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("commitments_owner_idx").on(table.ownerType, table.ownerId),
    index("commitments_status_due_idx").on(table.status, table.dueAt),
    check(
      "commitments_owner_type_check",
      sql`${table.ownerType} in ('CLIENT', 'PROJECT', 'VIDEO')`,
    ),
    check(
      "commitments_status_check",
      sql`${table.status} in ('OPEN', 'DONE', 'CANCELLED')`,
    ),
  ],
);

// MindBunker Sensor P1: one revocable, narrowly-scoped credential per
// physical Mac. Only a SHA-256 token hash is stored; the clear credential is
// shown once to the authenticated operator and belongs in macOS Keychain.
export const sensorDevices = sqliteTable(
  "sensor_devices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    scopes: text("scopes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (table) => [index("sensor_devices_active_idx").on(table.revokedAt, table.publicId)],
);

export const workSessions = sqliteTable(
  "work_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videoLogs.id, { onDelete: "restrict" }),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    activityType: text("activity_type", {
      enum: [
        "EDITING",
        "MOTION_GRAPHICS",
        "COLOR",
        "AUDIO",
        "REVIEW",
        "EXPORT",
        "ADMIN",
        "CLIENT_SERVICE",
        "OTHER",
      ],
    })
      .notNull()
      .default("EDITING"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // Sprint 1.2.1 Ledger P1: how this row was captured. Deliberately no
    // CHECK constraint (unlike activity_type below) — SQLite cannot ALTER a
    // CHECK, and this vocabulary is expected to grow (MANUAL, IMPORTED,
    // eventually other capture values) as new paths are built. Browser
    // capture produces WEB_TIMER; P1 adds MAC_SENSOR while preserving every
    // browser path and row. WORK_SESSION_SOURCES in core.ts is the app-level
    // vocabulary source of truth.
    source: text("source").notNull().default("WEB_TIMER"),
    // Present only for MAC_SENSOR-captured rows. The local UUID is the
    // retry/idempotency authority; the canonical integer `id` remains the
    // MindBunker Work Session identity returned to the device.
    sensorDeviceId: integer("sensor_device_id").references(
      () => sensorDevices.id,
      { onDelete: "set null" },
    ),
    sensorLocalId: text("sensor_local_id"),
    // Set only when a completed session's fields are corrected after the
    // fact (see correctWorkSession in actions.ts). Null means "never
    // corrected" — itself meaningful, not just bookkeeping.
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    // Wave 3A: soft integrity state for the Repair surface. No CHECK --
    // same open-ended-vocabulary precedent as source/actor above.
    integrityState: text("integrity_state").notNull().default("NORMAL"),
    splitFromSessionId: integer("split_from_session_id"),
  },
  (table) => [
    uniqueIndex("work_sessions_one_open_idx")
      .on(sql`(1)`)
      .where(sql`${table.endedAt} is null`),
    index("work_sessions_video_started_idx").on(
      table.videoId,
      table.startedAt,
    ),
    uniqueIndex("work_sessions_sensor_local_unique").on(
      table.sensorDeviceId,
      table.sensorLocalId,
    ),
    check(
      "work_sessions_ended_after_started_check",
      sql`${table.endedAt} is null or ${table.endedAt} > ${table.startedAt}`,
    ),
    check(
      "work_sessions_activity_type_check",
      sql`${table.activityType} in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'CLIENT_SERVICE', 'OTHER')`,
    ),
  ],
);

// Sensor P1.1 Inbox: durable intentional evidence received from a Mac stays
// separate from canonical operational Work Sessions until Emmanuel explicitly
// approves it. Client/project ownership is always derived through video_id.
export const sensorSessions = sqliteTable(
  "sensor_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sensorDeviceId: integer("sensor_device_id")
      .notNull()
      .references(() => sensorDevices.id, { onDelete: "restrict" }),
    localSessionId: text("local_session_id").notNull(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videoLogs.id, { onDelete: "restrict" }),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    activityType: text("activity_type", {
      enum: [
        "EDITING",
        "MOTION_GRAPHICS",
        "COLOR",
        "AUDIO",
        "REVIEW",
        "EXPORT",
        "ADMIN",
        "CLIENT_SERVICE",
        "OTHER",
      ],
    }).notNull(),
    note: text("note"),
    approvalState: text("approval_state", {
      enum: ["PENDING", "APPROVED", "ARCHIVED", "DELETED"],
    })
      .notNull()
      .default("PENDING"),
    approvedWorkSessionId: integer("approved_work_session_id").references(
      () => workSessions.id,
      { onDelete: "set null" },
    ),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    source: text("source").notNull().default("MAC_SENSOR"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("sensor_sessions_device_local_unique").on(
      table.sensorDeviceId,
      table.localSessionId,
    ),
    uniqueIndex("sensor_sessions_approved_work_unique").on(
      table.approvedWorkSessionId,
    ),
    index("sensor_sessions_review_idx").on(
      table.approvalState,
      table.startedAt,
    ),
    index("sensor_sessions_video_started_idx").on(
      table.videoId,
      table.startedAt,
    ),
    check(
      "sensor_sessions_ended_after_started_check",
      sql`${table.endedAt} is null or ${table.endedAt} > ${table.startedAt}`,
    ),
    check(
      "sensor_sessions_activity_type_check",
      sql`${table.activityType} in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'CLIENT_SERVICE', 'OTHER')`,
    ),
    check(
      "sensor_sessions_approval_state_check",
      sql`${table.approvalState} in ('PENDING', 'APPROVED', 'ARCHIVED', 'DELETED')`,
    ),
  ],
);

// Passive foreground evidence. This is intentionally independent from
// work_sessions: observations exist before, during, and after declared work,
// and correlation is always derived by timestamp overlap.
export const deviceActivityObservations = sqliteTable(
  "device_activity_observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sensorDeviceId: integer("sensor_device_id")
      .notNull()
      .references(() => sensorDevices.id, { onDelete: "restrict" }),
    localObservationId: text("local_observation_id").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }).notNull(),
    appName: text("app_name").notNull(),
    bundleId: text("bundle_id"),
    windowTitle: text("window_title"),
    idle: integer("idle", { mode: "boolean" }).notNull().default(false),
    // Optional aggregate counters only. No key values, text, keycodes, or
    // mouse coordinates are accepted by the API or represented in schema.
    keystrokeCount: integer("keystroke_count"),
    mouseMovementCount: integer("mouse_movement_count"),
    source: text("source").notNull().default("MAC_SENSOR"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("device_activity_observations_device_local_unique").on(
      table.sensorDeviceId,
      table.localObservationId,
    ),
    index("device_activity_observations_started_idx").on(table.startedAt),
    index("device_activity_observations_device_started_idx").on(
      table.sensorDeviceId,
      table.startedAt,
    ),
    check(
      "device_activity_observations_interval_check",
      sql`${table.endedAt} >= ${table.startedAt}`,
    ),
    check(
      "device_activity_observations_keystroke_count_check",
      sql`${table.keystrokeCount} is null or ${table.keystrokeCount} >= 0`,
    ),
    check(
      "device_activity_observations_mouse_movement_count_check",
      sql`${table.mouseMovementCount} is null or ${table.mouseMovementCount} >= 0`,
    ),
  ],
);

// ─── ACTIVITYWATCH IMPORT (Pre-Operation Reality Hardening — ActivityWatch
// Import round) ──────────────────────────────────────────────────────────
//
// Raw, observed ActivityWatch history -- deliberately NOT the same tier as
// deviceActivityObservations above (that table is native MindBunker
// observation, fed by the live authenticated Sensor agent and consumed by
// Sensor's own session/billing logic) and NOT the same tier as the
// Historical Reference Layer below (that layer stores RECONSTRUCTED,
// aggregated facts derived by an offline script, e.g. "activitywatch_afk"
// monthly totals in historical_facts_v0.json). This is tier-1 raw evidence,
// one row per real ActivityWatch event, imported as-is from an operator-
// supplied export file. It must never be converted into a sensor_sessions
// row, a work_sessions row, or any billable/canonical record -- it exists
// purely so future analytics have real per-event provenance to query,
// completely separate from anything MindBunker itself measured or billed.
//
// One row per uploaded file, append-only, keyed by a whole-file content
// fingerprint so re-uploading the exact same export is a fast no-op.
export const activitywatchImports = sqliteTable(
  "activitywatch_imports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bucketId: text("bucket_id").notNull(),
    bucketType: text("bucket_type", { enum: ["WINDOW", "AFK"] }).notNull(),
    hostname: text("hostname"),
    fileFingerprint: text("file_fingerprint").notNull(),
    r2ObjectKey: text("r2_object_key").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    totalEventsInFile: integer("total_events_in_file").notNull().default(0),
    newEventCount: integer("new_event_count").notNull().default(0),
    duplicateEventCount: integer("duplicate_event_count").notNull().default(0),
    rejectedEventCount: integer("rejected_event_count").notNull().default(0),
    rangeStart: integer("range_start", { mode: "timestamp" }),
    rangeEnd: integer("range_end", { mode: "timestamp" }),
    importedAt: integer("imported_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("activitywatch_imports_file_fingerprint_unique").on(
      table.fileFingerprint,
    ),
    index("activitywatch_imports_bucket_idx").on(table.bucketId),
  ],
);

// One row per raw event (window-focus interval or AFK-state interval).
// `fingerprint` is derived deterministically from (bucketId, bucketType,
// startedAt, durationSeconds, and the type-specific payload) -- see
// deriveEventFingerprint in modules/activitywatch/core.ts -- so the SAME
// real-world event imported from two different export files (e.g. an
// overlapping re-export) collides on the unique index and is silently
// skipped (onConflictDoNothing), never duplicated.
export const activitywatchEvents = sqliteTable(
  "activitywatch_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importId: integer("import_id")
      .notNull()
      .references(() => activitywatchImports.id, { onDelete: "restrict" }),
    bucketId: text("bucket_id").notNull(),
    bucketType: text("bucket_type", { enum: ["WINDOW", "AFK"] }).notNull(),
    hostname: text("hostname"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    // WINDOW-only (null for AFK rows).
    appName: text("app_name"),
    windowTitle: text("window_title"),
    // AFK-only (null for WINDOW rows). Whatever string ActivityWatch's own
    // afkstatus watcher reported ("afk" / "not-afk") -- not reinterpreted.
    afkStatus: text("afk_status"),
    // Always "ACTIVITYWATCH" today. A real column (not just a fixed value
    // in application code) so a future second raw-import source can share
    // this table honestly, and so provenance survives any export/backup.
    provenance: text("provenance").notNull().default("ACTIVITYWATCH"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("activitywatch_events_fingerprint_unique").on(
      table.fingerprint,
    ),
    index("activitywatch_events_bucket_started_idx").on(
      table.bucketId,
      table.startedAt,
    ),
    index("activitywatch_events_import_idx").on(table.importId),
    check(
      "activitywatch_events_bucket_type_check",
      sql`${table.bucketType} in ('WINDOW', 'AFK')`,
    ),
    check(
      "activitywatch_events_duration_check",
      sql`${table.durationSeconds} >= 0`,
    ),
  ],
);

// ─── HISTORICAL REFERENCE LAYER (Sprint 1.2 P0) ────────────────────────────────
//
// Tier-1 historical reconstructed evidence only (see
// src/modules/historical/artifact/v0_1_0/ARTIFACT_CONTRACT.md). These tables
// are strictly additive and read-only from the app's perspective outside the
// importer: nothing here is a Client/Project/Video/WorkSession, and the
// importer never writes to those tables. Exactly one hist_import_batches row
// may be ACTIVE at a time (see the partial unique index below), mirroring the
// work_sessions_one_open_idx single-row-invariant pattern already used above.

export const histImportBatches = sqliteTable(
  "hist_import_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    artifactVersion: text("artifact_version").notNull(), // contract_version, e.g. "0.1.0"
    fingerprint: text("fingerprint").notNull(), // sha256 over the 4 source JSON files, for idempotency
    status: text("status", { enum: ["PENDING", "ACTIVE", "SUPERSEDED"] })
      .notNull()
      .default("PENDING"),
    factCount: integer("fact_count").notNull().default(0),
    identityCount: integer("identity_count").notNull().default(0),
    coverageMonthCount: integer("coverage_month_count").notNull().default(0),
    importedAt: integer("imported_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    supersededAt: integer("superseded_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("hist_import_batches_fingerprint_unique").on(
      table.fingerprint,
    ),
    uniqueIndex("hist_import_batches_one_active_idx")
      .on(sql`(1)`)
      .where(sql`${table.status} = 'ACTIVE'`),
    check(
      "hist_import_batches_status_check",
      sql`${table.status} in ('PENDING', 'ACTIVE', 'SUPERSEDED')`,
    ),
  ],
);

export const histIdentities = sqliteTable(
  "hist_identities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id")
      .notNull()
      .references(() => histImportBatches.id, { onDelete: "cascade" }),
    canonicalId: text("canonical_id").notNull(), // e.g. "client:sean_go"
    canonicalLabel: text("canonical_label").notNull(),
    identityType: text("identity_type", {
      enum: [
        "client",
        "internal_category",
        "unresolved_clockify_label",
        "extraction_artifact",
      ],
    }).notNull(),
    resolutionStatus: text("resolution_status", {
      enum: [
        "HUMAN_CONFIRMED",
        "SINGLE_SOURCE_ONLY",
        "INTERNAL",
        "NOT_AN_IDENTITY",
      ],
    }).notNull(),
    resolutionDate: text("resolution_date"), // ISO date string YYYY-MM-DD
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    uniqueIndex("hist_identities_batch_canonical_id_unique").on(
      table.batchId,
      table.canonicalId,
    ),
    index("hist_identities_batch_status_idx").on(
      table.batchId,
      table.resolutionStatus,
    ),
    check(
      "hist_identities_identity_type_check",
      sql`${table.identityType} in ('client', 'internal_category', 'unresolved_clockify_label', 'extraction_artifact')`,
    ),
    check(
      "hist_identities_resolution_status_check",
      sql`${table.resolutionStatus} in ('HUMAN_CONFIRMED', 'SINGLE_SOURCE_ONLY', 'INTERNAL', 'NOT_AN_IDENTITY')`,
    ),
  ],
);

export const histIdentitySourceLabels = sqliteTable(
  "hist_identity_source_labels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Joined by (batchId, identityCanonicalId) rather than an internal
    // autoincrement FK: the importer builds every insert up front from the
    // artifact JSON (which only knows canonical_id, never a DB-generated
    // id), so all hist_facts/hist_identity_source_labels rows can be
    // constructed and batched atomically alongside hist_identities in one
    // db.batch() call, with no dependency on IDs D1 hasn't generated yet.
    batchId: integer("batch_id")
      .notNull()
      .references(() => histImportBatches.id, { onDelete: "cascade" }),
    identityCanonicalId: text("identity_canonical_id").notNull(),
    source: text("source").notNull(),
    label: text("label").notNull(),
    occurrences: integer("occurrences"),
  },
  (table) => [
    index("hist_identity_source_labels_batch_identity_idx").on(
      table.batchId,
      table.identityCanonicalId,
    ),
    foreignKey({
      columns: [table.batchId, table.identityCanonicalId],
      foreignColumns: [histIdentities.batchId, histIdentities.canonicalId],
      name: "hist_identity_source_labels_identity_fk",
    }).onDelete("cascade"),
  ],
);

export const histFacts = sqliteTable(
  "hist_facts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id")
      .notNull()
      .references(() => histImportBatches.id, { onDelete: "cascade" }),
    periodGranularity: text("period_granularity", {
      enum: ["month", "year", "lifetime", "window"],
    }).notNull(),
    periodYear: integer("period_year"), // month/year granularity
    periodMonth: integer("period_month"), // month granularity only, 1-12
    periodStart: text("period_start"), // window granularity, ISO date
    periodEnd: text("period_end"), // window granularity, ISO date
    // Same batchId + identityCanonicalId join key as
    // hist_identity_source_labels, for the same batching reason. Null means
    // an aggregate fact not attributable to a single identity (e.g. total
    // monthly Upwork revenue across all contracts).
    identityCanonicalId: text("identity_canonical_id"),
    source: text("source", {
      enum: [
        "upwork_weekly_summary",
        "upwork_lifetime_billings",
        "clockify_detailed_export",
        "activitywatch_afk",
      ],
    }).notNull(),
    metric: text("metric").notNull(),
    value: real("value"), // null is a legitimate value (e.g. effective_billed_rate with 0 hours)
    unit: text("unit").notNull(),
    confidence: text("confidence", {
      enum: ["HIGH", "MEDIUM", "LOW", "N/A", "EXPERIMENTAL"],
    }).notNull(),
    canonical: integer("canonical", { mode: "boolean" }).notNull(),
    provenance: text("provenance").notNull(),
    derivationNote: text("derivation_note"),
  },
  (table) => [
    index("hist_facts_batch_period_idx").on(
      table.batchId,
      table.periodGranularity,
      table.periodYear,
      table.periodMonth,
    ),
    index("hist_facts_batch_source_metric_idx").on(
      table.batchId,
      table.source,
      table.metric,
    ),
    index("hist_facts_batch_identity_idx").on(
      table.batchId,
      table.identityCanonicalId,
    ),
    foreignKey({
      columns: [table.batchId, table.identityCanonicalId],
      foreignColumns: [histIdentities.batchId, histIdentities.canonicalId],
      name: "hist_facts_identity_fk",
    }).onDelete("cascade"),
    check(
      "hist_facts_period_granularity_check",
      sql`${table.periodGranularity} in ('month', 'year', 'lifetime', 'window')`,
    ),
    check(
      "hist_facts_source_check",
      sql`${table.source} in ('upwork_weekly_summary', 'upwork_lifetime_billings', 'clockify_detailed_export', 'activitywatch_afk')`,
    ),
    check(
      "hist_facts_confidence_check",
      sql`${table.confidence} in ('HIGH', 'MEDIUM', 'LOW', 'N/A', 'EXPERIMENTAL')`,
    ),
  ],
);

export const histSourceCoverage = sqliteTable(
  "hist_source_coverage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id")
      .notNull()
      .references(() => histImportBatches.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12
    source: text("source", {
      enum: [
        "upwork_weekly_summary",
        "clockify_detailed_export",
        "activitywatch_afk",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["DATA_PRESENT", "UNKNOWN_NO_SOURCE_DATA"],
    }).notNull(),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("hist_source_coverage_batch_period_source_unique").on(
      table.batchId,
      table.year,
      table.month,
      table.source,
    ),
    check(
      "hist_source_coverage_source_check",
      sql`${table.source} in ('upwork_weekly_summary', 'clockify_detailed_export', 'activitywatch_afk')`,
    ),
    check(
      "hist_source_coverage_status_check",
      sql`${table.status} in ('DATA_PRESENT', 'UNKNOWN_NO_SOURCE_DATA')`,
    ),
  ],
);

// ─── CAFFEINE EVENTS (Monday Local Intelligence Lab, §I) ───────────────────
//
// Deliberately a separate, minimal, coarse-grained event log -- NOT a
// universal life-event architecture. health_logs.caffeineMg stays exactly
// as-is (a daily aggregate, overwrite-on-upsert) for whatever coarse manual
// mg entry someone wants to keep making; this table is the honest place to
// record "I drank a coffee right now," one row per serving-event, so
// COFFEES TODAY / COFFEES THIS WEEK can be a real count instead of a fake
// timestamp derived from a daily total. `source` intentionally has no CHECK
// (same reasoning as work_sessions.source): QUICK_LOG is the only value any
// code path produces this round, but the vocabulary is expected to grow
// (e.g. a future MANUAL backfill entry) without needing a migration.
export const caffeineEvents = sqliteTable(
  "caffeine_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    // 1 event = 1 coffee serving by default. Intentionally coarse -- no mg
    // inference. A rare "logged 2 at once" case is a quantity, not two rows.
    servings: integer("servings").notNull().default(1),
    source: text("source").notNull().default("QUICK_LOG"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("caffeine_events_occurred_at_idx").on(table.occurredAt),
    check("caffeine_events_servings_check", sql`${table.servings} > 0`),
  ],
);

// ─── SCREEN TIME SNAPSHOTS (Monday Local Intelligence Lab, §M) ─────────────
//
// A manual-import prototype only -- labeled "MANUAL APPLE SCREEN TIME
// SNAPSHOT" everywhere it's shown, never claiming automatic sensing. Each
// row is one pasted structured JSON payload (periodStart/periodEnd/device/
// totalMinutes/categories/apps), preserved verbatim in rawPayload so the
// original evidence is never lost even if the normalized columns above it
// turn out to need reshaping later. A JSON payload column is an accepted P0
// shortcut per the brief -- categories/apps are not separately normalized
// into their own tables this round.
export const screenTimeSnapshots = sqliteTable(
  "screen_time_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    periodStart: text("period_start").notNull(), // ISO date YYYY-MM-DD
    periodEnd: text("period_end").notNull(), // ISO date YYYY-MM-DD
    device: text("device").notNull(),
    totalMinutes: integer("total_minutes").notNull(),
    source: text("source")
      .notNull()
      .default("MANUAL_APPLE_SCREEN_TIME_SNAPSHOT"),
    // Original pasted payload (validated, normalized shape), preserved as
    // JSON text -- see src/modules/screen-time/core.ts for the schema it
    // must satisfy before this row is ever written.
    rawPayload: text("raw_payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("screen_time_snapshots_period_idx").on(
      table.periodStart,
      table.periodEnd,
    ),
    check(
      "screen_time_snapshots_period_check",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    check(
      "screen_time_snapshots_total_minutes_check",
      sql`${table.totalMinutes} >= 0`,
    ),
  ],
);


// ─── MONDAY MONEY LAB P0: COMMERCIAL CONTRACTS + BILLING EVIDENCE ──────────
//
// Three truths, permanently separate (docs/architecture/MONDAY_MONEY_LAB_P0.md):
//   OPERATIONAL TRUTH = work_sessions (already exists, unmodified above)
//   BILLING TRUTH     = commercial_contracts + billing_evidence (this block)
//   FINANCIAL TRUTH   = transactions (existing table, extended above)
// A commercial_contracts/billing_evidence row never mutates work_sessions,
// and reconciliation (src/modules/finance/core.ts) only ever reads all
// three and reports the difference -- it never rewrites one truth to
// agree with another.

export const commercialContracts = sqliteTable(
  "commercial_contracts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    // Free text, not an enum -- "Do not invent an Upwork API integration"
    // extends to not inventing a closed platform vocabulary either. Upwork
    // today, something else tomorrow, no schema change needed either way.
    platform: text("platform").notNull(),
    externalReference: text("external_reference"),
    billingType: text("billing_type", { enum: ["HOURLY", "FIXED"] }).notNull(),
    hourlyRate: real("hourly_rate"), // required iff billingType = HOURLY, enforced below
    currency: text("currency").notNull(),
    status: text("status", { enum: ["ACTIVE", "PAUSED", "ENDED"] })
      .notNull()
      .default("ACTIVE"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => [
    index("commercial_contracts_client_idx").on(table.clientId),
    check(
      "commercial_contracts_billing_type_check",
      sql`${table.billingType} in ('HOURLY', 'FIXED')`,
    ),
    check(
      "commercial_contracts_status_check",
      sql`${table.status} in ('ACTIVE', 'PAUSED', 'ENDED')`,
    ),
    check(
      "commercial_contracts_hourly_rate_check",
      sql`${table.billingType} != 'HOURLY' or ${table.hourlyRate} is not null`,
    ),
  ],
);

export const billingEvidence = sqliteTable(
  "billing_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractId: integer("contract_id")
      .notNull()
      .references(() => commercialContracts.id, { onDelete: "restrict" }),
    periodStart: text("period_start").notNull(), // ISO date YYYY-MM-DD
    periodEnd: text("period_end").notNull(), // ISO date YYYY-MM-DD
    billableMinutes: integer("billable_minutes").notNull(),
    // Rate actually applied to THIS evidence -- captured independently of
    // the contract's current hourlyRate so a later contract rate change
    // never silently reinterprets historical evidence.
    rate: real("rate").notNull(),
    grossAmount: real("gross_amount").notNull(),
    currency: text("currency").notNull(),
    source: text("source", { enum: ["MANUAL", "CSV_IMPORT", "UPWORK_REPORT"] }).notNull(),
    externalReference: text("external_reference"),
    // Monday Pre-Freeze Consolidation §9: the date the platform recorded
    // this as an earning/transaction (e.g. Upwork's Aug 21 for an Aug
    // 10-16 period) -- deliberately independent of periodStart/periodEnd
    // and of any cash-arrival date on a linked transaction. Nullable:
    // often unknown at MANUAL entry time.
    earningDate: text("earning_date"),
    // Deterministic dedupe key (see buildBillingEvidenceIdempotencyKey in
    // src/modules/finance/core.ts) -- the unique index below is what makes
    // "duplicate import cannot create duplicate billing evidence" an actual
    // DB-level guarantee rather than only an app-level promise.
    idempotencyKey: text("idempotency_key").notNull(),
    importedAt: integer("imported_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("billing_evidence_idempotency_idx").on(table.idempotencyKey),
    index("billing_evidence_contract_period_idx").on(
      table.contractId,
      table.periodStart,
      table.periodEnd,
    ),
    check(
      "billing_evidence_period_check",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    check("billing_evidence_minutes_check", sql`${table.billableMinutes} >= 0`),
    check(
      "billing_evidence_source_check",
      sql`${table.source} in ('MANUAL', 'CSV_IMPORT', 'UPWORK_REPORT')`,
    ),
  ],
);

// Single-row experimental cash-planning setting (Monday Money Lab P0 §9).
// NOT tax accounting, NOT Brazilian tax law -- one configurable percentage
// Emmanuel can change, used only to derive an honestly-labeled Tax Reserve
// figure on the Finance summary. id is pinned to 1 by the check below,
// mirroring hist_import_batches' single-active-row pattern used elsewhere.
export const financeSettings = sqliteTable(
  "finance_settings",
  {
    id: integer("id").primaryKey().default(1),
    taxReservePercent: real("tax_reserve_percent").notNull().default(10),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    check("finance_settings_singleton_check", sql`${table.id} = 1`),
    check(
      "finance_settings_percent_check",
      sql`${table.taxReservePercent} >= 0 and ${table.taxReservePercent} <= 100`,
    ),
  ],
);

// Monday Pre-Freeze Consolidation §8/§10: platform fee is its OWN source
// fact, never merged into billing_evidence.grossAmount or into a cash
// transaction. Multiple fees may apply to one evidence row over time (a
// correction, a second fee type) -- this is append-only, like
// billing_evidence itself.
export const platformFees = sqliteTable(
  "platform_fees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    billingEvidenceId: integer("billing_evidence_id")
      .notNull()
      .references(() => billingEvidence.id, { onDelete: "restrict" }),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    occurredAt: text("occurred_at"), // ISO date, nullable -- often unknown at entry
    source: text("source", { enum: ["MANUAL", "CSV_IMPORT", "UPWORK_REPORT"] }).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("platform_fees_evidence_idx").on(table.billingEvidenceId),
    check("platform_fees_amount_check", sql`${table.amount} >= 0`),
    check(
      "platform_fees_source_check",
      sql`${table.source} in ('MANUAL', 'CSV_IMPORT', 'UPWORK_REPORT')`,
    ),
  ],
);

// §13: local allocation/review tool. One billing_evidence row may cover
// several videos; each allocation row is one (evidence, video-or-null)
// slice with an explicit method. DERIVED rows are computed and persisted
// for review, but the method column is what keeps them permanently
// distinguishable from a MANUAL confirmation -- nothing here silently
// promotes a derived slice into a confirmed one.
export const billingAllocations = sqliteTable(
  "billing_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    billingEvidenceId: integer("billing_evidence_id")
      .notNull()
      .references(() => billingEvidence.id, { onDelete: "restrict" }),
    videoId: integer("video_id").references(() => videoLogs.id, {
      onDelete: "set null",
    }), // null = "Other / Unattributed"
    method: text("method", {
      enum: ["MANUAL_AMOUNT", "MANUAL_MINUTES", "DERIVED_PROPORTION"],
    }).notNull(),
    amount: real("amount").notNull(),
    minutes: integer("minutes"),
    currency: text("currency").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("billing_allocations_evidence_idx").on(table.billingEvidenceId),
    index("billing_allocations_video_idx").on(table.videoId),
    check("billing_allocations_amount_check", sql`${table.amount} >= 0`),
    check(
      "billing_allocations_method_check",
      sql`${table.method} in ('MANUAL_AMOUNT', 'MANUAL_MINUTES', 'DERIVED_PROPORTION')`,
    ),
  ],
);

// §11: a safer alternative to fabricating historical Work Sessions. One
// free-text annotation per day noting what Emmanuel believes he worked
// on, optionally linked to a real, already-confirmed video -- never
// itself a Work Session, never counted as operational truth.
export const reconciliationNotes = sqliteTable(
  "reconciliation_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractId: integer("contract_id")
      .notNull()
      .references(() => commercialContracts.id, { onDelete: "restrict" }),
    date: text("date").notNull(), // ISO date YYYY-MM-DD
    note: text("note").notNull(),
    videoId: integer("video_id").references(() => videoLogs.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("reconciliation_notes_contract_date_idx").on(
      table.contractId,
      table.date,
    ),
  ],
);

// §16: very small debt prototype. Remaining balance is deliberately NOT a
// stored column -- it is originalAmount minus the sum of transactions
// rows carrying this debt's id (see transactions.debtId above), so it can
// never drift out of sync with the real payment ledger.
export const debts = sqliteTable(
  "debts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    creditor: text("creditor").notNull(),
    originalAmount: real("original_amount").notNull(),
    currency: text("currency").notNull(),
    notes: text("notes"),
    status: text("status", { enum: ["ACTIVE", "PAID"] })
      .notNull()
      .default("ACTIVE"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    check("debts_original_amount_check", sql`${table.originalAmount} >= 0`),
    check("debts_status_check", sql`${table.status} in ('ACTIVE', 'PAID')`),
  ],
);

// §17/§18: narrow recurring-subscription manager. monthlyEquivalent is
// always derived (amount, or amount/12 for ANNUAL) -- the real billing
// event (what actually charges, and when) is what's stored; MindBunker
// never pretends an annual charge happens monthly.
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    vendor: text("vendor").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    cadence: text("cadence", { enum: ["MONTHLY", "ANNUAL"] }).notNull(),
    renewalDate: text("renewal_date"), // ISO date, nullable
    status: text("status", { enum: ["ACTIVE", "CANCELLED", "TRIAL"] })
      .notNull()
      .default("ACTIVE"),
    category: text("category"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("subscriptions_renewal_date_idx").on(table.renewalDate),
    check("subscriptions_amount_check", sql`${table.amount} >= 0`),
    check(
      "subscriptions_cadence_check",
      sql`${table.cadence} in ('MONTHLY', 'ANNUAL')`,
    ),
    check(
      "subscriptions_status_check",
      sql`${table.status} in ('ACTIVE', 'CANCELLED', 'TRIAL')`,
    ),
  ],
);

// ─── ASSETS / DELIVERABLES / SOURCE MEDIA (Monday Real-Operation Pre-Freeze §3/§4) ──

// §3: VIDEO != DELIVERABLE != ASSET. The Look Studios Session fixture proved
// a single Project (or a single Video/work-unit within it) can produce many
// outputs of different KINDS -- a final deliverable, a client review cut, a
// utility asset that only exists to solve the client's own workflow, an
// AI-processing input/output, source-prep media, a bonus extra. Forcing
// every one of those into its own "video" row would be a semantic lie
// (most were never separately contracted). An Asset is the minimal honest
// unit for "a thing that exists," independent of whether it is itself a
// contracted deliverable.
//
// projectId is required (every asset belongs to a project); videoId is
// OPTIONAL (an asset can exist at project level -- e.g. the ~800GB source
// ingest itself isn't "part of" any one of Taryn's Cut 1.0/1.1/1.2). This
// is §3's explicit "Asset independence" requirement (test acceptance
// criterion D in the brief).
//
// This is intentionally NOT a DAM: no bytes are stored here, only
// references (reviewUrl/deliveryUrl/publishedUrl/thumbnailUrl), mirroring
// the same provider-independent-URL pattern already used on video_logs.
export const assets = sqliteTable(
  "assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    videoId: integer("video_id").references(() => videoLogs.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type", { enum: ASSET_TYPES }).notNull(),
    status: text("status", { enum: ASSET_STATUSES })
      .notNull()
      .default("DRAFT"),
    reviewUrl: text("review_url"),
    deliveryUrl: text("delivery_url"),
    publishedUrl: text("published_url"),
    thumbnailUrl: text("thumbnail_url"),
    deliveredAt: text("delivered_at"), // ISO date, nullable -- unknown stays unknown
    notes: text("notes"),
    // Provenance §18: where this asset's existence/facts came from --
    // free text (Slack, Upwork, Dropbox, NAS, manual historical
    // reconstruction, etc.), same "don't invent a closed vocabulary"
    // reasoning as commercialContracts.platform above.
    source: text("source"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => [
    index("assets_project_idx").on(table.projectId),
    index("assets_video_idx").on(table.videoId),
    check("assets_type_check", sql`${table.type} in ('FINAL_DELIVERABLE', 'CLIENT_REVIEW', 'UTILITY_ASSET', 'AI_INPUT', 'SOURCE_PREP', 'BONUS_EXTRA')`),
    check("assets_status_check", sql`${table.status} in ('DRAFT', 'READY', 'DELIVERED')`),
  ],
);

// §4: a Project can reference substantial source media (e.g. ~800GB of LOG
// originals) WITHOUT MindBunker hosting or knowing the exact byte count.
// approxSizeLabel is deliberately TEXT ("~800 GB"), never an integer byte
// count -- an estimate must not silently become false precision. location
// is free text (NAS / Dropbox / etc.) -- no storage-provider coupling, same
// reasoning as commercialContracts.platform.
export const sourceMediaReferences = sqliteTable(
  "source_media_references",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    approxSizeLabel: text("approx_size_label"),
    // Taryn August Ingest Readiness §9: the actual client-provided source
    // URL (e.g. a Dropbox share link Taryn sent for the ~800GB LOG
    // originals) as a first-class, clickable, provider-agnostic field --
    // same self-contained HTTPS-only validator as assets.reviewUrl etc.
    // Distinct from `location`, which stays free text ("NAS", "Dropbox",
    // "external drive in the office") for where MindBunker's own copy or
    // knowledge of the media lives, not a link.
    sourceUrl: text("source_url"),
    location: text("location"),
    profile: text("profile"), // e.g. "LOG" -- free text, no closed vocabulary
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("source_media_references_project_idx").on(table.projectId)],
);

// §11: RMEDIA's operating-cost reserve target, conceptually distinct from
// Owner Pay / Tax Reserve / general cash. A minimal single-row extension
// of the existing financeSettings singleton (see finance_settings above)
// rather than a treasury subsystem -- the amount actually reserved so far
// is DERIVED (sum of transactions tagged category = 'Operating Reserve',
// same derived-balance discipline as debts.remainingBalance), never a
// second, driftable stored total.
export const operatingReserveSettings = sqliteTable(
  "operating_reserve_settings",
  {
    id: integer("id").primaryKey().default(1),
    targetAmount: real("target_amount"),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => [
    check("operating_reserve_settings_singleton_check", sql`${table.id} = 1`),
  ],
);

// ─── SPRINT C1: FX OBSERVED-RATE LEDGER ────────────────────────────────────
// Records a REAL BRL<->USD conversion Emmanuel actually performed (e.g. an
// Upwork/Wise withdrawal converting X BRL into Y USD or vice versa). This is
// its own append-only source fact, never a revenue/expense transaction --
// see EFFECTIVE_USD_TO_BRL_RATE in finance/config.ts for the temporary
// manual fallback this ledger is meant to eventually replace with real
// observed data. No automatic FX API: every row here is something Emmanuel
// typed in after the fact.
//
// FX + Business Operating Cash Patch: a BUSINESS-scope row IS now read
// alongside `transactions` when deriving Business Cash by currency (see
// getRmediaCashSummary/computeFinanceSummaryByCurrency in finance/) -- the
// conversion moves value between currency positions, it still never
// creates revenue or expense. A PERSONAL-scope row never touches Business
// Finance at all.
export const fxConversions = sqliteTable(
  "fx_conversions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // ISO date string YYYY-MM-DD
    brlAmount: real("brl_amount").notNull(),
    usdAmount: real("usd_amount").notNull(),
    notes: text("notes"),
    // FX + Business Operating Cash Patch §2: every conversion belongs to
    // BUSINESS or PERSONAL money -- the two must never be mixed by
    // default. Historical rows recorded before this column existed get
    // UNCLASSIFIED via the column default below, never silently backfilled
    // to BUSINESS; new conversions always pass an explicit scope at the
    // app level (validateFxConversionInput in modules/fx/core.ts).
    // UNCLASSIFIED is reachable only as this migration's honest default
    // for pre-existing rows, or by an explicit manual reclassification.
    scope: text("scope", { enum: ["BUSINESS", "PERSONAL", "UNCLASSIFIED"] })
      .notNull()
      .default("UNCLASSIFIED"),
    // FX + Business Operating Cash Patch §5/§6: which currency was actually
    // SPENT to obtain the other -- required to move Business Cash in the
    // right direction (USD->BRL decreases USD and increases BRL; BRL->USD
    // is the reverse). The brlAmount/usdAmount pair above is deliberately
    // direction-agnostic for weighted-RATE math (see computeVolumeWeightedRate),
    // but cash movement is not direction-agnostic, so this is a separate
    // field, not inferred from brlAmount/usdAmount. Nullable: rows recorded
    // before this column existed (or with scope != BUSINESS) have no
    // recorded direction and are simply excluded from cash derivation --
    // never guessed, matching the "never rewrite history" rule.
    fromCurrency: text("from_currency", { enum: ["BRL", "USD"] }),
    // FX + Business Operating Cash Patch §3: describes INTENT for a
    // BUSINESS conversion ("this BRL was prepared to pay Adobe"), never an
    // expense itself -- the actual subscription charge is what creates the
    // expense later, this only labels why the money was moved. Nullable;
    // only meaningful when scope = BUSINESS, never required for PERSONAL.
    purpose: text("purpose", {
      enum: ["OPERATING_COST", "TAX_RESERVE", "OWNER_TRANSFER", "OTHER"],
    }),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    // Wise reports the fee as evidence, but the source amount already
    // includes it in the account debit. This is metadata only and is never
    // subtracted a second time by balance calculations.
    feeAmount: real("fee_amount").notNull().default(0),
    feeCurrency: text("fee_currency"),
    // Cross-account transfers that happen to include an FX rate are real
    // FX evidence, but are not ordinary conversions for the monthly
    // observed-rate sample. Defaults true for every historical/manual row.
    countsTowardObservedRate: integer("counts_toward_observed_rate", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("fx_conversions_date_idx").on(table.date),
    index("fx_conversions_scope_idx").on(table.scope),
    uniqueIndex("fx_conversions_external_identity_idx").on(
      table.externalSource,
      table.externalId,
    ),
    check("fx_conversions_brl_amount_check", sql`${table.brlAmount} > 0`),
    check("fx_conversions_usd_amount_check", sql`${table.usdAmount} > 0`),
    check(
      "fx_conversions_scope_check",
      sql`${table.scope} in ('BUSINESS', 'PERSONAL', 'UNCLASSIFIED')`,
    ),
    check(
      "fx_conversions_purpose_check",
      sql`${table.purpose} is null or ${table.purpose} in ('OPERATING_COST', 'TAX_RESERVE', 'OWNER_TRANSFER', 'OTHER')`,
    ),
    check(
      "fx_conversions_from_currency_check",
      sql`${table.fromCurrency} is null or ${table.fromCurrency} in ('BRL', 'USD')`,
    ),
  ],
);

// A manually-declared rate for one calendar month ("YYYY-MM"), used only
// when that month has zero observed fx_conversions rows. Second tier of
// the provenance hierarchy: OBSERVED (real conversions that month) ->
// MANUAL (this table) -> FALLBACK (EFFECTIVE_USD_TO_BRL_RATE). Never
// overwrites observed data -- see resolveFxRateForMonth in
// modules/fx/core.ts.
export const fxManualRates = sqliteTable(
  "fx_manual_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    month: text("month").notNull(), // "YYYY-MM"
    rate: real("rate").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("fx_manual_rates_month_idx").on(table.month),
    check("fx_manual_rates_rate_check", sql`${table.rate} > 0`),
  ],
);

// ─── SPRINT C1: PERSONAL FINANCE FOUNDATION ────────────────────────────────
// A strictly separate ledger from `transactions` (Business Finance) -- not
// a category tag on the same table. `owner_pay_receipt` is the personal
// side of the RMEDIA CASH -> OWNER PAY -> PERSONAL MONEY bridge (see
// recordOwnerPay in finance/actions.ts, which inserts the paired row here
// automatically, 1:1, via ownerPayTransactionId); it is never business
// expense/revenue and never counted as personal `income` (reserved for
// genuine external personal income, e.g. a gift or a second job).
// `opening_balance` is an explicit starting-point fact, distinct from
// income, so a first-ever balance can be recorded honestly without
// inventing a fake income event.
export const personalTransactions = sqliteTable(
  "personal_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", {
      enum: ["opening_balance", "owner_pay_receipt", "income", "expense"],
    }).notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    currency: text("currency").notNull(),
    date: text("date").notNull(), // ISO date string YYYY-MM-DD
    notes: text("notes"),
    ownerPayTransactionId: integer("owner_pay_transaction_id").references(
      () => transactions.id,
      { onDelete: "restrict" },
    ),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    externalSource: text("external_source"),
    externalId: text("external_id"),
  },
  (table) => [
    index("personal_transactions_date_idx").on(table.date),
    uniqueIndex("personal_transactions_owner_pay_txn_idx").on(
      table.ownerPayTransactionId,
    ),
    uniqueIndex("personal_transactions_external_identity_idx").on(
      table.externalSource,
      table.externalId,
    ),
    check(
      "personal_transactions_type_check",
      sql`${table.type} in ('opening_balance', 'owner_pay_receipt', 'income', 'expense')`,
    ),
    check("personal_transactions_amount_check", sql`${table.amount} >= 0`),
    // Every owner_pay_receipt row is linked to exactly the business
    // transaction that produced it, and nothing else is ever linked.
    check(
      "personal_transactions_owner_pay_link_check",
      sql`(${table.type} = 'owner_pay_receipt') = (${table.ownerPayTransactionId} is not null)`,
    ),
  ],
);

// ─── Reality Closure (26 Aug 2026): LEDGER vs OBSERVED account balance ────
// "MindBunker needs to distinguish LEDGER BALANCE from OBSERVED ACCOUNT
// BALANCE because Emmanuel may not yet have logged every historical
// movement." A snapshot is evidence for reconciliation, nothing else --
// it is NEVER income, expense, an FX conversion, or owner pay, and it
// must never be folded into any of those derivations. finance/core.ts and
// personal-finance/core.ts's balance computations do not read this table
// at all; only the reconciliation panel reads it, alongside the existing
// ledger derivation, to show the difference.
export const cashBalanceSnapshots = sqliteTable(
  "cash_balance_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["BUSINESS", "PERSONAL"] }).notNull(),
    currency: text("currency", { enum: ["USD", "BRL"] }).notNull(),
    balanceAmount: real("balance_amount").notNull(),
    observedAt: text("observed_at").notNull(), // ISO date YYYY-MM-DD
    // Free text, not a closed enum -- only WISE_MANUAL exists today ("no
    // bank API"), but a future source (a different account, a different
    // manual check) shouldn't need a migration to be recorded.
    source: text("source").notNull().default("WISE_MANUAL"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("cash_balance_snapshots_scope_currency_idx").on(
      table.scope,
      table.currency,
      table.observedAt,
    ),
    check(
      "cash_balance_snapshots_scope_check",
      sql`${table.scope} in ('BUSINESS', 'PERSONAL')`,
    ),
    check(
      "cash_balance_snapshots_currency_check",
      sql`${table.currency} in ('USD', 'BRL')`,
    ),
  ],
);

// ─── AUGUST 2026 CANONICAL CASH POCKETS ────────────────────────────────────
// Business/personal P&L and Wise pocket balances answer different questions.
// These three deliberately narrow tables preserve the bank/account truth
// without turning an internal transfer into revenue or an ambiguous debit
// into an expense. They are not a generic ingestion framework: one explicit
// account, one signed source movement, and one observed balance snapshot.
export const cashAccounts = sqliteTable(
  "cash_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope", { enum: ["BUSINESS", "PERSONAL"] }).notNull(),
    currency: text("currency", { enum: ["USD", "BRL"] }).notNull(),
    pocket: text("pocket", { enum: ["MAIN", "RESERVE"] }).notNull(),
    label: text("label").notNull(),
    externalSource: text("external_source").notNull().default("WISE"),
    externalAccountId: text("external_account_id").notNull(),
    openingBalance: real("opening_balance").notNull(),
    openingAsOf: text("opening_as_of").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("cash_accounts_external_idx").on(
      table.externalSource,
      table.externalAccountId,
    ),
    uniqueIndex("cash_accounts_scope_currency_pocket_idx").on(
      table.scope,
      table.currency,
      table.pocket,
    ),
    check("cash_accounts_scope_check", sql`${table.scope} in ('BUSINESS', 'PERSONAL')`),
    check("cash_accounts_currency_check", sql`${table.currency} in ('USD', 'BRL')`),
    check("cash_accounts_pocket_check", sql`${table.pocket} in ('MAIN', 'RESERVE')`),
  ],
);

export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cashAccountId: integer("cash_account_id")
      .notNull()
      .references(() => cashAccounts.id, { onDelete: "restrict" }),
    date: text("date").notNull(),
    occurredAt: text("occurred_at").notNull(),
    amount: real("amount").notNull(), // signed in the account's own currency
    state: text("state", {
      enum: [
        "RECONCILED",
        "AMBIGUOUS",
        "EXTERNAL_TRANSFER",
        "INTERNAL_TRANSFER",
        "FX",
        "IGNORE",
      ],
    }).notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    externalSource: text("external_source").notNull().default("WISE"),
    externalId: text("external_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("cash_movements_account_external_idx").on(
      table.cashAccountId,
      table.externalSource,
      table.externalId,
    ),
    index("cash_movements_account_date_idx").on(table.cashAccountId, table.date),
    check("cash_movements_amount_check", sql`${table.amount} != 0`),
    check(
      "cash_movements_state_check",
      sql`${table.state} in ('RECONCILED', 'AMBIGUOUS', 'EXTERNAL_TRANSFER', 'INTERNAL_TRANSFER', 'FX', 'IGNORE')`,
    ),
  ],
);

export const cashAccountSnapshots = sqliteTable(
  "cash_account_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cashAccountId: integer("cash_account_id")
      .notNull()
      .references(() => cashAccounts.id, { onDelete: "restrict" }),
    balanceAmount: real("balance_amount").notNull(),
    observedAt: text("observed_at").notNull(),
    source: text("source").notNull().default("WISE_CSV"),
    externalId: text("external_id"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("cash_account_snapshots_account_observed_source_idx").on(
      table.cashAccountId,
      table.observedAt,
      table.source,
    ),
    index("cash_account_snapshots_account_date_idx").on(
      table.cashAccountId,
      table.observedAt,
    ),
  ],
);

// ─── LOCAL FEATURE HARVEST WAVE 2 (local-only lab, rough-by-design) ────────
// Everything below is deliberately additive: new tables, or nullable
// ADD COLUMNs on existing tables. No existing column is renamed, retyped,
// or removed. Enum-shaped text columns follow the same "no CHECK, TS-level
// only" precedent used elsewhere for open-ended/small vocabularies
// (crm_events.actor, work_sessions.source) -- these are rough experimental
// vocabularies that are expected to change shape as the Lab round finds
// out which values are actually useful.

export const frictionEvents = sqliteTable(
  "friction_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category", {
      enum: [
        "FILES",
        "SOFTWARE",
        "CLIENT",
        "DECISION",
        "QA",
        "HARDWARE",
        "PROCESS",
        "INGEST",
        "OTHER",
      ],
    }).notNull(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    videoId: integer("video_id").references(() => videoLogs.id, { onDelete: "set null" }),
    workSessionId: integer("work_session_id").references(() => workSessions.id, { onDelete: "set null" }),
    note: text("note"),
    minutesLost: integer("minutes_lost"),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] }).notNull().default("admin"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => [
    index("friction_events_video_idx").on(table.videoId, table.createdAt),
    index("friction_events_category_idx").on(table.category, table.createdAt),
  ],
);

export const videoLifecycleEvents = sqliteTable(
  "video_lifecycle_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id").notNull().references(() => videoLogs.id, { onDelete: "cascade" }),
    stage: text("stage", {
      enum: [
        "INGEST",
        "READY",
        "ROUGH_CUT",
        "EDITING",
        "INTERNAL_QA",
        "CLIENT_REVIEW",
        "REVISION",
        "APPROVED",
        "DELIVERED",
      ],
    }).notNull(),
    note: text("note"),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] }).notNull().default("admin"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => [index("video_lifecycle_events_video_idx").on(table.videoId, table.createdAt)],
);

export const qaEvents = sqliteTable(
  "qa_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id").notNull().references(() => videoLogs.id, { onDelete: "cascade" }),
    result: text("result", { enum: ["PASS", "FAIL", "OVERRIDE"] }).notNull(),
    // JSON-encoded { [checkKey: string]: boolean } -- a rough checklist
    // snapshot, not a normalized table. Cheap on purpose (Wave 2 rule:
    // no production-quality tax on a local experiment).
    checklist: text("checklist"),
    overrideReason: text("override_reason"),
    causedBy: text("caused_by", {
      enum: ["UNKNOWN", "OUR_ERROR", "CLIENT_CHANGE", "SCOPE_CHANGE"],
    }),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] }).notNull().default("admin"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => [index("qa_events_video_idx").on(table.videoId, table.createdAt)],
);

export const deliveries = sqliteTable(
  "deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id").notNull().references(() => videoLogs.id, { onDelete: "cascade" }),
    commitmentId: integer("commitment_id").references(() => commitments.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    deliveryUrl: text("delivery_url"),
    note: text("note"),
    status: text("status", { enum: ["DELIVERED", "REDELIVERED"] }).notNull().default("DELIVERED"),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] }).notNull().default("admin"),
  },
  (table) => [index("deliveries_video_idx").on(table.videoId, table.deliveredAt)],
);

export const decisions = sqliteTable("decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statement: text("statement").notNull(),
  context: text("context"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const hypotheses = sqliteTable("hypotheses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statement: text("statement").notNull(),
  evidenceNeeded: text("evidence_needed"),
  reviewAt: integer("review_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const experiments = sqliteTable("experiments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hypothesisId: integer("hypothesis_id").references(() => hypotheses.id, { onDelete: "set null" }),
  successCondition: text("success_condition").notNull(),
  result: text("result"),
  verdict: text("verdict", { enum: ["KEEP", "PATCH", "KILL", "INCONCLUSIVE"] }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

// ─── LOCAL FEATURE HARVEST WAVE 3 (local-only lab, rough-by-design) ────────

export const assetChecklistItems = sqliteTable(
  "asset_checklist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerType: text("owner_type", { enum: ["PROJECT", "VIDEO"] }).notNull(),
    ownerId: integer("owner_id").notNull(),
    itemType: text("item_type", {
      enum: ["A_ROLL", "B_ROLL", "LOGO", "MUSIC", "BRAND_GUIDE", "TRANSCRIPT", "OTHER"],
    }).notNull(),
    status: text("status", { enum: ["MISSING", "ARRIVING", "READY", "NOT_REQUIRED"] }).notNull().default("MISSING"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => [index("asset_checklist_owner_idx").on(table.ownerType, table.ownerId)],
);

export const ingestionEvents = sqliteTable(
  "ingestion_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id").notNull().references(() => videoLogs.id, { onDelete: "cascade" }),
    source: text("source"),
    destination: text("destination"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    operatorMinutes: integer("operator_minutes"),
    machineMinutes: integer("machine_minutes"),
    blockedWork: integer("blocked_work", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("ingestion_events_video_idx").on(table.videoId)],
);

export const blockers = sqliteTable(
  "blockers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category", {
      enum: ["CLIENT", "FILES", "HARDWARE", "SOFTWARE", "DECISION", "PAYMENT", "INGEST", "OTHER"],
    }).notNull(),
    ownerType: text("owner_type", { enum: ["CLIENT", "PROJECT", "VIDEO"] }).notNull(),
    ownerId: integer("owner_id").notNull(),
    note: text("note"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    actor: text("actor", { enum: ["admin", "gateway", "system", "client"] }).notNull().default("admin"),
  },
  (table) => [
    index("blockers_owner_idx").on(table.ownerType, table.ownerId),
    index("blockers_open_idx").on(table.resolvedAt),
  ],
);

export const systemCandidateVerdicts = sqliteTable(
  "system_candidate_verdicts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    candidateKey: text("candidate_key").notNull().unique(),
    verdict: text("verdict", { enum: ["IGNORE", "WATCH", "SYSTEMIZE"] }).notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
);

export const systemInterventions = sqliteTable("system_interventions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  problem: text("problem"),
  before: text("before"),
  after: text("after"),
  relatedFrictionCategory: text("related_friction_category"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const dailyStates = sqliteTable(
  "daily_states",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(), // ISO date YYYY-MM-DD
    sleepHours: real("sleep_hours"),
    energy: integer("energy"),
    focus: integer("focus"),
    note: text("note"),
    caffeineCount: integer("caffeine_count"),
    cigarettesCount: integer("cigarettes_count"),
    movement: integer("movement", { mode: "boolean" }),
    eveningNote: text("evening_note"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
);

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statement: text("statement").notNull(),
  type: text("type", { enum: ["FACT", "INFERENCE", "HYPOTHESIS"] }).notNull(),
  confidence: text("confidence", { enum: ["HIGH", "MEDIUM", "LOW"] }).notNull().default("LOW"),
  evidenceNeeded: text("evidence_needed"),
  sourceRefs: text("source_refs"),
  reviewAt: integer("review_at", { mode: "timestamp" }),
  status: text("status", { enum: ["OPEN", "REVIEWED", "RETIRED"] }).notNull().default("OPEN"),
  linkedHypothesisId: integer("linked_hypothesis_id").references(() => hypotheses.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Wave 4N/4O (Local Lab): Action Radar + Capture Inbox. One primitive
// powering both surfaces -- a free-standing, one-shot action item for
// intentions that don't naturally belong to a Commitment (a promise to
// someone), a Blocker (work literally cannot progress), or a CRM
// follow-up. Deliberately NOT a task manager: no subtasks, no assignee,
// no recurring rules, no project-management framework.
export const actionItems = sqliteTable(
  "action_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    priority: text("priority", { enum: ["P0", "P1", "P2", "P3"] }).notNull().default("P2"),
    status: text("status", { enum: ["OPEN", "DONE", "CANCELLED"] }).notNull().default("OPEN"),
    dueAt: integer("due_at", { mode: "timestamp" }),
    note: text("note"),
    // Optional owner -- same no-FK polymorphic convention as commitments/
    // blockers/asset_checklist_items above, correctness enforced at the
    // app layer. Null owner is a genuinely free-standing item (e.g. a
    // Capture Inbox note not yet triaged).
    ownerType: text("owner_type", { enum: ["CLIENT", "PROJECT", "VIDEO"] }),
    ownerId: integer("owner_id"),
    source: text("source").notNull().default("MANUAL"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("action_items_status_priority_idx").on(table.status, table.priority),
    index("action_items_owner_idx").on(table.ownerType, table.ownerId),
  ],
);

// Wave 4F (Local Lab): restaurant-ticket-style per-video production
// checklist. Deliberately separate from video_lifecycle_events (Wave 2) --
// lifecycle stages are sequential ("where is this video in the pipeline
// right now"), this is a parallel, independently-toggleable checklist
// ("which production steps are actually done"), and conflating the two
// would force every stage to imply every step. One row per step per
// video, upserted in place (not append-only -- toggling a step back is a
// normal correction, not a new historical fact the way a QA event is).
export const productionChecklistItems = sqliteTable(
  "production_checklist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id").notNull().references(() => videoLogs.id, { onDelete: "cascade" }),
    step: text("step", {
      enum: ["ASSEMBLY", "COLOR", "AUDIO", "MOTION", "CAPTIONS", "QA", "EXPORT", "DELIVERY"],
    }).notNull(),
    status: text("status", { enum: ["NOT_STARTED", "DONE", "NOT_REQUIRED"] }).notNull().default("NOT_STARTED"),
    toggledAt: integer("toggled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("production_checklist_video_step_unique").on(table.videoId, table.step),
  ],
);

// Wave 4Q (Local Lab): minimal Objective -- a strategic outcome container,
// not a task tree. Optional links to a Commitment/Project/Client give it
// something concrete to point at without duplicating those records.
export const objectives = sqliteTable("objectives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  period: text("period"),
  status: text("status", { enum: ["ACTIVE", "DONE", "DROPPED"] }).notNull().default("ACTIVE"),
  targetText: text("target_text"),
  currentText: text("current_text"),
  notes: text("notes"),
  linkedCommitmentId: integer("linked_commitment_id").references(() => commitments.id, { onDelete: "set null" }),
  linkedProjectId: integer("linked_project_id").references(() => projects.id, { onDelete: "set null" }),
  linkedClientId: integer("linked_client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
