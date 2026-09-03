import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import type { OperationalVideoEntry } from "@/modules/productivity/core";
import type {
  VideoContentType,
  VideoKind,
  VideoOrientation,
  VideoStatus,
} from "@/modules/productivity/config";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  formatClosedDuration,
  type VideoWorkSessionState,
} from "@/modules/work-sessions/core";
import { formatDate } from "@/utils/date";
import Link from "next/link";
import { DeleteVideoLogButton } from "./DeleteVideoLogButton";
import { VideoEditor } from "./VideoEditor";

type VideoRow = {
  id: number;
  date: string;
  title: string | null;
  clientId: number | null;
  clientName: string | null;
  projectId: number | null;
  projectName: string | null;
  projectStatus: string | null;
  projectDeadline: string | null;
  status: VideoStatus;
  startedAt: Date | null;
  revisionsCount: number;
  delivered: boolean;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  notes: string | null;
  coverUrl: string | null;
  orientation: VideoOrientation | null;
  contentType: VideoContentType | null;
  videoKind: VideoKind;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type VideoOperationsCardProps = {
  video: OperationalVideoEntry<VideoRow>;
  clients: Array<{ id: number; name: string }>;
  projects: Array<{
    id: number;
    name: string;
    clientId: number;
    clientName: string;
  }>;
  workSessionState: VideoWorkSessionState;
  initiallyOpen: boolean;
  // Brief C §8: internal-only redirect target for "close" when this card
  // was reached from a Project workspace link; already validated by
  // isSafeInternalPath in the page before it ever reaches here.
  returnTo?: string;
  compact?: boolean;
};

export function VideoOperationsCard({
  video,
  clients,
  projects,
  workSessionState,
  initiallyOpen,
  returnTo,
  compact = false,
}: VideoOperationsCardProps) {
  const title = video.title ?? `Video ${formatDate(video.date)}`;
  const openSession = workSessionState.openSession;
  const isThisVideoActive = openSession?.videoId === video.id;
  const hasAnotherActiveVideo = Boolean(openSession && !isThisVideoActive);
  const projectHref =
    video.projectId
      ? `/projects/${video.projectId}`
      : null;

  return (
    <article
      className={`group rounded-2xl border bg-zinc-900/90 transition ${
        isThisVideoActive
          ? "border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_16px_50px_rgba(16,185,129,0.08)]"
          : video.group === "attention"
            ? "border-amber-500/25"
            : "border-zinc-800"
      } ${compact ? "p-4" : "p-4 sm:p-5"}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VideoStatusBadge status={video.status} />
            {isThisVideoActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]} now
              </span>
            )}
            {video.isOverdue && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-300">
                Project overdue
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-black leading-tight text-white sm:text-xl">
            {title}
          </h3>

          <nav aria-label={`${title} relationships`} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {video.clientId ? (
              <Link href={`/crm/${video.clientId}`} className="font-bold text-zinc-300 hover:text-cyan-300">
                {video.clientName ?? "Client"}
              </Link>
            ) : (
              <span className="text-zinc-500">Standalone</span>
            )}
            {video.projectId && video.projectName && (
              <>
                <span className="text-zinc-700">→</span>
                {projectHref ? (
                  <Link href={projectHref} className="font-bold text-cyan-400 hover:text-cyan-300">
                    {video.projectName}
                  </Link>
                ) : (
                  <span className="text-zinc-400">{video.projectName}</span>
                )}
              </>
            )}
          </nav>

          {!compact && video.notes && (
            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {video.notes}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[390px] lg:flex-none">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Tracked
            </p>
            <p className="mt-1 font-mono text-sm font-black text-white">
              {formatClosedDuration(workSessionState.summary.closedSeconds)}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {workSessionState.summary.sessionCount} {workSessionState.summary.sessionCount === 1 ? "session" : "sessions"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Deadline
            </p>
            <p className={`mt-1 text-sm font-black ${video.isOverdue ? "text-red-300" : "text-zinc-200"}`}>
              {video.projectDeadline ? formatDate(video.projectDeadline) : "Not set"}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Project</p>
          </div>
          <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/55 p-3 sm:col-span-1">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Next
            </p>
            <p className="mt-1 text-sm font-black text-violet-200">{video.nextAction}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{formatDate(video.date)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800/80 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-xs font-bold text-zinc-500" aria-label={`${video.revisionsCount} revisions`}>
            ↻ {video.revisionsCount} {video.revisionsCount === 1 ? "revision" : "revisions"}
          </p>
          <DeleteVideoLogButton id={video.id} />
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {hasAnotherActiveVideo && (
            <Link
              href={`/productivity?video=${openSession?.videoId ?? ""}`}
              className="text-right text-[11px] font-bold text-amber-300 hover:text-amber-200"
            >
              Another video is being tracked →
            </Link>
          )}
          <VideoEditor
            video={{
              ...video,
              clientName: video.clientName,
              projectName: video.projectName,
              projectDeadline: video.projectDeadline,
              revisionsCount: video.revisionsCount,
            }}
            clients={clients}
            projects={projects}
            initialWorkSessionState={workSessionState}
            initiallyOpen={initiallyOpen}
            returnTo={returnTo}
            triggerLabel={isThisVideoActive ? "Open active workspace" : "Open workspace"}
          />
        </div>
      </div>
    </article>
  );
}
