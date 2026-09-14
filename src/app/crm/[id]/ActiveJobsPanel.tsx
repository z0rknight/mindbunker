import Link from "next/link";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { resolveCoverUrl } from "@/modules/media/core";
import { boundedSlice, selectActiveJobs } from "@/modules/crm/spatial-composition";
import type { UnallocatedManualEvidence } from "@/modules/finance/actions";
import type { ClientBillingProjectBreakdown } from "@/modules/client-portal/core";
import { formatCurrency } from "@/utils/date";
import type { ClientProjectView } from "./ProjectManager";

const MAX_ACTIVE_PROJECTS = 4;
const MAX_VIDEOS_PER_PROJECT = 5;
const MAX_UNASSIGNED_VIDEOS = 4;

// 14SEP Patch Sniper (Operator Project Commercial Attribution): one
// compact, honestly-labeled commercial fact per project -- "confirmed
// attributable" billing_allocations, never a bare "$0" when nothing has
// been allocated (that's simply omitted), never labeled "Cost" /
// "Revenue" / "Total" since a project's allocations are not necessarily
// its full lifetime value. Video status breakdown reuses the exact same
// canonical lifecycle statuses already shown per-video below -- no new
// taxonomy.
function statusBreakdown(videos: ClientProjectView["videos"]): string {
  const counts = new Map<string, number>();
  for (const video of videos) counts.set(video.status, (counts.get(video.status) ?? 0) + 1);
  const order: Array<[string, string]> = [
    ["DONE", "done"],
    ["READY_FOR_REVIEW", "in review"],
    ["IN_PROGRESS", "in production"],
    ["CHANGES_REQUESTED", "updates in progress"],
    ["PLANNED", "planned"],
  ];
  return order
    .filter(([status]) => (counts.get(status) ?? 0) > 0)
    .map(([status, label]) => `${counts.get(status)} ${label}`)
    .join(" · ");
}

function ActiveJobCard({
  project,
  clientId,
  clientDefaultCoverUrl,
  clientAvatarUrl,
  commercial,
}: {
  project: ClientProjectView;
  clientId: number;
  clientDefaultCoverUrl: string | null;
  clientAvatarUrl: string | null;
  commercial: ClientBillingProjectBreakdown[];
}) {
  const { shown: shownVideos, hiddenCount } = boundedSlice(project.videos, MAX_VIDEOS_PER_PROJECT);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/35 transition hover:border-cyan-500/35 hover:bg-zinc-950/65">
      <Link href={`/projects/${project.id}`} className="group block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-black text-white group-hover:text-cyan-200">{project.name}</h4>
            <p className="mt-1 text-xs text-zinc-600">
              {project.deadline ? `Due ${project.deadline}` : "No deadline"} · {project.videos.length} video
              {project.videos.length === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{statusBreakdown(project.videos)}</p>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
        {commercial.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {commercial.map((row) => (
              <span
                key={row.currency}
                className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-2.5 py-1 text-xs font-black text-emerald-300"
              >
                Confirmed attributable {formatCurrency(row.amount, row.currency)}
                {row.minutes !== null && (
                  <span className="ml-1 font-normal text-emerald-400/70">
                    · {row.minutes >= 60 ? `${Math.floor(row.minutes / 60)}h ${row.minutes % 60}m` : `${row.minutes}m`} allocated
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs font-black text-cyan-400">Open project workspace →</p>
      </Link>

      {shownVideos.length > 0 && (
        <div className="border-t border-zinc-800 p-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {shownVideos.map((video) => {
              const coverUrl = resolveCoverUrl(video.coverUrl, project.coverUrl, clientDefaultCoverUrl, clientAvatarUrl);
              return (
                <Link
                  key={video.id}
                  href={`/productivity?video=${video.id}&returnTo=${encodeURIComponent(`/crm/${clientId}?tab=projects`)}`}
                  className="group/video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-violet-500/40"
                  title={video.title ?? "Untitled video"}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="" className="h-full w-full object-cover transition group-hover/video:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-zinc-700">🎬</div>
                    )}
                    {video.isPriority && (
                      <span className="absolute left-1 top-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-200">
                        ⭐
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <Link
              href={`/projects/${project.id}`}
              className="mt-2 inline-block text-[11px] font-bold text-zinc-500 hover:text-cyan-300"
            >
              +{hiddenCount} more in this project →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export function ActiveJobsPanel({
  clientId,
  clientDefaultCoverUrl,
  clientAvatarUrl,
  projects,
  unassignedVideos,
  commercialByProject,
  unallocatedManualEvidence,
}: {
  clientId: number;
  clientDefaultCoverUrl: string | null;
  clientAvatarUrl: string | null;
  projects: ClientProjectView[];
  unassignedVideos: Array<{ id: number; title: string | null; status: string; date: string }>;
  commercialByProject: Map<number, ClientBillingProjectBreakdown[]>;
  unallocatedManualEvidence: UnallocatedManualEvidence[];
}) {
  const { shown: activeProjects, hiddenCount: hiddenActiveCount } = selectActiveJobs(projects, MAX_ACTIVE_PROJECTS);
  const { shown: shownUnassigned } = boundedSlice(unassignedVideos, MAX_UNASSIGNED_VIDEOS);

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.03] p-4 sm:p-5" data-testid="active-jobs-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Active jobs</p>
          <h2 className="mt-1 font-black text-white">What&apos;s in motion</h2>
        </div>
        <Link href={`/crm/${clientId}?tab=projects`} className="text-xs font-bold text-cyan-400 hover:text-cyan-200">
          All projects →
        </Link>
      </div>

      {activeProjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
          No active or in-review projects right now.
        </p>
      ) : (
        <div className="space-y-3">
          {activeProjects.map((project) => (
            <ActiveJobCard
              key={project.id}
              project={project}
              clientId={clientId}
              clientDefaultCoverUrl={clientDefaultCoverUrl}
              clientAvatarUrl={clientAvatarUrl}
              commercial={commercialByProject.get(project.id) ?? []}
            />
          ))}
        </div>
      )}
      {hiddenActiveCount > 0 && (
        <Link
          href={`/crm/${clientId}?tab=projects`}
          className="mt-2 inline-block text-[11px] font-bold text-zinc-500 hover:text-cyan-300"
        >
          +{hiddenActiveCount} more active project{hiddenActiveCount === 1 ? "" : "s"} →
        </Link>
      )}

      {shownUnassigned.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
            Unassigned deliverables ({unassignedVideos.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {shownUnassigned.map((video) => (
              <Link
                key={video.id}
                href={`/productivity?video=${video.id}&returnTo=${encodeURIComponent(`/crm/${clientId}`)}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:border-violet-500/40 hover:text-violet-200"
              >
                {video.title ?? "Untitled video"}
              </Link>
            ))}
          </div>
        </div>
      )}

      {unallocatedManualEvidence.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            Unallocated historical billing
          </p>
          <div className="space-y-1.5">
            {unallocatedManualEvidence.map((evidence) => (
              <div
                key={evidence.id}
                className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2 text-xs"
              >
                <span className="font-black text-amber-300">{formatCurrency(evidence.amount, evidence.currency)}</span>
                <span className="ml-2 text-zinc-500">
                  {evidence.periodStart} – {evidence.periodEnd} · not assigned to a current project
                </span>
                <p className="mt-0.5 text-[11px] text-zinc-600">{evidence.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
