"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelGatewayBooking,
  createGatewayBooking,
  getAvailableBookingSlots,
  rescheduleGatewayBooking,
} from "@/modules/booking/actions";
import { buildGoogleCalendarUrl } from "@/modules/booking/core";

type Slot = { startsAt: string; endsAt: string };
type BookingSummary = {
  status: "confirmed";
  startsAt: string;
  endsAt: string;
} | null;

function resolveBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function subscribeToTimezone() {
  return () => undefined;
}

function formatBooking(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function BookingPanel({
  token,
  initialBooking,
  initialSlots,
  initialError,
  initialTimezone,
}: {
  token: string;
  initialBooking: BookingSummary;
  initialSlots: Slot[];
  initialError: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [email, setEmail] = useState("");
  const timezone = useSyncExternalStore(
    subscribeToTimezone,
    resolveBrowserTimezone,
    () => initialTimezone,
  );
  const [feedback, setFeedback] = useState(initialError);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "booking" | "reschedule" | "cancel" | null
  >(null);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setFeedback("");
    const result = await getAvailableBookingSlots(token, timezone);
    if (result.success) {
      setSlots(result.slots);
      if (result.slots.length === 0) {
        setFeedback("No online times are open right now. Emmanuel can arrange one directly.");
      }
    } else {
      setSlots([]);
      setFeedback(result.error);
    }
    setLoadingSlots(false);
  }, [timezone, token]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: timezone,
      }).format(new Date(slot.startsAt));
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return Array.from(groups.entries());
  }, [slots, timezone]);

  function submitBooking() {
    if (!selectedSlot) {
      setFeedback("Choose a time first.");
      return;
    }
    setFeedback("");
    setPendingAction("booking");
    startTransition(async () => {
      const result = await createGatewayBooking({
        gatewayToken: token,
        startsAt: selectedSlot,
        attendeeEmail: email,
        visitorTimezone: timezone,
      });
      setFeedback(result.success ? result.message ?? "Your call is booked." : result.error);
      if (result.success) {
        setSelectedSlot("");
        router.refresh();
      } else {
        await loadSlots();
      }
      setPendingAction(null);
    });
  }

  function submitReschedule() {
    if (!selectedSlot) {
      setFeedback("Choose a new time first.");
      return;
    }
    setFeedback("");
    setPendingAction("reschedule");
    startTransition(async () => {
      const result = await rescheduleGatewayBooking({
        gatewayToken: token,
        startsAt: selectedSlot,
        visitorTimezone: timezone,
      });
      setFeedback(result.success ? result.message ?? "Your call was rescheduled." : result.error);
      if (result.success) {
        setSelectedSlot("");
        setRescheduling(false);
        router.refresh();
      } else {
        await loadSlots();
      }
      setPendingAction(null);
    });
  }

  function cancelBooking() {
    if (!confirm("Cancel this call? You can book another time afterwards.")) return;
    setFeedback("");
    setPendingAction("cancel");
    startTransition(async () => {
      const result = await cancelGatewayBooking(token);
      setFeedback(result.success ? result.message ?? "Your call was cancelled." : result.error);
      if (result.success) {
        setRescheduling(false);
        router.refresh();
      }
      setPendingAction(null);
    });
  }

  if (initialBooking && !rescheduling) {
    return (
      <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5 shadow-2xl shadow-black/20 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
          Call booked
        </p>
        <h2 className="mt-3 text-xl font-black text-white">
          {formatBooking(initialBooking.startsAt, timezone)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          The time above uses your device timezone. Emmanuel will send the call details separately.
        </p>
        {/* Sep 18 Morning Congruence Patch: smallest useful calendar
            behavior for a confirmed client booking -- a plain Google
            "render" link built from this booking's own real start/end in
            the visitor's own resolved timezone. No OAuth, nothing stored. */}
        <a
          href={buildGoogleCalendarUrl({
            title: "Call with RMEDIA",
            startsAt: initialBooking.startsAt,
            endsAt: initialBooking.endsAt,
            timezone,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-bold text-cyan-300 hover:text-cyan-200"
        >
          + Add to Google Calendar →
        </a>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setRescheduling(true);
              void loadSlots();
            }}
            disabled={isPending}
            className="min-h-12 rounded-xl bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:opacity-60"
          >
            Choose another time
          </button>
          <button
            type="button"
            onClick={cancelBooking}
            disabled={isPending}
            className="min-h-12 rounded-xl border border-red-900/70 px-4 text-sm font-bold text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
          >
            {pendingAction === "cancel" ? "Cancelling…" : "Cancel call"}
          </button>
        </div>
        {feedback && (
          <p aria-live="polite" className="mt-4 text-sm text-zinc-300">
            {feedback}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Optional call
          </p>
          <h2 className="mt-2 text-lg font-black text-white">
            {rescheduling ? "Choose a new time" : "Pick a time if a call helps"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Times appear in {timezone}. One tap selects; nothing is booked until you confirm.
          </p>
        </div>
        {rescheduling && (
          <button
            type="button"
            onClick={() => {
              setRescheduling(false);
              setSelectedSlot("");
              setFeedback("");
            }}
            className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Keep current
          </button>
        )}
      </div>

      {loadingSlots ? (
        <div className="mt-5 rounded-xl bg-zinc-950/60 p-4 text-sm text-zinc-500">
          Finding open times…
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {groupedSlots.map(([day, daySlots]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold text-zinc-400">{day}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {daySlots.map((slot) => {
                  const selected = selectedSlot === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setSelectedSlot(slot.startsAt)}
                      aria-pressed={selected}
                      className={`min-h-12 rounded-xl border px-2 text-sm font-black transition active:scale-[0.98] ${
                        selected
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                          : "border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: timezone,
                      }).format(new Date(slot.startsAt))}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!rescheduling && slots.length > 0 && (
        <div className="mt-5">
          <label htmlFor="bookingEmail" className="mb-2 block text-xs font-bold text-zinc-400">
            Email for the call
          </label>
          <input
            id="bookingEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="done"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>
      )}

      {slots.length > 0 && (
        <button
          type="button"
          onClick={rescheduling ? submitReschedule : submitBooking}
          disabled={isPending || !selectedSlot || (!rescheduling && !email.trim())}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-cyan-600 px-5 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPending
            ? pendingAction === "reschedule"
              ? "Rescheduling…"
              : "Booking…"
            : rescheduling
              ? "Confirm new time"
              : "Confirm call"}
        </button>
      )}

      {feedback && (
        <p aria-live="polite" className="mt-4 rounded-xl bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
          {feedback}
        </p>
      )}
    </section>
  );
}
