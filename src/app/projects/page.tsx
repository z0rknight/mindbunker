import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { displayClientName, getClientAccent } from "@/lib/client-identity";
import { getProjectsOverview } from "@/modules/projects/actions";
import { resolveCoverUrl } from "@/modules/media/core";
import { getProductivityQuickOptions } from "@/modules/productivity/actions";
import {
  PROJECT_GROUP_LABELS,
  PROJECT_GROUPS,
  type ProjectGroup,
} from "@/modules/projects/config";
import {
  getProjectProgress,
  groupProjectsForOverview,
  isProjectOverdue,
  type ProjectOverviewItem,
} from "@/modules/projects/core";
import { formatDate, todayISO } from "@/utils/date";
import { formatLastActive } from "@/modules/work-sessions/core";
import Link from "next/link";
import { ClientFilter } from "./ClientFilter";
import { NewProjectButton } from "./NewProjectButton";

export const dynamic = "force-dynamic";

const GROUP_DESCRIPTIONS: Record<ProjectGroup, string> = {
  active: "Work commitments currently moving through production or review.",
  planned: "Upcoming commitments that have not entered production yet.",
  completed: "Delivered work and projects intentionally removed from the active operation.",
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
  const progress = getProjectProgress(project);
  const overdue = isProjectOverdue(project, today);
  // Quick Morning Reality Patch §5/§6: a deterministic per-client accent
  // (color for a real client, neutral for RMEDIA's own internal record)
  // so clients read as visually distinct without a theme system, and a
  // left accent bar on the card itself so it's visible even before the
  // client name is read.
  const accent = getClientAccent(project.clientId, project.clientName);

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border-l-4 border-y border-r border-zinc-800 bg-zinc-900/80 shadow-sm ${accent.border}`}
    >
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {/* Sprint 3 P1 (Project + Video visual covers): Project cover
                -> Client avatar -> initials. */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-black text-zinc-400">
              {(() => {
                const coverUrl = resolveCoverUrl(project.coverUrl, project.clientAvatarUrl);
                return coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  project.clientName.slice(0, 2).toUpperCase()
                );
              })()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
                Project #{project.id}
              </p>
              <h3 className="mt-1 truncate text-lg font-black text-white">
                {project.name}
              </h3>
              <Link
                href={`/crm/${project.clientId}`}
                className={`mt-1 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold transition hover:opacity-80 ${accent.text}`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} aria-hidden="true" />
                {displayClientName(project.clientName)}
              </Link>
            </div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full border px-2.5 py-1 font-bold ${
              overdue
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-zinc-700 bg-zinc-950/60 text-zinc-400"
            }`}
          >
            {project.deadline
              ? `${overdue ? "Overdue" : "Due"} ${formatDate(project.deadline)}`
              : "No deadline"}
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2.5 py-1 font-bold text-zinc-400">
            {project.totalVideos} video{project.totalVideos === 1 ? "" : "s"}
          </span>
          {project.lastActiveAt && (
            <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2.5 py-1 font-bold text-zinc-500">
              Last active: {formatLastActive(project.lastActiveAt, nowIso)}
            </span>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
              Video progress
            </p>
            <p className="text-xs font-black text-zinc-300">
              {project.totalVideos === 0
                ? "No videos yet"
                : `${project.doneVideos}/${project.totalVideos} done`}
            </p>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-label={`${project.name} video completion`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-zinc-950/60 p-2">
              <p className="text-lg font-black text-emerald-300">{project.doneVideos}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-600">Done</p>
            </div>
            <div className="rounded-xl bg-zinc-950/60 p-2">
              <p className="text-lg font-black text-cyan-300">{project.inFlightVideos}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-600">In flight</p>
            </div>
            <div className="rounded-xl bg-zinc-950/60 p-2">
              <p className="text-lg font-black text-zinc-300">{project.plannedVideos}</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-600">Planned</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 p-3">
        <Link
          href={`/projects/${project.id}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-700 px-4 text-sm font-black text-white transition hover:bg-cyan-600"
        >
          Open project →
        </Link>
      </div>
    </article>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string | string[] }>;
}) {
  const query = await searchParams;
  const clientFilterId =
    typeof query.client === "string" && query.client ? parseInt(query.client, 10) : null;

  const [allProjects, quickOptions] = await Promise.all([
    getProjectsOverview(),
    getProductivityQuickOptions(),
  ]);
  const clientOptions = Array.from(
    new Map(allProjects.map((p) => [p.clientId, p.clientName])).entries(),
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const projects =
    clientFilterId !== null
      ? allProjects.filter((p) => p.clientId === clientFilterId)
      : allProjects;
  const groups = groupProjectsForOverview(projects);
  const today = todayISO();
  const nowIso = new Date().toISOString();

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Clients → projects → videos
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">📁 Projects</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
          What work commitments are active across all clients right now?
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <NewProjectButton clients={quickOptions.clients} />
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-300">
            {groups.active.length} active
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-black text-zinc-400">
            {groups.planned.length} planned
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-black text-zinc-600">
            {groups.completed.length} completed
          </span>
          {clientOptions.length > 1 && (
            <div className="ml-auto">
              <ClientFilter clients={clientOptions} />
            </div>
          )}
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
          <p className="font-black text-white">No projects yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Choose a client in CRM to create the first work commitment.
          </p>
          <Link
            href="/crm"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-cyan-700 px-5 text-sm font-black text-white"
          >
            Open CRM
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {PROJECT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`projects-${group}`}>
              <div className="mb-4">
                <h2
                  id={`projects-${group}`}
                  className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300"
                >
                  {PROJECT_GROUP_LABELS[group]} ({groups[group].length})
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  {GROUP_DESCRIPTIONS[group]}
                </p>
              </div>
              {groups[group].length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-sm text-zinc-600">
                  Nothing here right now.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {/* Quick Morning Reality Patch §5: cluster same-client
                      projects next to each other within each lifecycle
                      group (cheap client grouping, no restructuring of
                      the existing active/planned/completed sections). */}
                  {groups[group]
                    .toSorted((a, b) => a.clientName.localeCompare(b.clientName) || a.id - b.id)
                    .map((project) => (
                      <ProjectCard key={project.id} project={project} today={today} nowIso={nowIso} />
                    ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
