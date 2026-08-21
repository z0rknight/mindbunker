export const BOOKING_STATUSES = ["confirmed", "cancelled"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CALENDAR_PROVIDERS = ["mock", "google"] as const;

export type CalendarProviderName = (typeof CALENDAR_PROVIDERS)[number];

export const DEFAULT_BOOKING_SETTINGS = {
  id: 1,
  enabled: true,
  timezone: "America/Sao_Paulo",
  durationMinutes: 30,
  bufferMinutes: 15,
  minimumNoticeHours: 24,
  bookingHorizonDays: 30,
} as const;

export const BOOKING_DURATION_OPTIONS = [30, 45, 60] as const;
export const BOOKING_BUFFER_OPTIONS = [0, 15, 30] as const;
export const BOOKING_NOTICE_OPTIONS = [2, 12, 24, 48] as const;
export const BOOKING_HORIZON_OPTIONS = [14, 30, 60, 90] as const;

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const PUBLIC_SLOT_LIMIT = 18;

