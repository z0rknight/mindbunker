"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { correctWorkSession } from "@/modules/work-sessions/actions";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  type CorrelatedMemoryNote,
  type WorkSessionActivityType,
  type WorkSessionHistoryEntry,
  type WorkSessionWeekGroup,
} from "@/modules/work-sessions/core";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local (browser) time.
function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function SessionEditForm({
  session,
  videoOptions,
  onCancel,
  onSaved,
}: {
  session: WorkSessionHistoryEntry;
  videoOptions: WorkSessionVideoOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [videoId, setVideoId] = useState(session.videoId);
  const [startedAt, setStartedAt] = useState(toDatetimeLocalValue(session.startedAt));
  const [endedAt, setEndedAt] = useState(
    session.endedAt ? toDatetimeLocalValue(session.endedAt) : "",
  );
  const [activityType, setActivityType] = useState<WorkSessionActivityType>(
    session.activityType,
  );
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
    <tr className="border-b border-amber-800/40 bg-amber-950/10">
      <td colSpan={8} className="px-4 py-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-amber-300">
          Correcting Work Session #{session.id}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Start
            </label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              End
            </label>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={(event) => setEndedAt(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Activity
            </label>
            <select
              value={activityType}
              onChange={(event) =>
                setActivityType(event.target.value as WorkSessionActivityType)
              }
              className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-cyan-500"
            >
              {WORK_SESSION_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_SESSION_ACTIVITY_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Video (client → project → video)
            </label>
            <select
              value={videoId}
              onChange={(event) => setVideoId(Number(event.target.value))}
              className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-cyan-500"
            >
              {videoOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {[option.clientName, option.projectName, option.title]
                    .filter(Boolean)
                    .join(" — ")}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context for this correction"
              className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-2.5 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="min-h-9 rounded-lg bg-amber-500 px-3 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save correction"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-amber-200/70">
          Corrections are logged to this client&apos;s CRM timeline as a
          &quot;work_session.corrected&quot; event — the original values stay
          visible there even after this row updates.
        </p>
      </td>
    </tr>
  );
}

function SessionRow({
  session,
  videoOptions,
  narrativeNotes,
}: {
  session: WorkSessionHistoryEntry;
  videoOptions: WorkSessionVideoOption[];
  narrativeNotes: CorrelatedMemoryNote[];
}) {
  const [editing, setEditing] = useState(false);
  // Session Narrative (Sunday Systems Round, Phase C/D): collapsed by
  // default, same "unbounded read list needs a visible default with an
  // explicit way to see more" invariant already applied to Video Memory
  // itself -- except here there is nothing to collapse *within*, just a
  // single reveal, since a session correlates with at most a handful of
  // notes in practice.
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  if (editing) {
    return (
      <SessionEditForm
        session={session}
        videoOptions={videoOptions}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <>
    <tr className="border-b border-zinc-800/50">
      <td className="px-4 py-3 text-white">
        {formatTime(session.startedAt)}
        {session.endedAt && (
          <span className="text-zinc-500"> – {formatTime(session.endedAt)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-300">
        {session.durationSeconds !== null ? (
          formatClosedDuration(session.durationSeconds)
        ) : (
          <span className="font-semibold text-emerald-400">running…</span>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-300">{session.clientName ?? "—"}</td>
      <td className="px-4 py-3 text-zinc-300">{session.projectName ?? "—"}</td>
      <td className="px-4 py-3 text-zinc-300">
        <Link
          href={`/productivity?video=${session.videoId}`}
          className="text-cyan-400 hover:text-cyan-300"
        >
          {session.videoTitle}
        </Link>
      </td>
      <td className="px-4 py-3 text-zinc-400">
        {WORK_SESSION_ACTIVITY_LABELS[session.activityType]}
      </td>
      <td className="max-w-[220px] px-4 py-3 text-zinc-500" title={session.note ?? undefined}>
        {session.note ? (
          <span className="line-clamp-2 text-xs leading-4">{session.note}</span>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {session.status === "OPEN" ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
              ● Open
            </span>
          ) : (
            <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
              Closed
            </span>
          )}
          {session.updatedAt && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
              Corrected
            </span>
          )}
          {session.status === "CLOSED" && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] font-bold uppercase text-cyan-400 hover:text-cyan-300"
            >
              Edit
            </button>
          )}
        </div>
        {/* Local consolidation round: source and the corrected timestamp
            (when present) are shown as always-visible text rather than a
            hover-only title attribute, which does not work on touch
            devices — this session's own visual QA includes a 390px mobile
            width. Nothing invented: source is only ever what the row
            actually recorded (WEB_TIMER or MAC_SENSOR_APPROVED). */}
        <p className="mt-1 text-[10px] text-zinc-600">
          {session.source}
          {session.updatedAt && <> · corrected {formatDateTime(session.updatedAt)}</>}
          {/* Brief C §13: reuse the existing Sensor Session detail route --
              no duplicate UI, just a link where the correlation exists. */}
          {session.sensorSessionId !== null && (
            <>
              {" · "}
              <Link
                href={`/productivity/sensor/sessions/${session.sensorSessionId}`}
                className="font-bold text-violet-400 hover:text-violet-300"
              >
                Sensor detail →
              </Link>
            </>
          )}
        </p>
        {narrativeNotes.length > 0 && (
          <button
            type="button"
            onClick={() => setNarrativeOpen((value) => !value)}
            className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300"
          >
            📝 {narrativeNotes.length} {narrativeNotes.length === 1 ? "note" : "notes"} during this session
            {narrativeOpen ? " · hide" : " · show"}
          </button>
        )}
      </td>
    </tr>
    {narrativeOpen && narrativeNotes.length > 0 && (
      <tr className="border-b border-zinc-800/50 bg-violet-500/[0.03]">
        <td colSpan={8} className="px-4 py-3">
          {/* Session Narrative (Phase B/C/D): a pure projection over
              existing Video Memory notes correlated to this session by
              video_id + timestamp containment -- no schema change, no new
              table. Read-only, exactly the notes that were already
              written; nothing here is inferred or invented. */}
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-violet-300">
            Video memory during this session
          </p>
          <ol className="space-y-2">
            {narrativeNotes.map((note) => (
              <li key={note.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
                <p className="whitespace-pre-wrap text-xs leading-5 text-zinc-300">{note.body}</p>
                <p className="mt-1 text-[10px] font-semibold text-zinc-600">
                  {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </td>
      </tr>
    )}
    </>
  );
}

export function WorkSessionHistoryTable({
  weeks,
  videoOptions,
  narratives,
}: {
  weeks: WorkSessionWeekGroup[];
  videoOptions: WorkSessionVideoOption[];
  narratives: Record<number, CorrelatedMemoryNote[]>;
}) {
  return (
    <div className="space-y-8">
      {weeks.map((week) => (
        <section key={week.weekKey}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">
              Week of {week.label}
            </h2>
            <p className="text-sm font-bold text-cyan-300">
              {formatClosedDuration(week.totalClosedSeconds)} tracked
            </p>
          </div>
          <div className="space-y-5">
            {week.days.map((day) => (
              <div key={day.dayKey}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-xs font-bold text-zinc-400">{day.label}</h3>
                  <p className="text-xs font-semibold text-zinc-500">
                    {formatClosedDuration(day.totalClosedSeconds)}
                    {day.hasOpenSession && " + running"}
                  </p>
                </div>
                <div className="overflow-hidden overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
                  <table className="w-full min-w-[1040px] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Time</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Duration</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Client</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Project</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Video</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Activity</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Note</th>
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.sessions.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          videoOptions={videoOptions}
                          narrativeNotes={narratives[session.id] ?? []}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
