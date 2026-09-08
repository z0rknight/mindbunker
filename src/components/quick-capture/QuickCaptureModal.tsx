"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getProductivityQuickOptions, reorderExecutionQueueItem } from "@/modules/productivity/actions";
import {
  createVideoCommitment,
  openVideoBlocker,
  recordDetailedRevision,
} from "@/modules/video-operations/actions";
import {
  BLOCKER_CATEGORIES,
  REVISION_CATEGORIES,
  REVISION_CAUSES,
  type BlockerCategory,
  type RevisionCategory,
  type RevisionCause,
} from "@/modules/video-operations/config";
import {
  QUICK_DEADLINE_PRESETS,
  operatorLocalDateTimeToIso,
} from "@/modules/video-operations/core";
import { addVideoOperationalNote } from "@/modules/video-memory/actions";
import { VIDEO_OPERATIONAL_NOTE_MAX_LENGTH } from "@/modules/video-memory/core";
import { startWorkSession } from "@/modules/work-sessions/actions";
import { DEFAULT_WORK_SESSION_ACTIVITY } from "@/modules/work-sessions/core";
import { getClientById } from "@/modules/crm/actions";
import { updateOpportunity } from "@/modules/gateway/actions";
import type { QuickCaptureTarget } from "./QuickCaptureProvider";

type QuickOptions = Awaited<ReturnType<typeof getProductivityQuickOptions>>;

type ActionId = "commitment" | "correction" | "blocker" | "followup" | "note" | "start" | "queue-top";

const ACTIONS: Array<{ id: ActionId; label: string; hint: string; needsClientOnly?: boolean }> = [
  { id: "start", label: "Start Work", hint: "Begin tracking time on a video" },
  { id: "commitment", label: "Quick Deadline", hint: "Record a promise with a due date" },
  { id: "blocker", label: "Block Work", hint: "Mark a video blocked" },
  { id: "correction", label: "Register Correction", hint: "Log a revision event" },
  { id: "followup", label: "Client Follow-up", hint: "Set the next step with a client", needsClientOnly: true },
  { id: "note", label: "Quick Note", hint: "Add an operational note to a video" },
  { id: "queue-top", label: "Move to top of queue", hint: "Bring an existing item to the front" },
];

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";
const buttonClass =
  "min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";
const primaryButtonClass =
  "min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-50";

export function QuickCaptureModal({
  target,
  onClose,
}: {
  target?: QuickCaptureTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [action, setAction] = useState<ActionId | null>(null);
  const [options, setOptions] = useState<QuickOptions | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductivityQuickOptions().then((result) => {
      if (!cancelled) setOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function afterSuccess() {
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/80 pt-[10vh] backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Quick Capture"
        className="max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl mx-4"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Quick Capture</p>
            {target && (
              <p className="mt-1 truncate text-xs font-bold text-zinc-400">
                {[target.clientName, target.projectName, target.videoTitle].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Capture"
            className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-300"
          >
            ×
          </button>
        </header>

        {!action ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAction(item.id)}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-left hover:border-violet-500/60"
              >
                <p className="text-sm font-black text-white">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{item.hint}</p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button type="button" onClick={() => setAction(null)} className="mb-3 text-xs font-bold text-zinc-500 hover:text-zinc-300">
              ← Back
            </button>
            {action === "followup" ? (
              <FollowUpAction target={target} options={options} onDone={afterSuccess} />
            ) : (
              <VideoScopedAction action={action} target={target} options={options} onDone={afterSuccess} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Shared video target picking ───────────────────────────────────────────

function useVideoTarget(target: QuickCaptureTarget | undefined, options: QuickOptions | null) {
  const [clientId, setClientId] = useState(target?.clientId?.toString() ?? "");
  const [projectId, setProjectId] = useState(target?.projectId?.toString() ?? "");
  const [videoId, setVideoId] = useState(target?.videoId?.toString() ?? "");

  const availableProjects = useMemo(
    () => options?.projects.filter((project) => project.clientId.toString() === clientId) ?? [],
    [clientId, options],
  );
  const availableVideos = useMemo(
    () => options?.videos.filter((video) => video.projectId !== null && video.projectId.toString() === projectId) ?? [],
    [projectId, options],
  );

  return { clientId, setClientId, projectId, setProjectId, videoId, setVideoId, availableProjects, availableVideos };
}

function VideoTargetPicker({
  target,
  options,
  state,
}: {
  target: QuickCaptureTarget | undefined;
  options: QuickOptions | null;
  state: ReturnType<typeof useVideoTarget>;
}) {
  if (target?.videoId) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-sm text-zinc-300">
        {target.videoTitle ?? `Video #${target.videoId}`}
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        value={state.clientId}
        onChange={(event) => {
          state.setClientId(event.target.value);
          state.setProjectId("");
          state.setVideoId("");
        }}
        disabled={!options}
        className={inputClass}
      >
        <option value="">Client</option>
        {options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <select
        value={state.projectId}
        onChange={(event) => {
          state.setProjectId(event.target.value);
          state.setVideoId("");
        }}
        disabled={!state.clientId}
        className={inputClass}
      >
        <option value="">Project</option>
        {state.availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <select
        value={state.videoId}
        onChange={(event) => state.setVideoId(event.target.value)}
        disabled={!state.projectId}
        className={inputClass}
      >
        <option value="">Video</option>
        {state.availableVideos.map((video) => (
          <option key={video.id} value={video.id}>{video.title ?? `Video ${video.date}`}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Video-scoped actions (commitment / blocker / correction / note / start / queue-top) ──

function VideoScopedAction({
  action,
  target,
  options,
  onDone,
}: {
  action: ActionId;
  target: QuickCaptureTarget | undefined;
  options: QuickOptions | null;
  onDone: () => void;
}) {
  const videoState = useVideoTarget(target, options);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [commitmentTitle, setCommitmentTitle] = useState("");
  const [commitmentDue, setCommitmentDue] = useState("");
  const [blockerCategory, setBlockerCategory] = useState<BlockerCategory>("CLIENT");
  const [blockerNote, setBlockerNote] = useState("");
  const [revisionCause, setRevisionCause] = useState<RevisionCause>("UNKNOWN");
  const [revisionCategory, setRevisionCategory] = useState<RevisionCategory | "">("");
  const [revisionNote, setRevisionNote] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const videoId = Number(videoState.videoId);
  const hasVideo = Number.isSafeInteger(videoId) && videoId > 0;

  function run(run: () => Promise<{ success: boolean; message?: string; error?: string }>) {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await run();
      if (!result.success) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setFeedback(result.message ?? "Saved.");
      window.setTimeout(onDone, 500);
    });
  }

  return (
    <div className="space-y-3">
      <VideoTargetPicker target={target} options={options} state={videoState} />

      {action === "start" && (
        <button
          type="button"
          disabled={isPending || !hasVideo}
          onClick={() => run(() => startWorkSession(videoId, DEFAULT_WORK_SESSION_ACTIVITY))}
          className={primaryButtonClass}
        >
          {isPending ? "Starting…" : "Start Work"}
        </button>
      )}

      {action === "queue-top" && (
        <button
          type="button"
          disabled={isPending || !hasVideo}
          onClick={() => run(() => reorderExecutionQueueItem(videoId, "top"))}
          className={primaryButtonClass}
        >
          {isPending ? "Moving…" : "Move to top of queue"}
        </button>
      )}

      {action === "commitment" && (
        <>
          <input value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} placeholder="Promise made…" maxLength={300} className={inputClass} />
          <div className="flex flex-wrap gap-2">
            {QUICK_DEADLINE_PRESETS.map((preset) => (
              <button key={preset.label} type="button" disabled={isPending} onClick={() => setCommitmentDue(preset.resolve())} className={buttonClass}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_auto]">
            <input aria-label="Due date (custom)" type="datetime-local" value={commitmentDue} onChange={(event) => setCommitmentDue(event.target.value)} className={inputClass} />
            <button
              type="button"
              disabled={isPending || !hasVideo || !commitmentTitle.trim() || !commitmentDue}
              onClick={() => {
                const dueAt = operatorLocalDateTimeToIso(commitmentDue);
                if (!dueAt) {
                  setError("Choose a valid São Paulo date and time.");
                  return;
                }
                run(() => createVideoCommitment({ videoId, title: commitmentTitle, dueAt }));
              }}
              className={primaryButtonClass}
            >
              {isPending ? "Saving…" : "Add promise"}
            </button>
          </div>
        </>
      )}

      {action === "blocker" && (
        <>
          <select value={blockerCategory} onChange={(event) => setBlockerCategory(event.target.value as BlockerCategory)} className={inputClass}>
            {BLOCKER_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <input value={blockerNote} onChange={(event) => setBlockerNote(event.target.value)} placeholder="What is blocked?" maxLength={1_000} className={inputClass} />
          <button
            type="button"
            disabled={isPending || !hasVideo}
            onClick={() => run(() => openVideoBlocker({ videoId, category: blockerCategory, note: blockerNote }))}
            className={primaryButtonClass}
          >
            {isPending ? "Saving…" : "Open blocker"}
          </button>
        </>
      )}

      {action === "correction" && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={revisionCause} onChange={(event) => setRevisionCause(event.target.value as RevisionCause)} className={inputClass}>
              {REVISION_CAUSES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
            <select value={revisionCategory} onChange={(event) => setRevisionCategory(event.target.value as RevisionCategory | "")} className={inputClass}>
              <option value="">No category</option>
              {REVISION_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <input value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="What changed?" maxLength={1_000} className={inputClass} />
          <button
            type="button"
            disabled={isPending || !hasVideo}
            onClick={() => run(() => recordDetailedRevision({ videoId, causedBy: revisionCause, category: revisionCategory, note: revisionNote }))}
            className={primaryButtonClass}
          >
            {isPending ? "Saving…" : "Register Correction"}
          </button>
        </>
      )}

      {action === "note" && (
        <>
          <textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            maxLength={VIDEO_OPERATIONAL_NOTE_MAX_LENGTH}
            placeholder="What just happened?"
            rows={3}
            className={inputClass}
          />
          <button
            type="button"
            disabled={isPending || !hasVideo || !noteBody.trim()}
            onClick={() => run(() => addVideoOperationalNote(videoId, noteBody))}
            className={primaryButtonClass}
          >
            {isPending ? "Saving…" : "Add note"}
          </button>
        </>
      )}

      {error && <p className="text-xs text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="text-xs text-emerald-300" aria-live="polite">{feedback}</p>}
    </div>
  );
}

// ─── Client follow-up (clientId only, no project/video) ────────────────────

function FollowUpAction({
  target,
  options,
  onDone,
}: {
  target: QuickCaptureTarget | undefined;
  options: QuickOptions | null;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState(target?.clientId?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");

  function pad(value: number) {
    return value.toString().padStart(2, "0");
  }
  function todayPlusDays(days: number) {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function save() {
    const id = Number(clientId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Choose a client.");
      return;
    }
    setError("");
    setFeedback("");
    startTransition(async () => {
      const client = await getClientById(id);
      if (!client) {
        setError("Client not found.");
        return;
      }
      const result = await updateOpportunity(id, {
        stage: client.opportunityStage,
        serviceInterest: client.serviceInterest ?? "",
        nextAction,
        nextActionDate,
        qualificationNotes: client.qualificationNotes ?? "",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback("Follow-up saved.");
      window.setTimeout(onDone, 500);
    });
  }

  return (
    <div className="space-y-3">
      {target?.clientId ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-sm text-zinc-300">{target.clientName}</p>
      ) : (
        <select value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={!options} className={inputClass}>
          <option value="">Client</option>
          {options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      )}
      <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="What's the next step?" maxLength={500} className={inputClass} />
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "Tomorrow", value: todayPlusDays(1) },
          { label: "In 3 days", value: todayPlusDays(3) },
          { label: "Next week", value: todayPlusDays(7) },
        ].map((preset) => (
          <button key={preset.label} type="button" disabled={isPending} onClick={() => setNextActionDate(preset.value)} className={buttonClass}>
            {preset.label}
          </button>
        ))}
        <input aria-label="Follow-up date" type="date" value={nextActionDate} onChange={(event) => setNextActionDate(event.target.value)} className={`${inputClass} w-auto`} />
      </div>
      {error && <p className="text-xs text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="text-xs text-emerald-300" aria-live="polite">{feedback}</p>}
      <button type="button" disabled={isPending} onClick={save} className={primaryButtonClass}>
        {isPending ? "Saving…" : "Save follow-up"}
      </button>
    </div>
  );
}
