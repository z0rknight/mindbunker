"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveCapture, dismissCapture, promoteCapture, setCaptureOutcome } from "@/modules/captures/actions";

const inputClass =
  "min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-white outline-none focus:border-violet-500";
const buttonClass =
  "min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

// Mission §8: exactly PROMOTE/LINK, GHOSTED, REJECTED, DISMISS -- no
// redundant actions. Dismiss and Reject are distinct dispositions (see
// core.ts's isCaptureResolved comment): Reject is a commercial verdict
// ("no"), Dismiss is "not making that call, just clearing the Inbox"
// (duplicate/mistaken entry).
export function CaptureActions({ id, counterpartyLabel }: { id: number; counterpartyLabel: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [clientName, setClientName] = useState(counterpartyLabel ?? "");
  const [projectName, setProjectName] = useState("");
  const [createVideo, setCreateVideo] = useState(false);

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Could not update this Capture.");
        return;
      }
      router.refresh();
    });
  }

  function runPromote() {
    if (!projectName.trim()) {
      setError("Project name is required to promote.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await promoteCapture({
        captureId: id,
        clientName: clientName || undefined,
        projectName,
        createVideo,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPromoting(false);
      router.refresh();
    });
  }

  if (promoting) {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-violet-800/50 bg-violet-950/10 p-3">
        <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" className={inputClass} />
        <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" className={inputClass} />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={createVideo} onChange={(event) => setCreateVideo(event.target.checked)} />
          Also create a video and log the captured time
        </label>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={runPromote} className="min-h-10 rounded-lg bg-violet-600 px-3 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-50">
            {pending ? "Promoting…" : "Confirm promote"}
          </button>
          <button type="button" disabled={pending} onClick={() => setPromoting(false)} className={buttonClass}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => setPromoting(true)} className="min-h-10 rounded-lg bg-emerald-500 px-3 text-xs font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          Promote / Link
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => setCaptureOutcome(id, "GHOSTED"))} className={buttonClass}>
          Ghosted
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => setCaptureOutcome(id, "REJECTED"))} className={buttonClass}>
          Rejected
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => dismissCapture(id))} className="min-h-10 rounded-lg border border-zinc-800 px-3 text-xs font-bold text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          Dismiss
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}

// Resolved-history-only action: hide from the resolved list without
// changing the outcome/promotion facts already recorded. Never deletes.
export function CaptureArchiveButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await archiveCapture(id);
            if (!result.success) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
        className="min-h-9 rounded-lg border border-zinc-800 px-3 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
