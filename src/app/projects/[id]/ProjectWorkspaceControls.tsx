"use client";

import {
  ProjectForm,
  type ProjectFormValues,
} from "@/components/projects/ProjectForm";
import { deleteProject, updateProject } from "@/modules/projects/actions";
import type { ProjectStatus } from "@/modules/projects/config";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ProjectWorkspaceControls({
  project,
}: {
  project: {
    id: number;
    clientId: number;
    name: string;
    status: ProjectStatus;
    deadline: string | null;
    notes: string | null;
    coverUrl: string | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function save(values: ProjectFormValues) {
    setFeedback("");
    startTransition(async () => {
      const result = await updateProject(project.id, values);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Delete “${project.name}”? Its videos will remain in Productivity without a project.`)) return;
    setFeedback("");
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      router.push(`/crm/${project.clientId}?tab=projects`);
    });
  }

  if (editing) {
    return (
      <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 sm:p-5">
        <ProjectForm
          initial={{
            name: project.name,
            status: project.status,
            deadline: project.deadline ?? "",
            notes: project.notes ?? "",
            coverUrl: project.coverUrl ?? "",
          }}
          submitLabel="Save project"
          onSubmit={save}
          onCancel={() => setEditing(false)}
          isPending={isPending}
          coverUploadTarget={{ type: "project", id: project.id }}
        />
        {feedback && <p className="mt-3 text-sm text-red-300">{feedback}</p>}
      </section>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-black text-zinc-200 transition hover:border-cyan-500/40"
      >
        Edit project
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="min-h-11 rounded-xl px-3 text-sm font-bold text-red-400 disabled:opacity-40"
      >
        Delete project
      </button>
      {feedback && <p className="w-full text-sm text-red-300">{feedback}</p>}
    </div>
  );
}
