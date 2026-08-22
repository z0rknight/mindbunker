import { PlanVideoButton } from "@/components/ui/QuickActions";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import { getProjectWorkspace } from "@/modules/projects/actions";
import { formatDate } from "@/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectWorkspaceControls } from "./ProjectWorkspaceControls";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();

  const project = await getProjectWorkspace(Number(id));
  if (!project) notFound();

  const doneVideos = project.videos.filter((video) => video.status === "DONE").length;
  const inFlightVideos = project.videos.filter((video) =>
    ["IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED"].includes(video.status),
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-7">
        <Link href="/projects" className="inline-flex min-h-10 items-center text-sm font-bold text-zinc-500 transition hover:text-zinc-300">
          ← All projects
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Project workspace
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-white sm:text-3xl">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <nav aria-label="Project relationship" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/crm/${project.clientId}`} className="font-black text-cyan-400 hover:text-cyan-300">
                {project.clientName}
              </Link>
              <span className="text-zinc-700">→</span>
              <span className="font-bold text-zinc-300">{project.name}</span>
            </nav>
          </div>
          <ProjectWorkspaceControls project={project} />
        </div>
      </header>

      <section className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Deadline</p>
          <p className="mt-2 text-lg font-black text-white">{project.deadline ? formatDate(project.deadline) : "Not set"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">In flight</p>
          <p className="mt-2 text-lg font-black text-cyan-300">{inFlightVideos}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Completed</p>
          <p className="mt-2 text-lg font-black text-emerald-300">{doneVideos} / {project.videos.length}</p>
        </div>
      </section>

      {project.notes && (
        <section className="mb-7 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Project notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{project.notes}</p>
        </section>
      )}

      <section aria-labelledby="project-videos">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Production units</p>
            <h2 id="project-videos" className="mt-1 text-xl font-black text-white">
              Videos <span className="font-mono text-sm text-zinc-600">{project.videos.length}</span>
            </h2>
          </div>
          <div className="w-full pr-36 sm:w-[180px] sm:pr-0">
            <PlanVideoButton initialProjectId={project.id} />
          </div>
        </div>

        {project.videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <p className="font-black text-white">No videos planned yet</p>
            <p className="mt-1 text-sm text-zinc-500">Plan the first production unit inside this Project.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {project.videos.map((video) => (
              <Link
                key={video.id}
                href={`/productivity?video=${video.id}`}
                className="flex min-h-20 flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-violet-500/35 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-white">{video.title ?? `Video ${formatDate(video.date)}`}</p>
                  <p className="mt-1 text-xs text-zinc-600">{formatDate(video.date)} · {video.revisionsCount} revision{video.revisionsCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <VideoStatusBadge status={video.status} />
                  <span className="text-sm font-black text-violet-300">Open video →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
