import type { BusyInterval } from "./core.ts";

export type CalendarBookingInput = {
  idempotencyKey: string;
  startsAt: string;
  endsAt: string;
  attendeeName: string;
  attendeeEmail: string;
};

export interface CalendarProvider {
  readonly name: "mock" | "google";
  listBusyIntervals(range: {
    startsAt: string;
    endsAt: string;
  }): Promise<BusyInterval[]>;
  createBooking(input: CalendarBookingInput): Promise<{ eventId: string }>;
  rescheduleBooking(
    eventId: string,
    input: Pick<CalendarBookingInput, "startsAt" | "endsAt">,
  ): Promise<void>;
  cancelBooking(eventId: string): Promise<void>;
}

async function shortHash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock" as const;

  async listBusyIntervals() {
    return [];
  }

  async createBooking(input: CalendarBookingInput) {
    return { eventId: `mock_${await shortHash(input.idempotencyKey)}` };
  }

  async rescheduleBooking() {
    // The D1 booking is the deterministic local source of truth.
  }

  async cancelBooking() {
    // The D1 booking is the deterministic local source of truth.
  }
}

/**
 * The deterministic provider exists for local development and tests only.
 * Production must fail closed until a real calendar provider is configured:
 * a mock event is not a confirmed meeting.
 */
export function getCalendarProvider(
  runtime: string | undefined = process.env.NODE_ENV,
): CalendarProvider | null {
  return runtime === "production" ? null : new MockCalendarProvider();
}
