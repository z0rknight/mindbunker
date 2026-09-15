"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSensorSession } from "@/modules/sensor/actions";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";

function toDatetimeLocalValue(seconds: number) {
  const date = new Date(seconds * 1_000);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Sensor Reality Sync §8: the forgotten/10h staged session fix -- edit
// start/end/target/activity on a PENDING, already-stopped Sensor
// session BEFORE approving it into canonical history. Same shape as
// Sessions' own CorrectionForm (start/end/activity/video), on purpose:
// one mental model for "fixing a session's facts," staging or canonical.
export function SensorSessionEditForm({
  sessionId,
  videoId,
  startedAt,
  endedAt,
  activityType,
  note,
  videoOptions,
  onCancel,
}: {
  sessionId: number;
  videoId: number;
  startedAt: number;
  endedAt: number;
  activityType: WorkSessionActivityType;
  note: string | null;
  videoOptions: WorkSessionVideoOption[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formVideoId, setFormVideoId] = useState(videoId);
  const [formStartedAt, setFormStartedAt] = useState(toDatetimeLocalValue(startedAt));
  const [formEndedAt, setFormEndedAt] = useState(toDatetimeLocalValue(endedAt));
  const [formActivityType, setFormActivityType] = useState<WorkSessionActivityType>(activityType);
  const [formNote, setFormNote] = useState(note ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const result = await updateSensorSession(sessionId, {
        videoId: formVideoId,
        startedAt: new Date(formStartedAt).toISOString(),
        endedAt: new Date(formEndedAt).toISOString(),
        activityType: formActivityType,
        note: formNote.trim().length > 0 ? formNote.trim() : null,
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
    <div className="mt-4 rounded-md border border-amber-800/40 bg-amber-950/10 p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-amber-300">
        Editing Sensor session #{sessionId} — before approval
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
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Activity</span>
          <select
            value={formActivityType}
            onChange={(event) => setFormActivityType(event.target.value as WorkSessionActivityType)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          >
            {WORK_SESSION_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {WORK_SESSION_ACTIVITY_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
            Target (client → project → video)
          </span>
          <select
            value={formVideoId}
            onChange={(event) => setFormVideoId(Number(event.target.value))}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-violet-500/60"
          >
            {videoOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {[option.clientName, option.projectName, option.title].filter(Boolean).join(" — ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Note</span>
          <input
            type="text"
            value={formNote}
            onChange={(event) => setFormNote(event.target.value)}
            placeholder="Optional context"
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
          className="min-h-9 rounded bg-amber-500 px-3 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save, then approve when ready"}
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
