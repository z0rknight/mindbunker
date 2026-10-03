import Link from "next/link";
import { VideoOperationsCard } from "@/app/productivity/VideoOperationsCard";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getAllVideoLogs, getProductivityQuickOptions } from "@/modules/productivity/actions";
import {
  getVideoWorkspaceGroup,
  groupOperationalVideos,
  selectVideoWorkspaceLogs,
} from "@/modules/productivity/core";
import { getWorkSessionOverview } from "@/modules/work-sessions/data";
import { todayISO } from "@/utils/date";
import { isSafeInternalPath } from "@/utils/navigation";

export const dynamic = "force-dynamic";

export default async function VideoWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string | string[]; returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedVideo = query.video;
  const videoId =
    typeof requestedVideo === "string" && /^\d+$/u.test(requestedVideo)
      ? Number(requestedVideo)
      : null;
  const safeReturnTo =
    typeof query.returnTo === "string" && isSafeInternalPath(query.returnTo)
      ? query.returnTo
      : "/war-room";

  const [logs, options, overview] = await Promise.all([
    getAllVideoLogs(),
    getProductivityQuickOptions(),
    getWorkSessionOverview(),
  ]);
  const selectedLogs = selectVideoWorkspaceLogs(logs, videoId);
  const groups = groupOperationalVideos(selectedLogs, {
    today: todayISO(),
    openSessionVideoId: overview.openSession?.videoId,
  });
  const group = getVideoWorkspaceGroup(groups, videoId);
  const video = group && videoId !== null
    ? groups[group].find((candidate) => candidate.id === videoId) ?? null
    : null;
  const summary = videoId === null
    ? null
    : overview.summaries.find((candidate) => candidate.videoId === videoId) ?? {
        videoId,
        closedSeconds: 0,
        sessionCount: 0,
      };

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <header className="mb-6 flex flex-col gap-3 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">War Room · deep management</p>
          <h1 className="mt-1 text-2xl font-black text-white">Video workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">Edit the canonical video record without creating a second daily execution surface.</p>
        </div>
        <Link href={safeReturnTo} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-200 hover:border-cyan-500/50">
          ← Back to context
        </Link>
      </header>

      {video && summary ? (
        <VideoOperationsCard
          video={video}
          clients={options.clients}
          projects={options.projects}
          workSessionState={{ summary, openSession: overview.openSession }}
          initiallyOpen
          returnTo={safeReturnTo}
        />
      ) : (
        <section className="rounded-2xl border border-red-900/50 bg-red-950/10 p-6 text-center">
          <h2 className="text-lg font-black text-red-200">Video workspace unavailable</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {videoId === null
              ? "This link is malformed and does not identify a canonical video."
              : "This video does not exist, is unavailable, or is an operational container owned by a Production Order."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href={safeReturnTo} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-200">Back to context</Link>
            <Link href="/productivity/orders" className="rounded-lg border border-emerald-800 px-4 py-2 text-xs font-black text-emerald-300">Open Production Orders</Link>
          </div>
        </section>
      )}
    </div>
  );
}
