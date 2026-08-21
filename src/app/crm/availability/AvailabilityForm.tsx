"use client";

import { useState, useTransition } from "react";
import {
  BOOKING_BUFFER_OPTIONS,
  BOOKING_DURATION_OPTIONS,
  BOOKING_HORIZON_OPTIONS,
  BOOKING_NOTICE_OPTIONS,
  WEEKDAY_LABELS,
} from "@/modules/booking/config";
import {
  minuteToTime,
  parseTimeToMinute,
  type AvailabilityWindowValue,
  type BookingSettingsValue,
} from "@/modules/booking/core";
import { updateBookingAvailability } from "@/modules/booking/actions";

const fieldClassName =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 md:text-sm";

type EditableWindow = Omit<AvailabilityWindowValue, "startMinute" | "endMinute"> & {
  startTime: string;
  endTime: string;
};

export function AvailabilityForm({
  initialSettings,
  initialWindows,
}: {
  initialSettings: BookingSettingsValue;
  initialWindows: AvailabilityWindowValue[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [windows, setWindows] = useState<EditableWindow[]>(
    initialWindows.map((window) => ({
      weekday: window.weekday,
      enabled: window.enabled,
      startTime: minuteToTime(window.startMinute),
      endTime: minuteToTime(window.endMinute),
    })),
  );
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateWindow(weekday: number, change: Partial<EditableWindow>) {
    setWindows((current) =>
      current.map((window) =>
        window.weekday === weekday ? { ...window, ...change } : window,
      ),
    );
  }

  function save() {
    const parsed = windows.map((window) => ({
      weekday: window.weekday,
      enabled: window.enabled,
      startMinute: parseTimeToMinute(window.startTime),
      endMinute: parseTimeToMinute(window.endTime),
    }));
    if (parsed.some((window) => window.startMinute === null || window.endMinute === null)) {
      setFeedback("Check the start and end times.");
      return;
    }
    setFeedback("");
    startTransition(async () => {
      const result = await updateBookingAvailability({
        settings,
        windows: parsed as AvailabilityWindowValue[],
      });
      setFeedback(result.success ? result.message ?? "Availability saved." : result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-white">Online booking</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Turn this off without deleting your weekly schedule.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${settings.enabled ? "bg-cyan-600" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settings.enabled ? "left-7" : "left-1"}`} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-bold text-zinc-500 sm:col-span-2 lg:col-span-1">
            Operator timezone
            <input
              value={settings.timezone}
              onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
              list="booking-timezones"
              autoCapitalize="none"
              autoCorrect="off"
              className={`${fieldClassName} mt-1.5`}
            />
            <datalist id="booking-timezones">
              <option value="America/Sao_Paulo" />
              <option value="America/New_York" />
              <option value="Europe/London" />
              <option value="UTC" />
            </datalist>
          </label>
          <label className="text-xs font-bold text-zinc-500">
            Call length
            <select
              value={settings.durationMinutes}
              onChange={(event) => setSettings((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
              className={`${fieldClassName} mt-1.5`}
            >
              {BOOKING_DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value} min</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-zinc-500">
            Buffer
            <select
              value={settings.bufferMinutes}
              onChange={(event) => setSettings((current) => ({ ...current, bufferMinutes: Number(event.target.value) }))}
              className={`${fieldClassName} mt-1.5`}
            >
              {BOOKING_BUFFER_OPTIONS.map((value) => <option key={value} value={value}>{value} min</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-zinc-500">
            Minimum notice
            <select
              value={settings.minimumNoticeHours}
              onChange={(event) => setSettings((current) => ({ ...current, minimumNoticeHours: Number(event.target.value) }))}
              className={`${fieldClassName} mt-1.5`}
            >
              {BOOKING_NOTICE_OPTIONS.map((value) => <option key={value} value={value}>{value} hours</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-zinc-500">
            Booking horizon
            <select
              value={settings.bookingHorizonDays}
              onChange={(event) => setSettings((current) => ({ ...current, bookingHorizonDays: Number(event.target.value) }))}
              className={`${fieldClassName} mt-1.5`}
            >
              {BOOKING_HORIZON_OPTIONS.map((value) => <option key={value} value={value}>{value} days</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4 sm:p-6">
          <h2 className="font-black text-white">Weekly availability</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            One clear window per day is enough for the current workload.
          </p>
        </div>
        <div className="divide-y divide-zinc-800">
          {windows.map((window) => (
            <div key={window.weekday} className="grid gap-3 p-4 sm:grid-cols-[8rem_1fr_1fr] sm:items-center sm:px-6">
              <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-zinc-300">
                <input
                  type="checkbox"
                  checked={window.enabled}
                  onChange={(event) => updateWindow(window.weekday, { enabled: event.target.checked })}
                  className="h-5 w-5 accent-cyan-500"
                />
                {WEEKDAY_LABELS[window.weekday]}
              </label>
              <label className="text-xs text-zinc-500">
                Start
                <input
                  type="time"
                  step={900}
                  value={window.startTime}
                  disabled={!window.enabled}
                  onChange={(event) => updateWindow(window.weekday, { startTime: event.target.value })}
                  className={`${fieldClassName} mt-1 disabled:opacity-40`}
                />
              </label>
              <label className="text-xs text-zinc-500">
                End
                <input
                  type="time"
                  step={900}
                  value={window.endTime}
                  disabled={!window.enabled}
                  onChange={(event) => updateWindow(window.weekday, { endTime: event.target.value })}
                  className={`${fieldClassName} mt-1 disabled:opacity-40`}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="min-h-14 w-full rounded-xl bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-500 disabled:opacity-60 sm:w-auto sm:min-w-48"
      >
        {isPending ? "Saving…" : "Save availability"}
      </button>
      {feedback && <p aria-live="polite" className="text-sm text-zinc-300">{feedback}</p>}
    </div>
  );
}

