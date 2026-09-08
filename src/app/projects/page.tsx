import { displayClientName, getClientAccent } from "@/lib/client-identity";
import { getProjectsOverview } from "@/modules/projects/actions";
import { getProductivityQuickOptions } from "@/modules/productivity/actions";
import {
  filterProjectsBySearch,
  getProjectException,
  getProjectNextAction,
  groupProjectsByClient,
  groupProjectsForOverview,
  isProjectOverdue,
  type ClientProjectGroup,
  type ProjectExceptionKind,
  type ProjectOverviewItem,
  type ProjectSortMode,
} from "@/modules/projects/core";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/config";
import { formatDate, todayISO } from "@/utils/date";
import { formatLastActive } from "@/modules/work-sessions/core";
import Link from "next/link";
import { ClientFilter } from "./ClientFilter";
import { StatusFilter } from "./StatusFilter";
import { ProjectSearch } from "./ProjectSearch";
import { SortToggle } from "./SortToggle";
import { NewProjectButton } from "./NewProjectButton";

export const dynamic = "force-dynamic";

// Tuesday Patch Priority 2: the 4-column homogeneous card grid was
// explicitly rejected in the original QA ("parece um pouco poluído e sem
// hierarquia"). This replaces it with the brief's own target architecture:
// exception -> client -> project -> metadata, compact rows grouped by
// client, vertical scanning instead of zigzag. See
// modules/projects/core.ts for groupProjectsByClient/getProjectException/
// getProjectNextAction -- this file only renders what those already
// decided.

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

function ProjectRow({
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

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
        exception === "OVERDUE"
          ? "border-red-900/50 bg-red-950/10 hover:border-red-700/60"
          : exception === "BLOCKED"
            ? "border-amber-900/50 bg-amber-950/10 hover:border-amber-700/60"
            : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {exception && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${EXCEPTION_CLASS[exception]}`}>
              {exception === "OVERDUE" && overdueDays ? `${overdueDays}d overdue` : EXCEPTION_LABEL[exception]}
            </span>
          )}
          <p className="truncate font-black text-white">{project.name}</p>
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {project.totalVideos > 0
            ? `Videos ${project.doneVideos}/${project.totalVideos} complete`
            : "No videos yet"}
          {nextAction && <> · Next: {nextAction}</>}
          {!nextAction && <> · Stage: {PROJECT_STATUS_LABELS[project.status]}</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right sm:block">
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
        </div>
        <span className="text-xs font-black text-cyan-300 opacity-0 transition group-hover:opacity-100">
          Open →
        </span>
      </div>
    </Link>
  );
}

function ClientGroupSection({
  group,
  today,
  nowIso,
}: {
  group: ClientProjectGroup;
  today: string;
  nowIso: string;
}) {
  const accent = getClientAccent(group.clientId, group.clientName);
  return (
    <section aria-labelledby={`client-${group.clientId}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} aria-hidden="true" />
        <Link
          href={`/crm/${group.clientId}`}
          id={`client-${group.clientId}`}
          className={`text-sm font-black uppercase tracking-wide hover:opacity-80 ${accent.text}`}
        >
          {displayClientName(group.clientName)}
        </Link>
        <span className="text-xs font-bold text-zinc-600">
          {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-1.5">
        {group.projects.map((project) => (
          <ProjectRow key={project.id} project={project} today={today} nowIso={nowIso} />
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

  const [allProjects, quickOptions] = await Promise.all([
    getProjectsOverview(),
    getProductivityQuickOptions(),
  ]);
  const clientOptions = Array.from(
    new Map(allProjects.map((p) => [p.clientId, p.clientName])).entries(),
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

  const clientGroups = groupProjectsByClient(visibleProjects, today, sortMode);
  const needsAttention = visibleProjects.filter((p) => getProjectException(p, today) === "OVERDUE" || p.openBlockerCount > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Clients → projects → videos
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">📁 Projects</h1>
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

      {allProjects.length === 0 ? (
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
      ) : visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-sm text-zinc-600">
          No projects match this filter.
        </div>
      ) : (
        <div className="space-y-8">
          {needsAttention.length > 0 && (
            <section aria-labelledby="needs-attention">
              <h2 id="needs-attention" className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-red-300">
                Needs attention
              </h2>
              <div className="space-y-1.5">
                {needsAttention.map((project) => {
                  const exception = getProjectException(project, today)!;
                  const overdueDays = project.deadline
                    ? Math.max(1, Math.round((Date.parse(today) - Date.parse(project.deadline)) / (24 * 60 * 60 * 1000)))
                    : null;
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/10 px-4 py-2.5 text-sm hover:border-red-700/60"
                    >
                      <span className="text-red-300">⚠</span>
                      <span className="font-black text-white">{project.name}</span>
                      <span className="text-zinc-500">· {displayClientName(project.clientName)} ·</span>
                      <span className="font-bold text-red-300">
                        {exception === "OVERDUE" && overdueDays ? `${overdueDays} days overdue` : "blocked"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {clientGroups.map((group) => (
            <ClientGroupSection key={group.clientId} group={group} today={today} nowIso={nowIso} />
          ))}
        </div>
      )}
    </div>
  );
}
