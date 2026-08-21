import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import {
  availabilityWindows,
  bookingSettings,
  bookings,
} from "@/db/schema";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import { DEFAULT_BOOKING_SETTINGS } from "./config";

type Database = Awaited<ReturnType<typeof getDb>>;

const DEFAULT_WINDOWS = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  enabled: weekday >= 1 && weekday <= 5,
  startMinute: 10 * 60,
  endMinute: 17 * 60,
}));

async function readBookingConfiguration(db: Database) {
  const [settingsRows, windowRows] = await Promise.all([
    db.select().from(bookingSettings).where(eq(bookingSettings.id, 1)).limit(1),
    db
      .select({
        weekday: availabilityWindows.weekday,
        enabled: availabilityWindows.enabled,
        startMinute: availabilityWindows.startMinute,
        endMinute: availabilityWindows.endMinute,
      })
      .from(availabilityWindows)
      .orderBy(asc(availabilityWindows.weekday)),
  ]);

  const settings = settingsRows[0] ?? {
    ...DEFAULT_BOOKING_SETTINGS,
    updatedAt: null,
  };
  const byWeekday = new Map(windowRows.map((window) => [window.weekday, window]));

  return {
    settings: {
      enabled: settings.enabled,
      timezone: settings.timezone,
      durationMinutes: settings.durationMinutes,
      bufferMinutes: settings.bufferMinutes,
      minimumNoticeHours: settings.minimumNoticeHours,
      bookingHorizonDays: settings.bookingHorizonDays,
    },
    windows: DEFAULT_WINDOWS.map(
      (fallback) => byWeekday.get(fallback.weekday) ?? fallback,
    ),
  };
}

export async function getBookingConfiguration() {
  return readBookingConfiguration(await getDb());
}

export async function getAdminBookingConfiguration() {
  return readBookingConfiguration(await getAuthenticatedDb());
}

export async function getBookingBusyIntervals({
  startsAt,
  endsAt,
  excludeBookingId,
}: {
  startsAt: Date;
  endsAt: Date;
  excludeBookingId?: number;
}) {
  const db = await getDb();
  const conditions = [
    eq(bookings.status, "confirmed"),
    lte(bookings.startsAt, endsAt),
    gte(bookings.endsAt, startsAt),
  ];
  if (excludeBookingId) {
    conditions.push(ne(bookings.id, excludeBookingId));
  }

  return db
    .select({
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(and(...conditions));
}

export async function getCurrentBookingForInvitation(invitationId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.invitationId, invitationId),
        eq(bookings.status, "confirmed"),
      ),
    )
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCurrentBookingForClient(clientId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "confirmed")),
    )
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestBookingForClient(clientId: number) {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.clientId, clientId))
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(1);
  return rows[0] ?? null;
}
