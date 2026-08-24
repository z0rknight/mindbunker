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
  },
  (table) => [
    index("crm_events_client_created_idx").on(table.clientId, table.createdAt),
    index("crm_events_video_created_idx").on(table.videoId, table.createdAt),
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
    notes: text("notes"),
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
      sql`${table.activityType} in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'OTHER')`,
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
      sql`${table.activityType} in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'OTHER')`,
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
