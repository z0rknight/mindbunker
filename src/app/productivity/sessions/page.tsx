import Link from "next/link";
import {
  getSessionNarratives,
  getVideoOptionsForCorrection,
  getWorkSessionHistory,
} from "@/modules/work-sessions/data";
import {
  formatClosedDuration,
  groupWorkSessionDaysByWeek,
  groupWorkSessionsByDay,
} from "@/modules/work-sessions/core";
import { WorkSessionHistoryTable } from "./WorkSessionHistoryTable";

export const dynamic = "force-dynamic";

export default async function WorkSessionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string | string[]; project?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawVideo = query.video;
  const filterVideoId =
    typeof rawVideo === "string" && /^\d+$/u.test(rawVideo) ? Number(rawVideo) : null;
  const rawProject = query.project;
  const filterProjectId =
    typeof rawProject === "string" && /^\d+$/u.test(rawProject) ? Number(rawProject) : null;

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
