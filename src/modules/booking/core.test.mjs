import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanEmail,
  generateAvailableSlots,
  isValidTimeZone,
  minuteToTime,
  parseTimeToMinute,
  stageAfterBooking,
  validateAvailabilityWindows,
  validateBookingSettings,
} from "./core.ts";
import { MockCalendarProvider } from "./provider.ts";

const settings = {
  enabled: true,
  timezone: "UTC",
  durationMinutes: 30,
  bufferMinutes: 15,
  minimumNoticeHours: 2,
  bookingHorizonDays: 14,
};

const windows = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  enabled: weekday === 3,
  startMinute: 10 * 60,
  endMinute: 12 * 60,
}));

test("booking settings and one window per weekday validate explicitly", () => {
  assert.equal(validateBookingSettings(settings), true);
  assert.equal(validateAvailabilityWindows(windows), true);
  assert.equal(
    validateAvailabilityWindows([...windows.slice(0, 6), windows[0]]),
    false,
  );
  assert.equal(
    validateBookingSettings({ ...settings, durationMinutes: 37 }),
    false,
  );
});

test("slot generation respects windows, cadence, busy time, and buffer", () => {
  const slots = generateAvailableSlots({
    settings,
    windows,
    now: new Date("2026-08-19T07:50:00.000Z"),
    busyIntervals: [
      {
        startsAt: "2026-08-19T10:45:00.000Z",
        endsAt: "2026-08-19T11:15:00.000Z",
      },
    ],
    limit: 2,
  });

  assert.deepEqual(
    slots.map((slot) => slot.startsAt),
    ["2026-08-19T10:00:00.000Z", "2026-08-19T11:30:00.000Z"],
  );
});

test("disabled booking returns no public slots", () => {
  assert.deepEqual(
    generateAvailableSlots({
      settings: { ...settings, enabled: false },
      windows,
      busyIntervals: [],
      now: new Date("2026-08-19T07:50:00.000Z"),
    }),
    [],
  );
});

test("email, timezone, and time inputs fail closed", () => {
  assert.equal(cleanEmail("  Client@Example.com "), "client@example.com");
  assert.equal(cleanEmail("not-an-email"), null);
  assert.equal(isValidTimeZone("America/Sao_Paulo"), true);
  assert.equal(isValidTimeZone("Moon/Base"), false);
  assert.equal(parseTimeToMinute("10:30"), 630);
  assert.equal(parseTimeToMinute("25:00"), null);
  assert.equal(minuteToTime(630), "10:30");
});

test("booking advances only early opportunity stages", () => {
  assert.equal(stageAfterBooking("new"), "booked");
  assert.equal(stageAfterBooking("invited"), "booked");
  assert.equal(stageAfterBooking("offer_sent"), "offer_sent");
  assert.equal(stageAfterBooking("active"), "active");
});

test("local CalendarProvider returns a deterministic event id", async () => {
  const provider = new MockCalendarProvider();
  const input = {
    idempotencyKey: "booking-example-1",
    startsAt: "2026-08-20T13:00:00.000Z",
    endsAt: "2026-08-20T13:30:00.000Z",
    attendeeName: "Fictitious Lead",
    attendeeEmail: "lead@example.test",
  };
  const first = await provider.createBooking(input);
  const second = await provider.createBooking(input);

  assert.equal(first.eventId, second.eventId);
  assert.match(first.eventId, /^mock_[a-f0-9]{24}$/u);
  assert.deepEqual(
    await provider.listBusyIntervals({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
    [],
  );
});
