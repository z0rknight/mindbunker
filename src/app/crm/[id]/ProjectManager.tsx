"use client";

import {
  ProjectForm,
  type ProjectFormValues,
} from "@/components/projects/ProjectForm";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import type { VideoStatus } from "@/modules/productivity/config";
import { resolveCoverUrl } from "@/modules/media/core";
import { createProject } from "@/modules/projects/actions";
import type { ProjectStatus } from "@/modules/projects/config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ClientProjectView = {
  id: number;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  notes: string | null;
  coverUrl: string | null;
  videos: Array<{
    id: number;
    title: string | null;
    date: string;
    status: VideoStatus;
    revisionsCount: number;
    delivered: boolean;
    coverUrl: string | null;
    // Lunch Reality Patch P1 §7: client-settable "priority now" video --
    // read-only here, the client sets this from their own dashboard.
    isPriority: boolean;
  }>;
};

function ProjectCard({
  project,
  clientId,
  clientAvatarUrl,
}: {
  project: ClientProjectView;
  clientId: number;
  clientAvatarUrl: string | null;
}) {
  return (
    <article
      id={`project-${project.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/35 transition hover:border-cyan-500/35 hover:bg-zinc-950/65"
    >
      <Link href={`/projects/${project.id}`} className="group block p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-black text-white group-hover:text-cyan-200">
              {project.name}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">
              {project.deadline ? `Due ${project.deadline}` : "No deadline"} · {project.videos.length} video{project.videos.length === 1 ? "" : "s"}
            </p>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
        {project.notes && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500">
            {project.notes}
          </p>
        )}
        <p className="mt-3 text-xs font-black text-cyan-400">Open project workspace →</p>
      </Link>

      {project.videos.length > 0 && (
        <div className="border-t border-zinc-800 p-3 sm:p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
            Video pieces
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {project.videos.slice(0, 6).map((video) => {
              const coverUrl = resolveCoverUrl(
                video.coverUrl,
                project.coverUrl,
                clientAvatarUrl,
              );
              return (
                <Link
                  key={video.id}
                  href={`/productivity?video=${video.id}&returnTo=${encodeURIComponent(`/crm/${clientId}?tab=projects`)}`}
                  className="group/video overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-violet-500/40"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="" className="h-full w-full object-cover transition group-hover/video:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-700">🎬</div>
                    )}
                    {video.isPriority && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200 backdrop-blur">
                        ⭐ Priority
                      </span>
                    )}
                  </div>
                  <p className="truncate px-2.5 py-2 text-xs font-bold text-zinc-300 group-hover/video:text-violet-200">
                    {video.title ?? "Untitled video"}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export function ProjectManager({
  clientId,
  clientAvatarUrl,
  projects,
  initiallyCreating = false,
  returnTo,
}: {
  clientId: number;
  clientAvatarUrl: string | null;
  projects: ClientProjectView[];
  initiallyCreating?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(initiallyCreating);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function create(values: ProjectFormValues) {
    setFeedback("");
    startTransition(async () => {
      const result = await createProject(clientId, values);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setCreating(false);
      if (returnTo && result.projectId) {
        const separator = returnTo.includes("?") ? "&" : "?";
        router.push(`${returnTo}${separator}projectId=${result.projectId}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-white">Client projects</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Create the commitment here; operate it from its Project workspace.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="min-h-11 shrink-0 rounded-xl bg-cyan-700 px-4 text-sm font-black text-white">
            + Project
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <ProjectForm submitLabel="Create project" onSubmit={create} onCancel={() => setCreating(false)} isPending={isPending} />
          {feedback && <p className="mt-3 text-sm text-red-300">{feedback}</p>}
        </div>
      )}

      {projects.length === 0 && !creating ? (
        <button type="button" onClick={() => setCreating(true)} className="min-h-32 w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/30 p-6 text-center">
          <span className="block text-sm font-bold text-zinc-300">Create the first project</span>
          <span className="mt-1 block text-xs text-zinc-600">Then plan videos inside that project.</span>
        </button>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              clientId={clientId}
              clientAvatarUrl={clientAvatarUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
