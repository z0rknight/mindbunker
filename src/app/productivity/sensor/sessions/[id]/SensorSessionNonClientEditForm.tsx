"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { correctSensorOperationalSession } from "@/modules/sensor/actions";

const NON_CLIENT_CONTEXTS = ["LEAD", "INTERNAL", "ADMIN"] as const;
type NonClientContext = (typeof NON_CLIENT_CONTEXTS)[number];

function toDatetimeLocalValue(seconds: number) {
  const date = new Date(seconds * 1_000);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Sensor Operational Ledger Patch §3 (addendum): the non-CLIENT twin of
// SensorSessionEditForm -- same shape (start/end + one identity field +
// save/cancel), because a completed Internal/Admin/Lead session needs the
// exact same kind of correction a CLIENT one does, just without a video
// to pick. No approval step: correctSensorOperationalSession saves
// straight onto the already-finalized (ARCHIVED) row.
export function SensorSessionNonClientEditForm({
  sessionId,
  contextType,
  contextLabel,
  startedAt,
  endedAt,
  onCancel,
}: {
  sessionId: number;
  contextType: NonClientContext;
  contextLabel: string | null;
  startedAt: number;
  endedAt: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formContextType, setFormContextType] = useState<NonClientContext>(contextType);
  const [formContextLabel, setFormContextLabel] = useState(contextLabel ?? "");
  const [formStartedAt, setFormStartedAt] = useState(toDatetimeLocalValue(startedAt));
  const [formEndedAt, setFormEndedAt] = useState(toDatetimeLocalValue(endedAt));
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const result = await correctSensorOperationalSession(sessionId, {
        contextType: formContextType,
        contextLabel: formContextLabel.trim().length > 0 ? formContextLabel.trim() : null,
        startedAt: new Date(formStartedAt).toISOString(),
        endedAt: new Date(formEndedAt).toISOString(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCancel();
    });
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-700/60 bg-zinc-900/40 p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-zinc-400">
        Correcting recorded session #{sessionId}
      </p>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Start</span>
          <input
            type="datetime-local"
            value={formStartedAt}
            onChange={(event) => setFormStartedAt(event.target.value)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">End</span>
          <input
            type="datetime-local"
            value={formEndedAt}
            onChange={(event) => setFormEndedAt(event.target.value)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Context</span>
          <select
            value={formContextType}
            onChange={(event) => setFormContextType(event.target.value as NonClientContext)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          >
            {NON_CLIENT_CONTEXTS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
            Label{formContextType === "LEAD" ? " (required)" : " (optional)"}
          </span>
          <input
            type="text"
            value={formContextLabel}
            onChange={(event) => setFormContextLabel(event.target.value)}
            placeholder={formContextType === "LEAD" ? "Counterparty / lead" : "Initiative / domain"}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-9 rounded bg-zinc-200 px-3 text-xs font-black text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="min-h-9 rounded border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
