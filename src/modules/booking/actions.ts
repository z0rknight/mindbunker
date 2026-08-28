"use server";

import "server-only";

import { getAuthenticatedDb, getDb } from "@/db";
import {
  availabilityWindows,
  bookingSettings,
  bookings,
  clients,
  crmEvents,
  gatewayInvitations,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  cleanEmail,
  formatDateKeyInTimeZone,
  generateAvailableSlots,
  isValidTimeZone,
  stageAfterBooking,
  validateAvailabilityWindows,
  validateBookingSettings,
  validatePublicBookingRequestInput,
  type AvailabilityWindowValue,
  type BookingSettingsValue,
} from "./core";
import {
  getBookingBusyIntervals,
  getBookingConfiguration,
  getCurrentBookingForClient,
} from "./data";
import { getCalendarProvider } from "./provider";
import { PUBLIC_SLOT_LIMIT } from "./config";
import { BOOK_REQUEST_EVENT_TYPE } from "./core";
import { getGatewayContext } from "@/modules/gateway/data";
import { isGatewayToken } from "@/modules/gateway/core";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

type BookingActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export type AvailableSlotsResult =
  | {
      success: true;
      slots: Array<{ startsAt: string; endsAt: string }>;
      visitorTimezone: string;
      operatorTimezone: string;
      durationMinutes: number;
    }
  | { success: false; error: string };

function readableBookingTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /unique|constraint|bookings_slot_key_unique/iu.test(error.message)
  );
}

async function calculateSlots({
  excludeBookingId,
  limit,
}: {
  excludeBookingId?: number;
  limit: number;
}) {
  const configuration = await getBookingConfiguration();
  const now = new Date();
  const rangeEnd = new Date(
    now.getTime() +
      configuration.settings.bookingHorizonDays * DAY_IN_MILLISECONDS,
  );
  const provider = getCalendarProvider();
  const [databaseBusy, providerBusy] = await Promise.all([
    getBookingBusyIntervals({
      startsAt: now,
      endsAt: rangeEnd,
      excludeBookingId,
    }),
    provider.listBusyIntervals({
      startsAt: now.toISOString(),
      endsAt: rangeEnd.toISOString(),
    }),
  ]);
  const slots = generateAvailableSlots({
    settings: configuration.settings,
    windows: configuration.windows,
    busyIntervals: [...databaseBusy, ...providerBusy],
    now,
    limit,
  });
  return { ...configuration, provider, slots };
}

async function findAvailableSlot(
  startsAt: string,
  excludeBookingId?: number,
) {
  const calculated = await calculateSlots({
    excludeBookingId,
    limit: 10_000,
  });
  const slot = calculated.slots.find((candidate) => candidate.startsAt === startsAt);
  return { ...calculated, slot };
}

export async function getAvailableBookingSlots(
  rawToken: string,
  requestedTimezone: string,
): Promise<AvailableSlotsResult> {
  if (!isGatewayToken(rawToken)) {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const context = await getGatewayContext(rawToken);
  if (!context || context.accessStatus !== "active") {
    return { success: false, error: "This gateway link is unavailable." };
  }

  const visitorTimezone = isValidTimeZone(requestedTimezone)
    ? requestedTimezone
    : "UTC";
  const calculated = await calculateSlots({ limit: PUBLIC_SLOT_LIMIT });
  if (!calculated.settings.enabled) {
    return { success: false, error: "Online booking is paused right now." };
  }

  return {
    success: true,
    slots: calculated.slots,
    visitorTimezone,
    operatorTimezone: calculated.settings.timezone,
    durationMinutes: calculated.settings.durationMinutes,
  };
}

export async function createGatewayBooking(input: {
  gatewayToken: string;
  startsAt: string;
  attendeeEmail: string;
  visitorTimezone: string;
}): Promise<BookingActionResult> {
  if (!isGatewayToken(input.gatewayToken)) {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const attendeeEmail = cleanEmail(input.attendeeEmail);
  if (!attendeeEmail) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (!isValidTimeZone(input.visitorTimezone)) {
    return { success: false, error: "Your timezone could not be verified." };
  }

  const context = await getGatewayContext(input.gatewayToken);
  if (!context || context.accessStatus !== "active") {
    return { success: false, error: "This gateway link is unavailable." };
  }
  if (await getCurrentBookingForClient(context.clientId)) {
    return { success: false, error: "This invitation already has a booking." };
  }

  const calculated = await findAvailableSlot(input.startsAt);
  if (!calculated.slot) {
    return { success: false, error: "That time is no longer available. Choose another one." };
  }

  const idempotencyKey = crypto.randomUUID();
  const external = await calculated.provider.createBooking({
    idempotencyKey,
    startsAt: calculated.slot.startsAt,
    endsAt: calculated.slot.endsAt,
    attendeeName: context.clientName,
    attendeeEmail,
  });
  const startsAt = new Date(calculated.slot.startsAt);
  const endsAt = new Date(calculated.slot.endsAt);
  const now = new Date();
  const nextStage = stageAfterBooking(context.opportunityStage);
  const extendedExpiry = new Date(
    Math.max(
      context.expiresAt.getTime(),
      endsAt.getTime() + 7 * DAY_IN_MILLISECONDS,
    ),
  );
  const db = await getDb();

  try {
    await db.batch([
      db.insert(bookings).values({
        clientId: context.clientId,
        invitationId: context.invitationId,
        provider: calculated.provider.name,
        providerEventId: external.eventId,
        status: "confirmed",
        startsAt,
        endsAt,
        slotKey: calculated.slot.startsAt,
        visitorTimezone: input.visitorTimezone,
        attendeeEmail,
      }),
      db
        .update(clients)
        .set({
          email: context.clientEmail ?? attendeeEmail,
          opportunityStage: nextStage,
          nextAction: "Prepare for scheduled call",
          nextActionDate: formatDateKeyInTimeZone(
            startsAt,
            calculated.settings.timezone,
          ),
          lastInteractionAt: now,
        })
        .where(eq(clients.id, context.clientId)),
      db
        .update(gatewayInvitations)
        .set({ expiresAt: extendedExpiry })
        .where(eq(gatewayInvitations.id, context.invitationId)),
      db.insert(crmEvents).values({
        clientId: context.clientId,
        type: "booking_created",
        actor: "gateway",
        description: `Call booked for ${readableBookingTime(startsAt, calculated.settings.timezone)}`,
      }),
    ]);
  } catch (error) {
    await calculated.provider.cancelBooking(external.eventId);
    if (isUniqueConstraintError(error)) {
      return { success: false, error: "That time was just taken. Choose another one." };
    }
    throw error;
  }

  revalidatePath(`/crm/${context.clientId}`);
  revalidatePath("/crm");
  return { success: true, message: "Your call is booked." };
}

export async function rescheduleGatewayBooking(input: {
  gatewayToken: string;
  startsAt: string;
  visitorTimezone: string;
}): Promise<BookingActionResult> {
  if (
    !isGatewayToken(input.gatewayToken) ||
    !isValidTimeZone(input.visitorTimezone)
  ) {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const context = await getGatewayContext(input.gatewayToken);
  if (!context || context.accessStatus !== "active") {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const booking = await getCurrentBookingForClient(context.clientId);
  if (!booking) {
    return { success: false, error: "No active booking was found." };
  }
  if (booking.startsAt.toISOString() === input.startsAt) {
    return { success: true, message: "Your booking is already at that time." };
  }

  const calculated = await findAvailableSlot(input.startsAt, booking.id);
  if (!calculated.slot) {
    return { success: false, error: "That time is no longer available. Choose another one." };
  }
  const startsAt = new Date(calculated.slot.startsAt);
  const endsAt = new Date(calculated.slot.endsAt);
  const previousTime = booking.startsAt;
  await calculated.provider.rescheduleBooking(booking.providerEventId, {
    startsAt: calculated.slot.startsAt,
    endsAt: calculated.slot.endsAt,
  });

  const extendedExpiry = new Date(
    Math.max(
      context.expiresAt.getTime(),
      endsAt.getTime() + 7 * DAY_IN_MILLISECONDS,
    ),
  );
  const db = await getDb();
  try {
    await db.batch([
      db
        .update(bookings)
        .set({
          startsAt,
          endsAt,
          slotKey: calculated.slot.startsAt,
          visitorTimezone: input.visitorTimezone,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id)),
      db
        .update(clients)
        .set({
          nextAction: "Prepare for scheduled call",
          nextActionDate: formatDateKeyInTimeZone(
            startsAt,
            calculated.settings.timezone,
          ),
          lastInteractionAt: new Date(),
        })
        .where(eq(clients.id, context.clientId)),
      db
        .update(gatewayInvitations)
        .set({ expiresAt: extendedExpiry })
        .where(eq(gatewayInvitations.id, context.invitationId)),
      db.insert(crmEvents).values({
        clientId: context.clientId,
        type: "booking_rescheduled",
        actor: "gateway",
        description: `Call moved from ${readableBookingTime(previousTime, calculated.settings.timezone)} to ${readableBookingTime(startsAt, calculated.settings.timezone)}`,
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, error: "That time was just taken. Choose another one." };
    }
    throw error;
  }

  revalidatePath(`/crm/${context.clientId}`);
  return { success: true, message: "Your call was rescheduled." };
}

export async function cancelGatewayBooking(
  gatewayToken: string,
): Promise<BookingActionResult> {
  if (!isGatewayToken(gatewayToken)) {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const context = await getGatewayContext(gatewayToken);
  if (!context || context.accessStatus !== "active") {
    return { success: false, error: "This gateway link is unavailable." };
  }
  const booking = await getCurrentBookingForClient(context.clientId);
  if (!booking) {
    return { success: true, message: "This booking is already cancelled." };
  }

  const provider = getCalendarProvider();
  await provider.cancelBooking(booking.providerEventId);
  const now = new Date();
  const configuration = await getBookingConfiguration();
  const db = await getDb();
  await db.batch([
    db
      .update(bookings)
      .set({
        status: "cancelled",
        slotKey: null,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id)),
    db
      .update(clients)
      .set({
        nextAction: "Follow up after cancelled call",
        nextActionDate: formatDateKeyInTimeZone(
          now,
          configuration.settings.timezone,
        ),
        lastInteractionAt: now,
      })
      .where(eq(clients.id, context.clientId)),
    db.insert(crmEvents).values({
      clientId: context.clientId,
      type: "booking_cancelled",
      actor: "gateway",
      description: `Call cancelled (${readableBookingTime(booking.startsAt, configuration.settings.timezone)})`,
    }),
  ]);

  revalidatePath(`/crm/${context.clientId}`);
  return { success: true, message: "Your call was cancelled." };
}

export async function updateBookingAvailability(input: {
  settings: BookingSettingsValue;
  windows: AvailabilityWindowValue[];
}): Promise<BookingActionResult> {
  if (
    !validateBookingSettings(input.settings) ||
    !validateAvailabilityWindows(input.windows)
  ) {
    return { success: false, error: "Check the availability settings." };
  }

  const db = await getAuthenticatedDb();
  const now = new Date();
  await db.batch([
    db
      .insert(bookingSettings)
      .values({ id: 1, ...input.settings, updatedAt: now })
      .onConflictDoUpdate({
        target: bookingSettings.id,
        set: { ...input.settings, updatedAt: now },
      }),
    ...input.windows.map((window) =>
      db
        .insert(availabilityWindows)
        .values({ ...window, updatedAt: now })
        .onConflictDoUpdate({
          target: availabilityWindows.weekday,
          set: {
            enabled: window.enabled,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
            updatedAt: now,
          },
        }),
    ),
  ]);
  revalidatePath("/crm/availability");
  return { success: true, message: "Availability saved." };
}
// --- /book public intake (Sprint 3) -----------------------------------
//
// "Requesting contact," never an automatic booked meeting: this does NOT
// touch bookings/availabilityWindows/gatewayInvitations. It reuses the
// existing Lead vocabulary -- a Lead is just a clients row with
// status: "lead" -- and logs the raw request as an immutable crm_events
// row, the same evidence-preservation pattern submitBriefing already
// uses for gateway briefings. MindBunker is the source of truth; email
// notification is a deferred extension point (no email provider is
// configured anywhere in this repo yet -- see the Sprint 3 report).
//
// Lookup-or-create by email avoids blindly duplicating an existing lead
// or client on a repeat submission. Idempotency: the client mints a
// random key once per form mount (crypto.randomUUID()); a pre-check
// against crm_events.idempotencyKey short-circuits an exact resubmit
// before any lookup-or-create runs, and the insert itself is additionally
// guarded by the idempotency_key unique index via onConflictDoNothing as
// a last-resort race guard. This does not claim to close every possible
// concurrent-request race (see Sprint 3 report) -- it closes the
// realistic case, a form double-submit.

export type PublicBookingRequestActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function submitPublicBookingRequest(
  _previousState: PublicBookingRequestActionState,
  formData: FormData,
): Promise<PublicBookingRequestActionState> {
  const idempotencyKey =
    typeof formData.get("idempotencyKey") === "string"
      ? (formData.get("idempotencyKey") as string).slice(0, 100)
      : null;

  const validation = validatePublicBookingRequestInput({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    serviceInterest: formData.get("serviceInterest"),
    message: formData.get("message"),
  });
  if (!validation.success) {
    return { errors: validation.errors, message: "Check the highlighted fields." };
  }

  const db = await getDb();

  if (idempotencyKey) {
    const already = await db
      .select({ id: crmEvents.id })
      .from(crmEvents)
      .where(eq(crmEvents.idempotencyKey, idempotencyKey))
      .limit(1);
    if (already.length > 0) {
      return { success: true };
    }
  }

  const data = validation.data;
  const now = new Date();
  const descriptionParts = [
    `Booking request from ${data.name} (${data.email})`,
    data.phone ? `Phone: ${data.phone}` : null,
    data.serviceInterest ? `Interested in: ${data.serviceInterest}` : null,
    data.message ? `Message: ${data.message}` : null,
  ].filter(Boolean);
  const description = descriptionParts.join(" — ").slice(0, 4_000);

  const existingClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`lower(${clients.email}) = ${data.email}`)
    .limit(1);

  let clientId: number;
  if (existingClient[0]) {
    clientId = existingClient[0].id;
    await db
      .update(clients)
      .set({ lastInteractionAt: now })
      .where(eq(clients.id, clientId));
  } else {
    const inserted = await db
      .insert(clients)
      .values({
        name: data.name,
        status: "lead",
        opportunityStage: "new",
        email: data.email,
        phone: data.phone,
        serviceInterest: data.serviceInterest,
        source: "book",
        contacted: false,
        converted: false,
        lastInteractionAt: now,
      })
      .returning({ id: clients.id });
    if (!inserted[0]) {
      return { message: "Something went wrong. Please try again." };
    }
    clientId = inserted[0].id;
    await db.insert(crmEvents).values({
      clientId,
      type: "lead_created",
      actor: "gateway",
      description: `Lead created from /book: ${data.name}`,
    });
  }

  await db
    .insert(crmEvents)
    .values({
      clientId,
      type: BOOK_REQUEST_EVENT_TYPE,
      actor: "gateway",
      description,
      idempotencyKey,
    })
    .onConflictDoNothing({ target: crmEvents.idempotencyKey });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return { success: true };
}
