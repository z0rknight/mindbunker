"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertHealthLog } from "@/modules/health/actions";
import { logCaffeineEvent } from "@/modules/caffeine/actions";
import { formatDate } from "@/utils/date";

// ─── Last Night's Sleep (Monday Local Intelligence Lab §E) ─────────────────
//
// A low-friction alternative to the multi-field "Log Today" form, for the
// one field someone actually wants to log first thing in the morning.
// Reuses upsertHealthLog exactly as-is -- the date semantics are already
// correct (an entry made on day D writes sleepHours onto day D's row, i.e.
// "the night leading into today"), no schema or logic change needed, only
// this narrower, faster entry point plus copy that makes the semantics
// explicit so there's no ambiguity with tonight's sleep.
const SLEEP_PRESETS = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

export function LastNightSleepButton({ todayISODate }: { todayISODate: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [customHours, setCustomHours] = useState("");
  const [flash, setFlash] = useState(false);
  const router = useRouter();

  function logHours(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 24) return;
    startTransition(async () => {
      await upsertHealthLog({ sleepHours: value });
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
      setOpen(false);
      router.refresh();
    });
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    logHours(Number(customHours));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={`flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm transition-all w-full
          ${flash ? "bg-indigo-500 text-white scale-95" : "bg-indigo-800 hover:bg-indigo-700 text-white active:scale-95"}
          ${isPending ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className="text-2xl">{flash ? "✅" : "😴"}</span>
        <span>{flash ? "Logged!" : "Last Night's Sleep"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">😴 Last Night&rsquo;s Sleep</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-zinc-500 text-xs mb-4">
              This logs the night leading into today ({formatDate(todayISODate)}) —
              not tonight&rsquo;s sleep.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SLEEP_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => logHours(h)}
                  disabled={isPending}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {h}h
                </button>
              ))}
            </div>
            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                max="24"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                placeholder="Custom (hours)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isPending || !customHours}
                className="rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold px-4 text-sm transition-colors disabled:opacity-60"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── ☕ +1 Coffee (Monday Local Intelligence Lab §F/I) ──────────────────────
//
// One click, one timestamped caffeine_events row, immediate feedback. No
// form -- this is the entire interaction. todayCount comes from the server
// (getCaffeineSummary()); displayCount shows the increment instantly on
// click, then re-syncs to the authoritative server count once
// router.refresh() delivers a new todayCount prop. That resync happens
// during render (comparing todayCount against a ref-tracked previous
// value), per React's documented "adjusting state when a prop changes"
// pattern -- not inside a useEffect, which would cause an extra render.
export function CoffeeQuickLogButton({ todayCount }: { todayCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);
  const [displayCount, setDisplayCount] = useState(todayCount);
  const [syncedTodayCount, setSyncedTodayCount] = useState(todayCount);
  const router = useRouter();

  if (todayCount !== syncedTodayCount) {
    setSyncedTodayCount(todayCount);
    setDisplayCount(todayCount);
  }

  function handleClick() {
    setDisplayCount((c) => c + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
    startTransition(async () => {
      await logCaffeineEvent();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Log one coffee"
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all active:scale-95 w-full
        ${flash ? "border-amber-400 bg-amber-500 text-white scale-95" : "border-amber-800/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40"}
        ${isPending ? "opacity-80" : "cursor-pointer"}
      `}
    >
      <span className="text-xl">☕</span>
      <span>{flash ? "Logged!" : "+1 Coffee"}</span>
      <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-xs tabular-nums">
        {displayCount}
      </span>
    </button>
  );
}
