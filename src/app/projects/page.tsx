import { EntityInspectionTrigger } from "@/components/entity-inspection/EntityDrawerProvider";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { PixelEmptyState, PixelIcon } from "@/components/ui/PixelVisuals";
import { displayClientName } from "@/lib/client-identity";
import { getRelationshipIntegrity } from "@/modules/crm/integrity-data";
import { resolveCoverUrl } from "@/modules/media/core";
import { getProductivityQuickOptions } from "@/modules/productivity/actions";
import { getProjectsOverview, getUnassignedClientVideos } from "@/modules/projects/actions";
import { PROJECT_GROUPS, PROJECT_STATUS_LABELS } from "@/modules/projects/config";
import {
  filterProjectsBySearch,
  filterProjectsByView,
  getProjectException,
  getProjectNextAction,
  getProjectProgress,
  groupProjectsByClient,
  groupProjectsForOverview,
  isProjectCurrent,
  isProjectOverdue,
  isProjectViewPreset,
  type ProjectExceptionKind,
  type ProjectLayout,
  type ProjectOverviewItem,
  type ProjectSortMode,
  type ProjectViewPreset,
} from "@/modules/projects/core";
import { formatLastActive } from "@/modules/work-sessions/core";
import { formatDate, todayISO } from "@/utils/date";
import Link from "next/link";
import { ClientFilter } from "./ClientFilter";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectCover } from "./ProjectCover";
import { ProjectSearch } from "./ProjectSearch";
import { SortToggle } from "./SortToggle";
import { StatusFilter } from "./StatusFilter";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Array<{ value: ProjectViewPreset; label: string }> = [
  { value: "current", label: "Current" },
  { value: "client", label: "By Client" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "internal", label: "Internal" },
  { value: "all", label: "All" },
];

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

function projectsHref(
  current: Record<string, string | string[] | undefined>,
  changes: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return `/projects${query ? `?${query}` : ""}`;
}

function ProjectFacts({ project }: { project: ProjectOverviewItem }) {
  const progress = getProjectProgress(project);
  return (
    <>
      <div className="pixel-progress h-1.5 overflow-hidden bg-zinc-800">
        <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-zinc-300">
          {project.totalVideos > 0 ? `${project.doneVideos}/${project.totalVideos} deliverables` : "No deliverables"}
        </span>
        <span className="text-zinc-600">{progress}% production complete</span>
      </div>
    </>
  );
}

function ProjectCard({ project, today, nowIso }: { project: ProjectOverviewItem; today: string; nowIso: string }) {
  const exception = getProjectException(project, today);
  const nextAction = getProjectNextAction(project);
  const overdueDays = isProjectOverdue(project, today) && project.deadline
    ? Math.max(1, Math.round((Date.parse(today) - Date.parse(project.deadline)) / 86_400_000))
    : null;
  const coverUrl = resolveCoverUrl(project.coverUrl, project.clientDefaultCoverUrl, project.clientAvatarUrl);

  return (
    <EntityInspectionTrigger
      entity={{ type: "project", id: project.id }}
      ariaLabel={`Inspect project ${project.name}`}
      className={`pixel-frame group overflow-hidden rounded-2xl border text-left transition ${
        exception === "OVERDUE"
          ? "border-red-900/50 bg-red-950/10 hover:border-red-700/60"
          : exception === "BLOCKED"
            ? "border-amber-900/50 bg-amber-950/10 hover:border-amber-700/60"
            : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <ProjectCover compact url={coverUrl} projectName={project.name} clientName={project.canonicalClientName} />
      <div className="p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`truncate text-[10px] font-black uppercase tracking-[0.18em] ${project.workClass === "INTERNAL" ? "text-zinc-500" : "text-cyan-400/80"}`}>
              {displayClientName(project.canonicalClientName)}{project.workMode === "DFY" ? " · DFY" : ""}
            </p>
            <h3 className="mt-1 truncate text-base font-black text-white">{project.name}</h3>
          </div>
          {exception && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${EXCEPTION_CLASS[exception]}`}>
              {exception === "OVERDUE" && overdueDays ? `${overdueDays}d overdue` : EXCEPTION_LABEL[exception]}
            </span>
          )}
        </div>
        <div className="mt-3"><ProjectFacts project={project} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800/80 pt-3 text-[11px]">
          <div><p className="uppercase tracking-wide text-zinc-700">Lifecycle</p><p className="mt-0.5 font-bold text-zinc-300">{PROJECT_STATUS_LABELS[project.status]}</p></div>
          <div><p className="uppercase tracking-wide text-zinc-700">Next structure</p><p className="mt-0.5 line-clamp-2 font-bold text-zinc-300">{nextAction ?? "No open milestone"}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-600">
          {project.deadline && <span>Due {formatDate(project.deadline)}</span>}
          {project.explicitBatchCount > 0 && <span>{project.explicitBatchCount} explicit batch{project.explicitBatchCount === 1 ? "" : "es"}</span>}
          {project.lastActiveAt && <span>Active {formatLastActive(project.lastActiveAt, nowIso)}</span>}
        </div>
      </div>
    </EntityInspectionTrigger>
  );
}

function ProjectRow({ project, today, nowIso }: { project: ProjectOverviewItem; today: string; nowIso: string }) {
  const exception = getProjectException(project, today);
  const progress = getProjectProgress(project);
  return (
    <EntityInspectionTrigger
      entity={{ type: "project", id: project.id }}
      ariaLabel={`Inspect project ${project.name}`}
      className="grid w-full gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left transition hover:border-zinc-600 md:grid-cols-[minmax(0,1.5fr)_120px_140px_140px] md:items-center"
    >
      <span className="min-w-0"><span className="block truncate font-black text-white">{project.name}</span><span className="mt-0.5 block truncate text-[11px] text-zinc-500">{displayClientName(project.canonicalClientName)}{project.workMode === "DFY" ? " · DFY" : ""}{project.lastActiveAt ? ` · active ${formatLastActive(project.lastActiveAt, nowIso)}` : ""}</span></span>
      <span className="text-xs font-bold text-zinc-400">{PROJECT_STATUS_LABELS[project.status]}</span>
      <span className="text-xs text-zinc-400">{project.doneVideos}/{project.totalVideos} · {progress}%</span>
      <span className="flex items-center justify-between gap-2 text-xs text-zinc-500"><span>{project.deadline ? formatDate(project.deadline) : "No deadline"}</span>{exception && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${EXCEPTION_CLASS[exception]}`}>{EXCEPTION_LABEL[exception]}</span>}</span>
    </EntityInspectionTrigger>
  );
}

function ProjectCollection({ projects, layout, today, nowIso }: { projects: ProjectOverviewItem[]; layout: ProjectLayout; today: string; nowIso: string }) {
  if (layout === "rows") return <div className="space-y-2">{projects.map((project) => <ProjectRow key={project.id} project={project} today={today} nowIso={nowIso} />)}</div>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} today={today} nowIso={nowIso} />)}</div>;
}

function IntegritySection({ issues, videos }: {
  issues: Array<{ code: string; severity: "ERROR" | "WARNING"; entityType: string; entityId: number; message: string }>;
  videos: Array<{ id: number; title: string | null; date: string; canonicalClientName: string; classification: "UNASSIGNED_WITH_EVIDENCE" | "UNASSIGNED_NO_EXECUTION_EVIDENCE" }>;
}) {
  if (issues.length === 0 && videos.length === 0) return null;
  const evidenceCount = videos.filter((video) => video.classification === "UNASSIGNED_WITH_EVIDENCE").length;
  return (
    <details open={issues.some((issue) => issue.severity === "ERROR") || evidenceCount > 0} className="group mb-7 rounded-2xl border border-amber-800/40 bg-amber-950/10 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2"><span className="transition group-open:rotate-90">▸</span><PixelIcon name="flag" className="h-3.5 w-3.5 text-amber-400" /><span className="text-sm font-black uppercase tracking-wide text-amber-300">Data integrity</span></span>
        <span className="text-xs font-bold text-amber-600">{issues.length + videos.length}</span>
      </summary>
      <p className="mt-3 text-xs leading-5 text-zinc-500">Structural debt only. This inbox does not redefine War Room execution signals.</p>
      <div className="mt-3 space-y-2">
        {issues.map((issue) => <div key={`${issue.code}-${issue.entityType}-${issue.entityId}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-xs"><p className="font-bold text-zinc-200">{issue.message}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">{issue.severity} · {issue.code}</p></div>)}
        {videos.map((video) => (
          <EntityInspectionTrigger key={video.id} entity={{ type: "video", id: video.id }} className="block w-full rounded-xl border border-amber-900/40 bg-zinc-950/60 px-3 py-2.5 text-left text-xs hover:border-amber-600/60">
            <span className="block truncate font-bold text-zinc-200">{video.title ?? `Video ${formatDate(video.date)}`}</span>
            <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{displayClientName(video.canonicalClientName)} · {video.classification === "UNASSIGNED_WITH_EVIDENCE" ? "Needs Project association" : "No execution evidence"}</span>
          </EntityInspectionTrigger>
        ))}
      </div>
    </details>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const view: ProjectViewPreset = typeof query.view === "string" && isProjectViewPreset(query.view) ? query.view : "current";
  const layout: ProjectLayout = query.layout === "rows" ? "rows" : "cards";
  const clientFilterId = typeof query.client === "string" && query.client ? Number.parseInt(query.client, 10) : null;
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const searchQuery = typeof query.q === "string" ? query.q : "";
  const sortMode: ProjectSortMode = query.sort === "recent" ? "recent" : "attention";

  const [allProjects, quickOptions, unassignedVideos, integrity] = await Promise.all([getProjectsOverview(), getProductivityQuickOptions(), getUnassignedClientVideos(), getRelationshipIntegrity()]);
  const today = todayISO();
  const nowIso = new Date().toISOString();
  const lifecycleGroups = groupProjectsForOverview(allProjects);
  const currentProjects = PROJECT_GROUPS.flatMap((group) => lifecycleGroups[group]).filter(isProjectCurrent);
  const openDeliverables = currentProjects.reduce((sum, project) => sum + Math.max(0, project.totalVideos - project.doneVideos), 0);
  const waitingCount = allProjects.filter((project) => project.status === "review").length;
  const structuralIssues = integrity.issues.filter((issue) => ["client", "project", "video"].includes(issue.entityType));

  let visibleProjects = filterProjectsByView(allProjects, view);
  if (clientFilterId !== null) visibleProjects = visibleProjects.filter((project) => project.canonicalClientId === clientFilterId);
  if (statusFilter) visibleProjects = visibleProjects.filter((project) => project.status === statusFilter);
  visibleProjects = filterProjectsBySearch(visibleProjects, searchQuery);
  const rank = (project: ProjectOverviewItem) => { const exception = getProjectException(project, today); return exception === "OVERDUE" ? 0 : exception === "BLOCKED" ? 1 : exception === "PLANNED" ? 2 : 3; };
  visibleProjects.sort((a, b) => sortMode === "attention" ? rank(a) - rank(b) || (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) : (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));

  const visibleUnassignedVideos = clientFilterId === null ? unassignedVideos : unassignedVideos.filter((video) => video.canonicalClientId === clientFilterId);
  const clientOptions = Array.from(new Map([...allProjects.map((project): [number, string] => [project.canonicalClientId, project.canonicalClientName]), ...unassignedVideos.map((video): [number, string] => [video.canonicalClientId, video.canonicalClientName])]).entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const clientGroups = groupProjectsByClient(visibleProjects, today, sortMode);

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Structure · not execution</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><PixelIcon name="project" className="h-5 w-5 text-cyan-300" /> Projects</h1><p className="mt-1 text-xs text-zinc-600">Client → Project → explicit Batch when present → Deliverable</p></div><NewProjectButton clients={quickOptions.clients} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/10 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-cyan-600">Current</p><p className="mt-0.5 text-lg font-black text-cyan-200">{currentProjects.length}</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-zinc-600">Open deliverables</p><p className="mt-0.5 text-lg font-black text-white">{openDeliverables}</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-zinc-600">Waiting</p><p className="mt-0.5 text-lg font-black text-white">{waitingCount}</p></div>
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-amber-700">Structural issues</p><p className="mt-0.5 text-lg font-black text-amber-300">{structuralIssues.length + unassignedVideos.length}</p></div>
        </div>
        <nav aria-label="Project views" className="mt-4 flex flex-wrap gap-1.5">{VIEW_LABELS.map((option) => <Link key={option.value} href={projectsHref(query, { view: option.value === "current" ? null : option.value })} className={`rounded-full border px-3 py-1.5 text-xs font-black ${view === option.value ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200" : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"}`}>{option.label}</Link>)}</nav>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {clientOptions.length > 1 && <ClientFilter clients={clientOptions} />}<StatusFilter /><SortToggle />
          <div className="flex rounded-full border border-zinc-800 bg-zinc-950 p-0.5">{(["cards", "rows"] as const).map((option) => <Link key={option} href={projectsHref(query, { layout: option === "cards" ? null : option })} className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${layout === option ? "bg-zinc-700 text-white" : "text-zinc-600"}`}>{option}</Link>)}</div>
          <div className="ml-auto"><ProjectSearch /></div>
        </div>
      </header>

      <IntegritySection issues={structuralIssues} videos={visibleUnassignedVideos} />

      {allProjects.length === 0 && visibleUnassignedVideos.length === 0 ? (
        <PixelEmptyState icon="project" title="No projects yet" className="rounded-2xl"><p>Choose a client in CRM to create the first structural commitment.</p><Link href="/crm" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-cyan-700 px-5 text-sm font-black text-white">Open CRM</Link></PixelEmptyState>
      ) : visibleProjects.length === 0 ? (
        <PixelEmptyState icon="archive" title="No matching projects" className="rounded-2xl">This view is intentionally empty. Adjust its filters or open All.</PixelEmptyState>
      ) : view === "client" ? (
        <div className="space-y-3">{clientGroups.map((group) => { const groupOpen = group.projects.reduce((sum, project) => sum + Math.max(0, project.totalVideos - project.doneVideos), 0); return <details key={group.clientId} open className="group rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="transition group-open:rotate-90">▸</span><span className="truncate text-sm font-black uppercase tracking-wide text-zinc-200">{displayClientName(group.clientName)}</span></span><span className="shrink-0 text-xs text-zinc-600">{group.projects.length} project{group.projects.length === 1 ? "" : "s"} · {groupOpen} open</span></summary><div className="mt-4"><ProjectCollection projects={group.projects} layout={layout} today={today} nowIso={nowIso} /></div></details>; })}</div>
      ) : (
        <ProjectCollection projects={visibleProjects} layout={layout} today={today} nowIso={nowIso} />
      )}
    </div>
  );
}
