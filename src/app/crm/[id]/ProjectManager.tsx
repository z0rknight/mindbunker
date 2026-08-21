"use client";

import {
  createProject,
  deleteProject,
  updateProject,
} from "@/modules/projects/actions";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/modules/projects/config";
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
    revisionsCount: number;
    delivered: boolean;
  }>;
};

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";

function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: ClientProjectView;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    status: ProjectStatus;
    deadline: string;
    notes: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planned");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, status, deadline, notes });
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1 block text-xs font-bold text-zinc-500">Project name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required autoFocus className={fieldClassName} placeholder="Monthly shorts, launch film…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-500">Status</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className={fieldClassName}>
            {PROJECT_STATUSES.map((value) => <option key={value} value={value}>{PROJECT_STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-zinc-500">Deadline</label>
          <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClassName} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-zinc-500">Notes</label>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5_000} rows={3} className={`${fieldClassName} py-3`} placeholder="Scope, deliverables, context…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-zinc-700 text-sm font-bold text-zinc-300">Cancel</button>
        <button type="submit" disabled={isPending || !name.trim()} className="min-h-12 rounded-xl bg-cyan-700 text-sm font-black text-white disabled:opacity-50">{isPending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

function ProjectCard({ project }: { project: ClientProjectView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function save(values: {
    name: string;
    status: ProjectStatus;
    deadline: string;
    notes: string;
  }) {
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
    if (!confirm(`Delete “${project.name}”? Its video logs will be kept.`)) return;
    setFeedback("");
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <ProjectForm initial={project} submitLabel="Save project" onSubmit={save} onCancel={() => setEditing(false)} isPending={isPending} />
        {feedback && <p className="mt-3 text-sm text-red-300">{feedback}</p>}
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/35">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-black text-white">{project.name}</h4>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              {project.deadline ? `Due ${project.deadline}` : "No deadline"} · {project.videos.length} video{project.videos.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300">Edit</button>
        </div>
        {project.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{project.notes}</p>}
      </div>

      {project.videos.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Linked videos</p>
          <div className="space-y-2">
            {project.videos.map((video) => (
              <div key={video.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-bold text-zinc-200">{video.title ?? `Video ${video.date}`}</p>
                  <p className="mt-0.5 text-zinc-600">{video.date}</p>
                </div>
                <span className="shrink-0 font-mono font-bold text-amber-300">{video.revisionsCount} rev</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 p-3 text-right">
        <button type="button" onClick={remove} disabled={isPending} className="min-h-11 px-2 text-xs font-bold text-red-400 disabled:opacity-40">Delete project</button>
      </div>
      {feedback && <p className="px-4 pb-3 text-sm text-red-300">{feedback}</p>}
    </article>
  );
}

export function ProjectManager({
  clientId,
  projects,
}: {
  clientId: number;
  projects: ClientProjectView[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function create(values: {
    name: string;
    status: ProjectStatus;
    deadline: string;
    notes: string;
  }) {
    setFeedback("");
    startTransition(async () => {
      const result = await createProject(clientId, values);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setCreating(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-white">Client projects</h3>
          <p className="mt-1 text-xs text-zinc-500">Projects contain the videos; videos contain the revisions.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="min-h-11 shrink-0 rounded-xl bg-cyan-700 px-4 text-sm font-black text-white">+ Project</button>
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
          <span className="mt-1 block text-xs text-zinc-600">Then link every delivered video and revision to it.</span>
        </button>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}
