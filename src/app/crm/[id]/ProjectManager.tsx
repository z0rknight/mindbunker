"use client";

import {
  ProjectForm,
  type ProjectFormValues,
} from "@/components/projects/ProjectForm";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import type { VideoStatus } from "@/modules/productivity/config";
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
  videos: Array<{
    id: number;
    title: string | null;
    date: string;
    status: VideoStatus;
    revisionsCount: number;
    delivered: boolean;
  }>;
};

function ProjectCard({ project }: { project: ClientProjectView }) {
  return (
    <Link
      id={`project-${project.id}`}
      href={`/projects/${project.id}`}
      className="group block min-h-24 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4 transition hover:border-cyan-500/35 hover:bg-zinc-950/65 sm:p-5"
    >
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
  );
}

export function ProjectManager({
  clientId,
  projects,
  initiallyCreating = false,
  returnTo,
}: {
  clientId: number;
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
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}
