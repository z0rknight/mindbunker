import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { getProjectsOverview } from "@/modules/projects/actions";
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
import Link from "next/link";

export const dynamic = "force-dynamic";

const GROUP_DESCRIPTIONS: Record<ProjectGroup, string> = {
  active: "Work commitments currently moving through production or review.",
  planned: "Upcoming commitments that have not entered production yet.",
  completed: "Delivered work and projects intentionally removed from the active operation.",
};

function ProjectCard({
  project,
  today,
}: {
  project: ProjectOverviewItem;
  today: string;
}) {
  const progress = getProjectProgress(project);
  const overdue = isProjectOverdue(project, today);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm">
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              Project #{project.id}
            </p>
            <h3 className="mt-1 truncate text-lg font-black text-white">
              {project.name}
            </h3>
            <Link
              href={`/crm/${project.clientId}`}
              className="mt-1 inline-flex min-h-8 items-center text-sm font-bold text-cyan-400 transition hover:text-cyan-300"
            >
              {project.clientName}
            </Link>
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

export default async function ProjectsPage() {
  const projects = await getProjectsOverview();
  const groups = groupProjectsForOverview(projects);
  const today = todayISO();

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
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-300">
            {groups.active.length} active
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-black text-zinc-400">
            {groups.planned.length} planned
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-black text-zinc-600">
            {groups.completed.length} completed
          </span>
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
                  {groups[group].map((project) => (
                    <ProjectCard key={project.id} project={project} today={today} />
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
