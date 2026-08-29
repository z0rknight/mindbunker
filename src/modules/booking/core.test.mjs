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
  validatePublicBookingRequestInput,
} from "./core.ts";
import { getCalendarProvider, MockCalendarProvider } from "./provider.ts";

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

test("production booking fails closed instead of confirming mock meetings", () => {
  assert.equal(getCalendarProvider("production"), null);
  assert.ok(getCalendarProvider("development") instanceof MockCalendarProvider);
  assert.ok(getCalendarProvider("test") instanceof MockCalendarProvider);
});


// Sprint 3 — /book public intake ("requesting contact," never an
// automatic booked meeting).
test("validatePublicBookingRequestInput requires a name and a valid email", () => {
  const missing = validatePublicBookingRequestInput({ name: "", email: "" });
  assert.equal(missing.success, false);
  assert.ok(missing.errors.name);
  assert.ok(missing.errors.email);

  const badEmail = validatePublicBookingRequestInput({
    name: "Jane Doe",
    email: "not-an-email",
  });
  assert.equal(badEmail.success, false);
  assert.ok(badEmail.errors.email);
});

test("validatePublicBookingRequestInput accepts the minimum fields and normalizes email", () => {
  const result = validatePublicBookingRequestInput({
    name: "  Jane Doe  ",
    email: "  Jane@Example.COM ",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.name, "Jane Doe");
  assert.equal(result.data.email, "jane@example.com");
  assert.equal(result.data.phone, null);
  assert.equal(result.data.serviceInterest, null);
  assert.equal(result.data.message, null);
});

test("validatePublicBookingRequestInput passes through optional phone/serviceInterest/message and ignores an invalid serviceInterest", () => {
  const valid = validatePublicBookingRequestInput({
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 000 0000",
    serviceInterest: "short-form",
    message: "Need a launch film",
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.phone, "+1 555 000 0000");
  assert.equal(valid.data.serviceInterest, "short-form");
  assert.equal(valid.data.message, "Need a launch film");

  const bogus = validatePublicBookingRequestInput({
    name: "Jane Doe",
    email: "jane@example.com",
    serviceInterest: "not-a-real-option",
  });
  assert.equal(bogus.success, true);
  assert.equal(bogus.data.serviceInterest, null);
});
