import Link from "next/link";
import { getWorkSessionHistory } from "@/modules/work-sessions/data";
import { dayKeyFor, formatClosedDuration } from "@/modules/work-sessions/core";
import { getHealthLogForDate } from "@/modules/health/actions";
import { getProductivityQuickOptions } from "@/modules/productivity/actions";
import { shiftDateKey, todayISO } from "@/utils/date";
import { BackfillDayForm } from "./BackfillDayForm";
import { BackfillDateField } from "./BackfillDateField";

export const dynamic = "force-dynamic";

// Tuesday Patch Completion Round §I (re-opened): "Log Manual Time solves
// forgotten work-session time, but the original complaint was broader: I
// did not log in yesterday; I want to be able to fill in that day
// afterward." This is the one place that answers that -- choose a past
// date, see what MindBunker can already honestly record for it, record
// it, without visiting /productivity + Quick Capture + /health
// separately. Every write here is an existing canonical mutation
// (logManualWorkSession, upsertHealthLog); this page only orchestrates.
export default async function BackfillDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawDate = typeof query.date === "string" ? query.date : undefined;
  const today = todayISO();
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/u.test(rawDate) && rawDate <= today ? rawDate : shiftDateKey(today, -1);

  const [existingHealthLog, quickOptions, recentSessions] = await Promise.all([
    getHealthLogForDate(date),
    getProductivityQuickOptions(),
    getWorkSessionHistory(300),
  ]);

  // getWorkSessionHistory has no date filter of its own (it's a
  // recency-limit ledger read) -- this page only needs one day's worth,
  // so it filters the same day-key buckets the Work Session Ledger
  // already groups by (dayKeyFor), not a new date concept.
  const sessionsForDate = recentSessions
    .filter((session) => dayKeyFor(session.startedAt) === date)
    .map((session) => ({
      id: session.id,
      videoTitle: session.videoTitle,
      clientName: session.clientName,
      projectName: session.projectName,
      activityType: session.activityType,
      durationLabel:
        session.durationSeconds !== null ? formatClosedDuration(session.durationSeconds) : "Open session",
      source: session.source,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/productivity" className="inline-flex min-h-10 items-center text-sm font-bold text-zinc-500 transition hover:text-zinc-300">
        ← Productivity
      </Link>
      <header className="mt-2 mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Backfill Day</p>
        <h1 className="mt-1 text-2xl font-black text-white">Fill in a day you skipped</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
          Choose a past date, see what&apos;s already recorded for it, and add what&apos;s missing -- work time, capacity, and a
          short note. Everything here writes through the same facts Productivity and Health already use; nothing is
          invented just to fill this screen.
        </p>
      </header>

      <BackfillDateField date={date} today={today} />

      <BackfillDayForm
        date={date}
        existingHealthLog={
          existingHealthLog
            ? {
                sleepHours: existingHealthLog.sleepHours,
                caffeineMg: existingHealthLog.caffeineMg,
                screenTimeHours: existingHealthLog.screenTimeHours,
                cyclingKm: existingHealthLog.cyclingKm,
                cyclingMinutes: existingHealthLog.cyclingMinutes,
                walkingMinutes: existingHealthLog.walkingMinutes,
                substancesNotes: existingHealthLog.substancesNotes,
              }
            : null
        }
        quickOptions={quickOptions}
        sessionsForDate={sessionsForDate}
      />
    </div>
  );
}
