"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductionMemory,
  deleteProductionMemory,
  updateProductionMemory,
} from "@/modules/production-memory/actions";
import {
  PRODUCTION_MEMORY_STATUSES,
  PRODUCTION_MEMORY_STATUS_LABELS,
} from "@/modules/production-memory/config";

// Smallest useful operator CRUD for one client's production memory: one
// compact form, in place, no modal, no version history, no approval workflow.

export type EditorMemory = {
  id: number;
  name: string;
  useCase: string | null;
  status: string | null;
  approvalEvidence: string | null;
  preferenceNotes: string | null;
  recipeNotes: string | null;
  templateLocation: string | null;
  referenceVideoId: number | null;
  referenceUrl: string | null;
};

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500";
const labelClass = "mb-1 block text-[10px] font-black uppercase tracking-wide text-zinc-500";

function Err({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-[11px] text-red-300">{message}</p> : null;
}

export function ProductionMemoryEditor({
  clientId,
  memory,
  videoOptions,
  onDone,
}: {
  clientId: number;
  memory: EditorMemory | null;
  videoOptions: Array<{ id: number; title: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  function submit(formData: FormData) {
    const values = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const result = memory
        ? await updateProductionMemory(clientId, memory.id, values)
        : await createProductionMemory(clientId, values);
      if (!result.success) {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? "");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form action={submit} className="space-y-3 rounded-xl border border-cyan-900/40 bg-zinc-950 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="pm-name">Name *</label>
          <input id="pm-name" name="name" defaultValue={memory?.name ?? ""} maxLength={120} className={inputClass} />
          <Err message={errors.name} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-status">Status</label>
          <select id="pm-status" name="status" defaultValue={memory?.status ?? ""} className={inputClass}>
            <option value="">Not recorded</option>
            {PRODUCTION_MEMORY_STATUSES.map((status) => (
              <option key={status} value={status}>{PRODUCTION_MEMORY_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <Err message={errors.status} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="pm-use">Use it for</label>
        <input id="pm-use" name="useCase" defaultValue={memory?.useCase ?? ""} maxLength={400} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pm-approval">Approval evidence (required if Client approved)</label>
        <input id="pm-approval" name="approvalEvidence" defaultValue={memory?.approvalEvidence ?? ""} maxLength={400} className={inputClass} />
        <Err message={errors.approvalEvidence} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="pm-pref">Client preference</label>
          <textarea id="pm-pref" name="preferenceNotes" defaultValue={memory?.preferenceNotes ?? ""} rows={3} maxLength={1500} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-recipe">How it&apos;s produced</label>
          <textarea id="pm-recipe" name="recipeNotes" defaultValue={memory?.recipeNotes ?? ""} rows={3} maxLength={1500} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="pm-template">Template / project location (pointer only)</label>
        <input id="pm-template" name="templateLocation" defaultValue={memory?.templateLocation ?? ""} maxLength={500} className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="pm-video">Approved example (one of this client&apos;s videos)</label>
          <select id="pm-video" name="referenceVideoId" defaultValue={memory?.referenceVideoId ?? ""} className={inputClass}>
            <option value="">Not recorded</option>
            {videoOptions.map((video) => (
              <option key={video.id} value={video.id}>{video.title}</option>
            ))}
          </select>
          <Err message={errors.referenceVideoId} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-url">…or an example link (HTTPS)</label>
          <input id="pm-url" name="referenceUrl" defaultValue={memory?.referenceUrl ?? ""} maxLength={2048} className={inputClass} />
          <Err message={errors.referenceUrl} />
        </div>
      </div>
      {message && <p role="alert" className="text-xs text-red-300">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-black text-black hover:bg-cyan-500 disabled:opacity-60">
          {pending ? "Saving…" : memory ? "Save changes" : "Add format"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-200">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function DeleteMemoryButton({ clientId, id, name }: { clientId: number; id: number; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete the format "${name}"? This can't be undone.`)) return;
        startTransition(async () => {
          await deleteProductionMemory(clientId, id);
          router.refresh();
        });
      }}
      className="rounded border border-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:border-red-900 hover:text-red-300 disabled:opacity-60"
    >
      Delete
    </button>
  );
}
