"use client";

import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/modules/projects/config";
import { CoverUploadField } from "@/components/media/CoverUploadField";
import { useState } from "react";

export type ProjectFormValues = {
  name: string;
  status: ProjectStatus;
  deadline: string;
  notes: string;
  coverUrl: string;
};

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
  coverUploadTarget,
}: {
  initial?: ProjectFormValues;
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  coverUploadTarget?: { type: "project"; id: number };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planned");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, status, deadline, notes, coverUrl });
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="projectName" className="mb-1 block text-xs font-bold text-zinc-500">Project name</label>
        <input id="projectName" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required autoFocus className={fieldClassName} placeholder="Monthly shorts, launch film…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="projectStatus" className="mb-1 block text-xs font-bold text-zinc-500">Status</label>
          <select id="projectStatus" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className={fieldClassName}>
            {PROJECT_STATUSES.map((value) => <option key={value} value={value}>{PROJECT_STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="projectDeadline" className="mb-1 block text-xs font-bold text-zinc-500">Deadline</label>
          <input id="projectDeadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClassName} />
        </div>
      </div>
      <div>
        <label htmlFor="projectNotes" className="mb-1 block text-xs font-bold text-zinc-500">Notes</label>
        <textarea id="projectNotes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5_000} rows={3} className={`${fieldClassName} py-3`} placeholder="Scope, deliverables, context…" />
      </div>
      <div>
        <label htmlFor="projectCoverUrl" className="mb-1 block text-xs font-bold text-zinc-500">Cover (optional)</label>
        <input id="projectCoverUrl" type="text" inputMode="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} maxLength={2_048} className={fieldClassName} placeholder="Use an HTTPS image URL…" />
        {coverUploadTarget && (
          <CoverUploadField
            targetType={coverUploadTarget.type}
            targetId={coverUploadTarget.id}
            coverUrl={coverUrl}
            onCoverUrlChange={setCoverUrl}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-zinc-700 text-sm font-bold text-zinc-300">Cancel</button>
        <button type="submit" disabled={isPending || !name.trim()} className="min-h-12 rounded-xl bg-cyan-700 text-sm font-black text-white disabled:opacity-50">{isPending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
