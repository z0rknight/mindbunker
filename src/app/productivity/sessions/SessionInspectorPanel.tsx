"use client";

import { useCurrentOrigin } from "@/components/navigation/useCurrentOrigin";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { correctWorkSession } from "@/modules/work-sessions/actions";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";
import type { SessionTimelineItem } from "@/modules/work-sessions/timeline";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";
import { pixelFont } from "./fonts";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CorrectionForm({
  session,
  videoOptions,
  onCancel,
  onSaved,
}: {
  session: SessionTimelineItem;
  videoOptions: WorkSessionVideoOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [videoId, setVideoId] = useState(session.videoId);
  const [startedAt, setStartedAt] = useState(toDatetimeLocalValue(session.startedAt));
  const [endedAt, setEndedAt] = useState(session.endedAt ? toDatetimeLocalValue(session.endedAt) : "");
  const [activityType, setActivityType] = useState<WorkSessionActivityType>(session.activityType);
  const [note, setNote] = useState(session.note ?? "");
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const result = await correctWorkSession(session.id, {
        videoId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        activityType,
        note: note.trim().length > 0 ? note.trim() : null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      onSaved();
    });
  }

  return (
    <div className="mt-4 rounded-md border border-amber-800/40 bg-amber-950/10 p-3">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-amber-300">
        Correcting Session #{session.id}
      </p>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Start</span>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-[#00FF41]/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">End</span>
          <input
            type="datetime-local"
            value={endedAt}
            onChange={(event) => setEndedAt(event.target.value)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-[#00FF41]/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Activity</span>
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as WorkSessionActivityType)}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-[#00FF41]/50"
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
            Video (client → project → video)
          </span>
          <select
            value={videoId}
            onChange={(event) => setVideoId(Number(event.target.value))}
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-[#00FF41]/50"
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
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context for this correction"
            className="min-h-9 w-full rounded border border-zinc-700 bg-zinc-950/70 px-2 text-xs text-white outline-none focus:border-[#00FF41]/50"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-[#FF0000]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-8 rounded bg-amber-500 px-3 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save correction"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="min-h-8 rounded border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SessionInspectorPanel({
  session,
  isOverlap,
  videoOptions,
  onClose,
}: {
  session: SessionTimelineItem | null;
  isOverlap: boolean;
  videoOptions: WorkSessionVideoOption[];
  onClose: () => void;
}) {
  const origin = useCurrentOrigin();
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    if (!session) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, onClose]);

  if (!session) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Session ${session.id} detail`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-xl border-t border-zinc-800 bg-[#0A0A0A] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:inset-y-0 sm:inset-x-auto sm:right-0 sm:max-h-none sm:w-[360px] sm:max-w-[92vw] sm:rounded-none sm:rounded-l-xl sm:border-l sm:border-t-0"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="float-right flex h-7 w-7 items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:text-white"
        >
          ✕
        </button>
        <p className={`${pixelFont.className} mb-2 text-[9px] uppercase tracking-wide text-zinc-500`}>
          Session
        </p>
        <p className="text-xl font-black text-white">
          {formatTime(session.startedAt)}
          {session.endedAt ? ` → ${formatTime(session.endedAt)}` : " (running)"}
        </p>
        <p className={`mb-4 text-sm font-bold ${session.status === "OPEN" ? "text-[#00FF41]" : "text-zinc-400"}`}>
          {session.status === "OPEN" ? "Running · " : ""}
          {formatClosedDuration(session.durationSeconds)}
        </p>

        <p className="text-base font-black text-white">{session.clientName ?? "—"}</p>
        <p className="text-sm text-zinc-400">{session.projectName ?? "—"}</p>
        <Link
          href={videoWorkspaceHref(session.videoId, origin)}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          {session.videoTitle} →
        </Link>

        <div className="my-4 h-px bg-zinc-800" />

        <p className="text-sm text-zinc-400">Source: {session.source}</p>
        <p className="text-sm text-zinc-400">Type: {WORK_SESSION_ACTIVITY_LABELS[session.activityType]}</p>
        {session.note && (
          <p className="mt-2 text-sm italic text-zinc-500">&quot;{session.note}&quot;</p>
        )}

        {isOverlap && (
          <div className="mt-4 rounded border border-[#FF0000]/35 bg-[#FF0000]/10 p-3 text-xs leading-5 text-red-300">
            ⚠ This session overlaps another one in view. Nothing has been merged
            or changed automatically — inspect both and correct manually if one
            is wrong.
          </div>
        )}

        {correcting ? (
          <CorrectionForm
            session={session}
            videoOptions={videoOptions}
            onCancel={() => setCorrecting(false)}
            onSaved={() => setCorrecting(false)}
          />
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={videoWorkspaceHref(session.videoId, origin)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:border-cyan-700"
            >
              Open video workspace →
            </Link>
            <button
              type="button"
              disabled={session.status === "OPEN"}
              onClick={() => setCorrecting(true)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-xs font-bold text-zinc-200 enabled:hover:border-[#00FF41]/50 disabled:opacity-40"
            >
              {session.status === "OPEN"
                ? "Correct attribution (unavailable — session still open)"
                : "Correct attribution"}
            </button>
            {session.sensorSessionId !== null && (
              <Link
                href={`/productivity/sensor/sessions/${session.sensorSessionId}`}
                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-xs font-bold text-violet-300 hover:border-violet-600"
              >
                Sensor detail →
              </Link>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
