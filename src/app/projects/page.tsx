import { displayClientName } from "@/lib/client-identity";
import { getProjectsOverview, getUnassignedClientVideos } from "@/modules/projects/actions";
import { getProductivityQuickOptions } from "@/modules/productivity/actions";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import {
  filterProjectsBySearch,
  getProjectException,
  getProjectNextAction,
  getProjectProgress,
  groupProjectsForOverview,
  isProjectOverdue,
  type ProjectExceptionKind,
  type ProjectOverviewItem,
  type ProjectSortMode,
} from "@/modules/projects/core";
import { PROJECT_GROUP_LABELS, PROJECT_GROUPS, PROJECT_STATUS_LABELS, type ProjectGroup } from "@/modules/projects/config";
import { formatDate, todayISO } from "@/utils/date";
import { formatLastActive } from "@/modules/work-sessions/core";
import Link from "next/link";
import { ClientFilter } from "./ClientFilter";
import { StatusFilter } from "./StatusFilter";
import { ProjectSearch } from "./ProjectSearch";
import { SortToggle } from "./SortToggle";
import { NewProjectButton } from "./NewProjectButton";
import { resolveCoverUrl } from "@/modules/media/core";
import { ProjectCover } from "./ProjectCover";
import { PixelEmptyState, PixelIcon } from "@/components/ui/PixelVisuals";

export const dynamic = "force-dynamic";

// Operator Flow round: cards now provide the requested visual recognition,
// but retain the hierarchy that made the compact-list redesign truthful:
// exception -> client -> project -> metadata. The grid stays grouped by
// client and uses the existing attention-first sort, so visuals do not
// flatten operational priority into a homogeneous gallery.

const EXCEPTION_LABEL: Record<ProjectExceptionKind, string> = {
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  PLANNED: "Planned",
};

const EXCEPTION_CLASS: Record<ProjectExceptionKind, string> = {
  OVERDUE: "border-red-500/40 bg-red-500/10 text-red-300",
  BLOCKED: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PLANNED: "border-zinc-600/50 bg-zinc-800/60 text-zinc-400",
};

function ProjectCard({
  project,
  today,
  nowIso,
}: {
  project: ProjectOverviewItem;
  today: string;
  nowIso: string;
}) {
  const exception = getProjectException(project, today);
  const nextAction = getProjectNextAction(project);
  const overdueDays = isProjectOverdue(project, today) && project.deadline
    ? Math.max(1, Math.round((Date.parse(today) - Date.parse(project.deadline)) / (24 * 60 * 60 * 1000)))
    : null;

  const progress = getProjectProgress(project);
  const coverUrl = resolveCoverUrl(
    project.coverUrl,
    project.clientDefaultCoverUrl,
    project.clientAvatarUrl,
  );

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`pixel-frame group overflow-hidden rounded-2xl border transition ${
        exception === "OVERDUE"
          ? "border-red-900/50 bg-red-950/10 hover:border-red-700/60"
          : exception === "BLOCKED"
            ? "border-amber-900/50 bg-amber-950/10 hover:border-amber-700/60"
            : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <ProjectCover url={coverUrl} projectName={project.name} clientName={project.clientName} />
      <div className="p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400/80">
              {displayClientName(project.clientName)}
            </p>
            <h3 className="mt-1 truncate text-base font-black text-white">{project.name}</h3>
          </div>
          {exception && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${EXCEPTION_CLASS[exception]}`}>
              {exception === "OVERDUE" && overdueDays ? `${overdueDays}d overdue` : EXCEPTION_LABEL[exception]}
            </span>
          )}
        </div>

        <div className="pixel-progress mt-4 h-1.5 overflow-hidden bg-zinc-800">
          <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-zinc-300">
            {project.totalVideos > 0 ? `${project.doneVideos}/${project.totalVideos} videos` : "No videos yet"}
          </span>
          <span className="text-zinc-600">{progress}% complete</span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-zinc-500">
          {nextAction ?? `Stage: ${PROJECT_STATUS_LABELS[project.status]}`}
        </p>

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-zinc-800/80 pt-3">
          <div>
          {project.deadline && (
            <p className={`text-xs font-bold ${exception === "OVERDUE" ? "text-red-300" : "text-zinc-500"}`}>
              Due {formatDate(project.deadline)}
            </p>
          )}
          {project.lastActiveAt && (
            <p className="text-[11px] text-zinc-600">
              Active {formatLastActive(project.lastActiveAt, nowIso)}
            </p>
          )}
          {!project.deadline && !project.lastActiveAt && <p className="text-[11px] text-zinc-700">No recent activity</p>}
          </div>
          <span className="shrink-0 text-xs font-black text-cyan-300">Open →</span>
        </div>
      </div>
    </Link>
  );
}

// QA fix (2026-09-14): real CLIENT_WORK videos with no project_id (see
// getUnassignedClientVideos) are otherwise structurally invisible when
// filtering Projects by client -- Productivity shows them, Projects
// never can, because Projects is entirely project-shaped. This is a
// bounded, operator-only indicator, not a fake project: it never invents
// a project row, and every link goes straight into Productivity (via the
// same canonical videoWorkspaceHref every other "open this video" link
// in the app already uses) -- the one place these videos actually live.
function UnassignedDeliverablesSection({
  videos,
}: {
  videos: Array<{ id: number; title: string | null; date: string; status: string; clientName: string }>;
}) {
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="unassigned-deliverables" className="rounded-2xl border border-amber-800/50 bg-amber-950/10 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <PixelIcon name="flag" className="h-3.5 w-3.5 text-amber-400" />
        <h2 id="unassigned-deliverables" className="text-sm font-black uppercase tracking-wide text-amber-300">
          Unassigned deliverables
        </h2>
        <span className="text-xs font-bold text-amber-600">{videos.length}</span>
      </div>
      <p className="mb-3 text-xs leading-5 text-zinc-500">
        Real client work with no project. Not a project -- open the video directly in Productivity to assign one.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={videoWorkspaceHref(video.id)}
            className="flex items-center justify-between gap-2 rounded-xl border border-amber-900/40 bg-zinc-950/60 px-3 py-2.5 text-xs hover:border-amber-600/60"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold text-zinc-200">{video.title ?? `Video ${formatDate(video.date)}`}</span>
              <span className="block truncate text-[11px] text-zinc-600">{video.clientName}</span>
            </span>
            <span className="shrink-0 font-black text-amber-400">Open →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProjectGroupSection({
  group,
  projects,
  today,
  nowIso,
}: {
  group: ProjectGroup;
  projects: ProjectOverviewItem[];
  today: string;
  nowIso: string;
}) {
  if (projects.length === 0) return null;
  return (
    <section aria-labelledby={`projects-${group}`}>
      <div className="mb-3 flex items-center gap-2">
        <PixelIcon name={group === "completed" ? "archive" : "project"} className={`h-3.5 w-3.5 ${group === "active" ? "text-cyan-400" : group === "planned" ? "text-violet-400" : "text-zinc-700"}`} />
        <h2 id={`projects-${group}`} className="text-sm font-black uppercase tracking-wide text-zinc-300">
          {PROJECT_GROUP_LABELS[group]}
        </h2>
        <span className="text-xs font-bold text-zinc-600">{projects.length}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} today={today} nowIso={nowIso} />
        ))}
      </div>
    </section>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string | string[]; status?: string | string[]; q?: string | string[]; sort?: string | string[] }>;
}) {
  const query = await searchParams;
  const clientFilterId =
    typeof query.client === "string" && query.client ? parseInt(query.client, 10) : null;
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const searchQuery = typeof query.q === "string" ? query.q : "";
  const sortMode: ProjectSortMode = query.sort === "recent" ? "recent" : "attention";

  const [allProjects, quickOptions, unassignedVideos] = await Promise.all([
    getProjectsOverview(),
    getProductivityQuickOptions(),
    getUnassignedClientVideos(),
  ]);
  const visibleUnassignedVideos =
    clientFilterId !== null
      ? unassignedVideos.filter((video) => video.clientId === clientFilterId)
      : unassignedVideos;
  // QA fix (2026-09-14): a client with ONLY unassigned deliverables (no
  // project at all yet) must still be reachable in the client filter --
  // otherwise Emmanuel has no way to select them and see the unassigned
  // section below.
  const clientOptions = Array.from(
    new Map([
      ...allProjects.map((p): [number, string] => [p.clientId, p.clientName]),
      ...unassignedVideos.map((v): [number, string] => [v.clientId, v.clientName]),
    ]).entries(),
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const today = todayISO();
  const nowIso = new Date().toISOString();

  // Aggregate counts always reflect the FULL unfiltered set -- "Active 9 ·
  // Planned 1 · Completed" describes the whole operation, not whatever
  // filter happens to be applied right now.
  const allGroups = groupProjectsForOverview(allProjects);

  let visibleProjects = allProjects;
  if (clientFilterId !== null) visibleProjects = visibleProjects.filter((p) => p.clientId === clientFilterId);
  if (statusFilter) visibleProjects = visibleProjects.filter((p) => p.status === statusFilter);
  visibleProjects = filterProjectsBySearch(visibleProjects, searchQuery);

  const visibleGroups = groupProjectsForOverview(visibleProjects);
  if (sortMode === "recent") {
    for (const group of PROJECT_GROUPS) {
      visibleGroups[group].sort((a, b) =>
        (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) || b.id - a.id,
      );
    }
  } else {
    const exceptionRank = (project: ProjectOverviewItem) => {
      const exception = getProjectException(project, today);
      return exception === "OVERDUE" ? 0 : exception === "BLOCKED" ? 1 : exception === "PLANNED" ? 2 : 3;
    };
    for (const group of PROJECT_GROUPS) {
      visibleGroups[group].sort((a, b) => exceptionRank(a) - exceptionRank(b));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Clients → projects → videos
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
          <PixelIcon name="project" className="h-5 w-5 text-cyan-300" /> Projects
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <NewProjectButton clients={quickOptions.clients} />
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-300">
            {allGroups.active.length} active
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-black text-zinc-400">
            {allGroups.planned.length} planned
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-black text-zinc-600">
            {allGroups.completed.length} completed
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {clientOptions.length > 1 && <ClientFilter clients={clientOptions} />}
          <StatusFilter />
          <SortToggle />
          <div className="ml-auto">
            <ProjectSearch />
          </div>
        </div>
      </header>

      {visibleUnassignedVideos.length > 0 && (
        <div className="mb-8">
          <UnassignedDeliverablesSection videos={visibleUnassignedVideos} />
        </div>
      )}

      {allProjects.length === 0 && visibleUnassignedVideos.length === 0 ? (
        <PixelEmptyState icon="project" title="No projects yet" className="rounded-2xl">
          <p>
            Choose a client in CRM to create the first work commitment.
          </p>
          <Link
            href="/crm"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-cyan-700 px-5 text-sm font-black text-white"
          >
            Open CRM
          </Link>
        </PixelEmptyState>
      ) : visibleProjects.length === 0 && visibleUnassignedVideos.length === 0 ? (
        <PixelEmptyState icon="archive" title="No matching projects" className="rounded-2xl">
          Adjust the current client, status, or search filter.
        </PixelEmptyState>
      ) : visibleProjects.length === 0 ? null : (
        <div className="space-y-8">
          {PROJECT_GROUPS.map((group) => (
            <ProjectGroupSection key={group} group={group} projects={visibleGroups[group]} today={today} nowIso={nowIso} />
          ))}
        </div>
      )}
    </div>
  );
}
