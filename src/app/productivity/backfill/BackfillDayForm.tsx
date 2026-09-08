"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logManualWorkSession } from "@/modules/work-sessions/actions";
import {
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";
import { upsertHealthLog } from "@/modules/health/actions";
import { operatorLocalDateTimeToIso } from "@/modules/video-operations/core";
import type { getProductivityQuickOptions } from "@/modules/productivity/actions";

type QuickOptions = Awaited<ReturnType<typeof getProductivityQuickOptions>>;

type ExistingHealthLog = {
  sleepHours: number | null;
  caffeineMg: number | null;
  screenTimeHours: number | null;
  cyclingKm: number | null;
  cyclingMinutes: number | null;
  walkingMinutes: number | null;
  substancesNotes: string | null;
};

type SessionForDate = {
  id: number;
  videoTitle: string;
  clientName: string | null;
  projectName: string | null;
  activityType: WorkSessionActivityType;
  durationLabel: string;
  source: string;
};

const sectionClass = "rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5";
const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";

export function BackfillDayForm({
  date,
  existingHealthLog,
  quickOptions,
  sessionsForDate,
}: {
  date: string;
  existingHealthLog: ExistingHealthLog | null;
  quickOptions: QuickOptions;
  sessionsForDate: SessionForDate[];
}) {
  return (
    <div className="space-y-6">
      <WorkSection date={date} quickOptions={quickOptions} sessionsForDate={sessionsForDate} />
      <CapacitySection date={date} existing={existingHealthLog} />
    </div>
  );
}

function WorkSection({
  date,
  quickOptions,
  sessionsForDate,
}: {
  date: string;
  quickOptions: QuickOptions;
  sessionsForDate: SessionForDate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [activityType, setActivityType] = useState<WorkSessionActivityType>("EDITING");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");

  const availableProjects = useMemo(
    () => quickOptions.projects.filter((project) => project.clientId.toString() === clientId),
    [clientId, quickOptions],
  );
  const availableVideos = useMemo(
    () => quickOptions.videos.filter((video) => video.projectId !== null && video.projectId.toString() === projectId),
    [projectId, quickOptions],
  );

  function submit() {
    setError("");
    setFeedback("");
    const id = Number(videoId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Choose a client, project, and video first.");
      return;
    }
    if (!startTime || !endTime) {
      setError("Choose a start and end time.");
      return;
    }
    // Times are the operator's own local (São Paulo) wall clock --
    // operatorLocalDateTimeToIso resolves that to a real UTC instant the
    // same way OperationalMemoryPanel's Log Manual Time already does, so
    // a bare "09:00" here means 9am São Paulo, not 9am UTC.
    const startedAt = operatorLocalDateTimeToIso(`${date}T${startTime}`);
    const endedAt = operatorLocalDateTimeToIso(`${date}T${endTime}`);
    if (!startedAt || !endedAt) {
      setError("Choose a valid start and end time.");
      return;
    }
    startTransition(async () => {
      const result = await logManualWorkSession({
        videoId: id,
        startedAt,
        endedAt,
        activityType,
        note: note || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback("Logged.");
      setStartTime("");
      setEndTime("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Work</h2>

      {sessionsForDate.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-500">Already recorded for this day</p>
          {sessionsForDate.map((session) => (
            <div key={session.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
              <span className="font-bold text-white">{session.durationLabel}</span> · {WORK_SESSION_ACTIVITY_LABELS[session.activityType]} ·{" "}
              {session.videoTitle}
              {(session.clientName || session.projectName) && (
                <span className="text-zinc-500">
                  {" "}
                  ({[session.clientName, session.projectName].filter(Boolean).join(" / ")})
                </span>
              )}
              {session.source === "MANUAL" && <span className="ml-1.5 text-[10px] uppercase text-violet-400">Manual</span>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <select
          value={clientId}
          onChange={(event) => {
            setClientId(event.target.value);
            setProjectId("");
            setVideoId("");
          }}
          className={inputClass}
        >
          <option value="">Client</option>
          {quickOptions.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setVideoId("");
          }}
          disabled={!clientId}
          className={inputClass}
        >
          <option value="">Project</option>
          {availableProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select value={videoId} onChange={(event) => setVideoId(event.target.value)} disabled={!projectId} className={inputClass}>
          <option value="">Video</option>
          {availableVideos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title ?? `Video ${video.date}`}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <select value={activityType} onChange={(event) => setActivityType(event.target.value as WorkSessionActivityType)} className={inputClass}>
          {WORK_SESSION_ACTIVITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {WORK_SESSION_ACTIVITY_LABELS[value]}
            </option>
          ))}
        </select>
        <label className="text-xs text-zinc-500">
          Start
          <input aria-label="Start time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500">
          End
          <input aria-label="End time" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note (optional)" maxLength={1_000} className={inputClass} />
      </div>

      {error && <p className="mt-2 text-xs text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="mt-2 text-xs text-emerald-300" aria-live="polite">{feedback}</p>}

      <button type="button" disabled={isPending} onClick={submit} className="mt-3 min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50">
        {isPending ? "Logging…" : "Log work block"}
      </button>
    </section>
  );
}

function CapacitySection({ date, existing }: { date: string; existing: ExistingHealthLog | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sleep, setSleep] = useState(existing?.sleepHours?.toString() ?? "");
  const [caffeine, setCaffeine] = useState(existing?.caffeineMg?.toString() ?? "");
  const [screenTime, setScreenTime] = useState(existing?.screenTimeHours?.toString() ?? "");
  const [walking, setWalking] = useState(existing?.walkingMinutes?.toString() ?? "");
  const [cyclingKm, setCyclingKm] = useState(existing?.cyclingKm?.toString() ?? "");
  // Note (Tuesday Patch Completion Round §I): reuses health_logs'
  // existing substancesNotes field -- already labeled "Notes" elsewhere
  // in the app (LogTodayButton/HealthLogEditor use the same field for
  // free-text day context, not literally substances-only). This IS a
  // canonical per-day row (health_logs.date is unique), so a note saved
  // here is honestly dated -- no createdAt is being backdated.
  const [note, setNote] = useState(existing?.substancesNotes ?? "");

  function submit() {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await upsertHealthLog({
        date,
        sleepHours: sleep ? Number(sleep) : undefined,
        caffeineMg: caffeine ? Number(caffeine) : undefined,
        screenTimeHours: screenTime ? Number(screenTime) : undefined,
        walkingMinutes: walking ? Number(walking) : undefined,
        cyclingKm: cyclingKm ? Number(cyclingKm) : undefined,
        substancesNotes: note || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback("Saved.");
      router.refresh();
    });
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Capacity & Context</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {existing ? "Already has values for this day -- editing updates them in place." : "Nothing recorded yet for this day."}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-zinc-500">
          Sleep (hours)
          <input type="number" inputMode="decimal" step="0.5" min="0" max="24" value={sleep} onChange={(event) => setSleep(event.target.value)} placeholder="7.5" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500">
          Caffeine (mg)
          <input type="number" inputMode="numeric" min="0" value={caffeine} onChange={(event) => setCaffeine(event.target.value)} placeholder="200" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500">
          Screen time (hours)
          <input type="number" inputMode="decimal" step="0.5" min="0" value={screenTime} onChange={(event) => setScreenTime(event.target.value)} placeholder="6" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500">
          Walking (minutes)
          <input type="number" inputMode="numeric" min="0" value={walking} onChange={(event) => setWalking(event.target.value)} placeholder="30" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500 sm:col-span-2">
          Cycling (km)
          <input type="number" inputMode="decimal" step="0.1" min="0" value={cyclingKm} onChange={(event) => setCyclingKm(event.target.value)} placeholder="12" className={`${inputClass} mt-1`} />
        </label>
      </div>

      <label className="mt-2 block text-xs text-zinc-500">
        Notes
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Relaxed, played videogames, produced client videos…"
          className={`${inputClass} mt-1`}
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="mt-2 text-xs text-emerald-300" aria-live="polite">{feedback}</p>}

      <button type="button" disabled={isPending} onClick={submit} className="mt-3 min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50">
        {isPending ? "Saving…" : "Save capacity & note"}
      </button>
    </section>
  );
}
