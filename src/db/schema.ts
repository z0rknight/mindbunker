import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { OPPORTUNITY_STAGES } from "../modules/gateway/config";
import {
  BOOKING_STATUSES,
  CALENDAR_PROVIDERS,
  DEFAULT_BOOKING_SETTINGS,
} from "../modules/booking/config";
import { PROJECT_STATUSES } from "../modules/projects/config";

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
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actor: text("actor", { enum: ["admin", "gateway", "system"] })
      .notNull()
      .default("system"),
    description: text("description").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    index("crm_events_client_created_idx").on(table.clientId, table.createdAt),
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
    revisionsCount: integer("revisions_count").notNull().default(0),
    delivered: integer("delivered", { mode: "boolean" })
      .notNull()
      .default(true),
    notes: text("notes"),
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
  ],
);
