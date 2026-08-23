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

// ─── PRIVATE ACCESS ──────────────────────────────────────────────────────────

export const authAttempts = sqliteTable("auth_attempts", {
  fingerprint: text("fingerprint").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStarted: integer("window_started").notNull(),
  blockedUntil: integer("blocked_until"),
});

// ─── FINANCE MODULE ───────────────────────────────────────────────────────────

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

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
    notes: text("notes"),
    // Video visual metadata (Sprint 1.2.2 Client Portal round). All three
    // are nullable and never backfilled by inference -- a legacy video
    // simply has no cover/orientation/contentType until the operator sets
    // one on the existing Video edit surface (single canonical write path,
    // no separate admin metadata manager).
    coverUrl: text("cover_url"),
    orientation: text("orientation", { enum: VIDEO_ORIENTATIONS }),
    contentType: text("content_type", { enum: VIDEO_CONTENT_TYPES }),
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
    // eventually a desktop-sensor-derived value) as new capture paths are
    // built. WEB_TIMER is the only value any code path can currently
    // produce — see WORK_SESSION_SOURCES in core.ts, the single source of
    // truth for the open vocabulary.
    source: text("source").notNull().default("WEB_TIMER"),
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
