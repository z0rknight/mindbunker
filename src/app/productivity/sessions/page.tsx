import Link from "next/link";
import {
  getSessionNarratives,
  getSessionTimelineItems,
  getVideoOptionsForCorrection,
  getWorkSessionHistory,
} from "@/modules/work-sessions/data";
import {
  dayKeyFor,
  formatClosedDuration,
  groupWorkSessionDaysByWeek,
  groupWorkSessionsByDay,
  mondayOfWeek,
} from "@/modules/work-sessions/core";
import { filterSessionTimelineItems } from "@/modules/work-sessions/timeline";
import { WorkSessionHistoryTable } from "./WorkSessionHistoryTable";
import {
  SessionViewSwitcher,
  type SessionTimelineRangeMode,
  type SessionViewMode,
} from "./SessionViewSwitcher";
import { SessionTimeline } from "./SessionTimeline";
import { SessionWeekCalendar } from "./SessionWeekCalendar";
import { SessionMonthCalendar } from "./SessionMonthCalendar";
import { SessionRangeTimeline } from "./SessionRangeTimeline";
import { shiftDateKey } from "@/utils/date";

export const dynamic = "force-dynamic";

type SearchParams = {
  video?: string | string[];
  project?: string | string[];
  view?: string | string[];
  date?: string | string[];
  client?: string | string[];
  source?: string | string[];
  workType?: string | string[];
  range?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export default async function WorkSessionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const rawVideo = query.video;
  const filterVideoId =
    typeof rawVideo === "string" && /^\d+$/u.test(rawVideo) ? Number(rawVideo) : null;
  const rawProject = query.project;
  const filterProjectId =
    typeof rawProject === "string" && /^\d+$/u.test(rawProject) ? Number(rawProject) : null;

  const requestedView = firstParam(query.view);
  // Existing deep links (Projects page, WorkSessionPanel, Sensor pages) all
  // point at this route with ?video= / ?project= and no ?view= at all,
  // expecting the flat correction-capable list they've always gotten --
  // those links must keep working exactly as before. Only when neither
  // legacy filter is present, or ?view= is explicit, does the new
  // Timeline/Week default apply.
  const hasLegacyFilter = filterVideoId !== null || filterProjectId !== null;
  const view: SessionViewMode =
    requestedView === "timeline" || requestedView === "week" || requestedView === "month" || requestedView === "table"
      ? requestedView
      : hasLegacyFilter
        ? "table"
        : "timeline";

  if (view === "table") {
    const [sessions, videoOptions] = await Promise.all([
      getWorkSessionHistory(undefined, filterVideoId, filterProjectId),
      getVideoOptionsForCorrection(),
    ]);
    // Session Narrative (Sunday Systems Round, Phase B/C/D): must run after
    // sessions resolves -- it correlates against this exact page own session
    // set, not the whole ledger, so it stays cheap even at the 200-row cap.
    const narratives = await getSessionNarratives(sessions);
    const days = groupWorkSessionsByDay(sessions);
    const weeks = groupWorkSessionDaysByWeek(days);
    const totalClosedSeconds = days.reduce((sum, day) => sum + day.totalClosedSeconds, 0);
    // Local dogfooding consolidation: prefer the filtered video own title from
    // an actual returned session (always correct); fall back to the existing
    // 300-most-recent video picker list so a video with zero sessions still
    // shows a real name instead of just "#42".
    const filterVideoTitle =
      filterVideoId === null
        ? null
        : (sessions[0]?.videoTitle ??
          videoOptions.find((option) => option.id === filterVideoId)?.title ??
          `Video #${filterVideoId}`);
    const filterProjectTitle =
      filterProjectId === null ? null : (sessions[0]?.projectName ?? "this project");

    return (
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
        <div className="mb-6">
          <Link
            href="/productivity"
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
          >
            ← Productivity
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">🗂️ Work Session Ledger</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every Work Session ever recorded, grouped by day and week. Correct a
            closed session if the times, video, activity, or note were wrong —
            corrections are logged, not silent (Sprint 1.2.1).
          </p>
          <Link href="/productivity/sensor" className="mt-3 inline-flex text-xs font-bold text-violet-300 hover:text-violet-200">
            Open observed Sensor Activity →
          </Link>
          {!hasLegacyFilter && (
            <div className="mt-3">
              <SessionViewSwitcher view="table" dateKey={dayKeyFor(new Date().toISOString())} />
            </div>
          )}
          {sessions.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-zinc-400">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} shown ·{" "}
              {formatClosedDuration(totalClosedSeconds)} tracked total
            </p>
          )}
        </div>

        {(filterVideoId !== null || filterProjectId !== null) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-4">
            <p className="text-xs leading-5 text-cyan-200">
              <span className="font-bold uppercase tracking-wide">Filtered to —</span>{" "}
              {filterVideoId !== null ? filterVideoTitle : `every video in ${filterProjectTitle}`}
            </p>
            <Link
              href="/productivity/sessions"
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
            >
              Clear filter · show all sessions →
            </Link>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-xs leading-5 text-amber-200">
          <span className="font-bold uppercase tracking-wide">Provenance note —</span>{" "}
          every row below records its capture source: web timer{" "}
          <code className="rounded bg-black/30 px-1">WEB_TIMER</code> or explicitly approved Sensor evidence{" "}
          <code className="rounded bg-black/30 px-1">MAC_SENSOR_APPROVED</code>, unless
          marked <span className="font-bold">Corrected</span>. A future passive
          desktop sensor would write to its own, separate observation stream —
          never into this table.
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/35 px-4 py-8 text-center text-sm text-zinc-600">
            {filterVideoId !== null
              ? "No work sessions recorded for this video yet."
              : filterProjectId !== null
                ? "No work sessions recorded for this project yet."
                : "No work sessions recorded yet."}
          </div>
        ) : (
          <WorkSessionHistoryTable weeks={weeks} videoOptions={videoOptions} narratives={narratives} />
        )}
      </div>
    );
  }

  // ── Timeline / Week ────────────────────────────────────────────────────
  const now = new Date();
  const todayKey = dayKeyFor(now.toISOString());
  const rawDate = firstParam(query.date);
  const dateKey = rawDate && DATE_KEY_PATTERN.test(rawDate) ? rawDate : todayKey;
  const mondayKey = mondayOfWeek(dateKey);
  const monthKey = dateKey.slice(0, 7);
  const requestedRange = firstParam(query.range);
  const timelineRange: SessionTimelineRangeMode =
    requestedRange === "7d" || requestedRange === "30d" || requestedRange === "month"
      ? requestedRange
      : "day";

  const clientFilter = firstParam(query.client);
  const sourceFilter = firstParam(query.source);
  const workTypeFilter = firstParam(query.workType);

  const [items, videoOptions] = await Promise.all([
    getSessionTimelineItems(
      view === "week"
        ? { kind: "week", mondayKey }
        : view === "month" || (view === "timeline" && timelineRange === "month")
          ? { kind: "month", monthKey }
          : view === "timeline" && timelineRange !== "day"
            ? {
                kind: "span",
                startKey: shiftDateKey(dateKey, timelineRange === "7d" ? -6 : -29),
                endKey: dateKey,
              }
            : { kind: "day", dayKey: dateKey },
      now,
    ),
    getVideoOptionsForCorrection(),
  ]);
  const filteredItems = filterSessionTimelineItems(items, {
    clientId: clientFilter,
    source: sourceFilter,
    workType: workTypeFilter,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6">
        <Link
          href="/productivity"
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
        >
          ← Productivity
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">🗂️ Sessions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          What actually happened, in order — canonical Work Sessions only.
          Nothing here is revenue or billing evidence.
        </p>
        <Link href="/productivity/sensor" className="mt-3 inline-flex text-xs font-bold text-violet-300 hover:text-violet-200">
          Open observed Sensor Activity →
        </Link>
      </div>

      <SessionViewSwitcher
        view={view}
        dateKey={dateKey}
        mondayKey={mondayKey}
        monthKey={monthKey}
        timelineRange={timelineRange}
        clientFilter={clientFilter}
        sourceFilter={sourceFilter}
        workTypeFilter={workTypeFilter}
        items={items}
      />

      {view === "timeline" && timelineRange !== "day" ? (
        <SessionRangeTimeline
          items={filteredItems}
          totalCountBeforeFilters={items.length}
        />
      ) : view === "timeline" ? (
        <SessionTimeline
          items={filteredItems}
          totalCountBeforeFilters={items.length}
          dateKey={dateKey}
          nowIso={now.toISOString()}
          videoOptions={videoOptions}
        />
      ) : view === "week" ? (
        <SessionWeekCalendar
          items={filteredItems}
          mondayKey={mondayKey}
          nowIso={now.toISOString()}
        />
      ) : (
        <SessionMonthCalendar items={filteredItems} monthKey={monthKey} />
      )}
    </div>
  );
}
