"use client";

import {
  createVideoLog,
  getProductivityQuickOptions,
  transitionVideoStatus,
} from "@/modules/productivity/actions";
import {
  VIDEO_STATUS_LABELS,
  isVideoDirectlyFinishable,
} from "@/modules/productivity/config";
import { PROJECT_STATUS_GROUPS } from "@/modules/projects/config";
import { startWorkSession } from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type QuickOptions = Awaited<ReturnType<typeof getProductivityQuickOptions>>;

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10";

function ActionSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
              Productivity
            </p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function PlanVideoButton({
  initialProjectId = null,
  initiallyOpen = false,
  projectContext = null,
  // House Cleaning Wave 2 §15: Project Detail wants Plan Video reachable
  // but deliberately smaller than the one primary Add Video action --
  // same trigger logic and form, just a plain link-style trigger instead
  // of the big tile used on Dashboard/Productivity's Quick Actions grid.
  compact = false,
}: {
  initialProjectId?: number | null;
  initiallyOpen?: boolean;
  projectContext?: {
    id: number;
    name: string;
    clientName: string;
  } | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(
    projectContext?.id.toString() ?? initialProjectId?.toString() ?? "",
  );
  const [createUnderClientId, setCreateUnderClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");

  async function fetchOptions() {
    try {
      const loaded = await getProductivityQuickOptions();
      setOptions(loaded);
      const requestedProject = initialProjectId
        ? loaded.projects.find((project) => project.id === initialProjectId)
        : null;
      setProjectId((current) =>
        requestedProject?.id.toString() ??
        (current || loaded.projects[0]?.id.toString() || ""),
      );
      setCreateUnderClientId((current) => current || loaded.clients[0]?.id.toString() || "");
    } catch {
      setFeedback("Could not load projects.");
    }
  }

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    if (projectContext) {
      setProjectId(projectContext.id.toString());
      return;
    }
    startTransition(fetchOptions);
  }

  function closePlan() {
    setOpen(false);
    if (initiallyOpen) router.replace("/productivity", { scroll: false });
  }

  useEffect(() => {
    if (!initiallyOpen) return;
    setOpen(true);
    setFeedback("");
    if (projectContext) {
      setProjectId(projectContext.id.toString());
    } else {
      startTransition(fetchOptions);
    }
    // The query-driven opening is intentionally one-shot for this mounted button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyOpen, initialProjectId]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const selectedProjectId = projectContext?.id ?? (projectId ? Number(projectId) : null);
      const result = await createVideoLog({
        title,
        projectId: selectedProjectId,
        clientId: null,
        notes,
        status: "PLANNED",
      });
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setTitle("");
      setNotes("");
      setOpen(false);
      if (initiallyOpen) {
        router.replace("/productivity", { scroll: false });
      } else {
        router.refresh();
      }
    });
  }

  const createProjectHref = createUnderClientId
    ? `/crm/${createUnderClientId}?tab=projects&createProject=1&returnTo=${encodeURIComponent("/productivity?planVideo=1")}`
    : "/crm";

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={handleOpen}
          className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400 transition hover:border-cyan-600/60 hover:text-cyan-300"
        >
          + Plan a future video
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-cyan-800 px-5 py-5 text-sm font-bold text-white transition-all hover:bg-cyan-700 active:scale-95"
        >
          <span className="text-2xl">＋</span>
          <span>Plan Video</span>
        </button>
      )}

      {open && (
        <ActionSheet title="Plan a video" onClose={closePlan}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sep 16 Operational Reality Patch: operator-reported
                confusion, verbatim -- "não sei se cadastro video a video ou
                se faço um let's cook, porque de qualquer forma eu acabo
                registrando todo o processo em um unico video." One line,
                shown every time this sheet opens, at the exact decision
                point -- not a new flow, not a redesign. */}
            <Link
              href="/productivity/orders/new"
              className="block rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-3 text-xs text-emerald-300 hover:border-emerald-600"
            >
              Multiple deliverables from one source (a Content Waterfall batch)? Use{" "}
              <span className="font-black">LET&apos;S COOK →</span> instead — one shared batch, each video still
              tracked on its own.
            </Link>
            <div>
              <label htmlFor="plannedVideoTitle" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Video name
              </label>
              <input
                id="plannedVideoTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                required
                autoFocus
                placeholder="Launch reel, Episode 04…"
                className={fieldClassName}
              />
            </div>
            {projectContext ? (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                  Creating inside this project
                </p>
                <p className="mt-1 font-black text-white">{projectContext.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Client: {projectContext.clientName}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="plannedVideoProject" className="mb-1.5 block text-xs font-bold text-zinc-400">
                    Project
                  </label>
                  <select
                    id="plannedVideoProject"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    disabled={!options || isPending}
                    required
                    className={fieldClassName}
                  >
                    <option value="">Select a project</option>
                    {options?.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} — {project.clientName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-3">
                  <p className="text-xs leading-5 text-zinc-500">
                    Videos belong to Projects. If this commitment does not exist yet, create it under its Client and return here.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      aria-label="Client for new project"
                      value={createUnderClientId}
                      onChange={(event) => setCreateUnderClientId(event.target.value)}
                      disabled={!options || options.clients.length === 0}
                      className={fieldClassName}
                    >
                      {options?.clients.length === 0 && <option value="">No clients yet</option>}
                      {options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                    <Link href={createProjectHref} className="flex min-h-12 items-center justify-center rounded-xl border border-cyan-500/30 px-4 text-sm font-black text-cyan-300">
                      Create Project
                    </Link>
                  </div>
                </div>
              </>
            )}
            <div>
              <label htmlFor="plannedVideoNotes" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Notes <span className="font-normal text-zinc-600">optional</span>
              </label>
              <input
                id="plannedVideoNotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2_000}
                placeholder="Version, format, delivery…"
                className={fieldClassName}
              />
            </div>
            {feedback && <p aria-live="polite" className="text-sm text-amber-300">{feedback}</p>}
            <button
              type="submit"
              disabled={isPending || !title.trim() || !projectId}
              className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Create planned video"}
            </button>
          </form>
        </ActionSheet>
      )}
    </>
  );
}

// Dashboard "Start Work" primary action (Sprint 1.2.x local dogfooding
// round): the same Client → Project → Video → Activity → Start flow that
// used to sit permanently exposed on the Dashboard as HomeTrackingPanel's
// inline form, now behind a compact modal so the Dashboard's default state
// is two buttons, not a four-field form. Reuses startWorkSession() and the
// single-open-session database guard exactly as before -- no new timer, no
// new work-session table, no new activity subsystem. HomeTrackingPanel
// still owns the "a session is already active" surfacing (the Tracking Now
// banner) and renders this button only when nothing is running.
export function StartWorkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [activityType, setActivityType] =
    useState<WorkSessionActivityType>(DEFAULT_WORK_SESSION_ACTIVITY);
  const [feedback, setFeedback] = useState("");

  const availableProjects = useMemo(
    () =>
      options?.projects.filter(
        (project) => project.clientId.toString() === clientId,
      ) ?? [],
    [clientId, options],
  );
  const availableVideos = useMemo(
    () =>
      options?.videos.filter(
        (video) =>
          video.projectId !== null && video.projectId.toString() === projectId,
      ) ?? [],
    [projectId, options],
  );

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    startTransition(async () => {
      try {
        setOptions(await getProductivityQuickOptions());
      } catch {
        setFeedback("Could not load clients and projects.");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setClientId("");
    setProjectId("");
    setVideoId("");
    setActivityType(DEFAULT_WORK_SESSION_ACTIVITY);
    setFeedback("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const selectedVideoId = Number(videoId);
    if (!Number.isSafeInteger(selectedVideoId) || selectedVideoId <= 0) {
      setFeedback("Choose a client, project, and video first.");
      return;
    }
    setFeedback("");
    startTransition(async () => {
      const result = await startWorkSession(selectedVideoId, activityType);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setOpen(false);
      router.push(`/productivity?video=${selectedVideoId}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-5 text-sm font-bold text-white transition-all hover:bg-emerald-500 active:scale-95"
      >
        <span className="text-2xl">▶</span>
        <span>Start Work</span>
      </button>

      {open && (
        <ActionSheet title="What are you working on?" onClose={handleClose}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="startWorkClient" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Client
              </label>
              <select
                id="startWorkClient"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setProjectId("");
                  setVideoId("");
                }}
                disabled={!options || isPending}
                className={fieldClassName}
              >
                <option value="">Choose client</option>
                {options?.clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startWorkProject" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Project
              </label>
              <select
                id="startWorkProject"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setVideoId("");
                }}
                disabled={!clientId || isPending}
                className={fieldClassName}
              >
                <option value="">Choose project</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startWorkVideo" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Video
              </label>
              <select
                id="startWorkVideo"
                value={videoId}
                onChange={(event) => setVideoId(event.target.value)}
                disabled={!projectId || isPending}
                className={fieldClassName}
              >
                <option value="">Choose video</option>
                {availableVideos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.title ?? `Video ${video.date}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startWorkActivity" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Activity
              </label>
              <select
                id="startWorkActivity"
                value={activityType}
                onChange={(event) => setActivityType(event.target.value as WorkSessionActivityType)}
                disabled={isPending}
                className={fieldClassName}
              >
                {WORK_SESSION_ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>{WORK_SESSION_ACTIVITY_LABELS[type]}</option>
                ))}
              </select>
            </div>
            {feedback && <p aria-live="polite" className="text-sm text-amber-300">{feedback}</p>}
            <button
              type="submit"
              disabled={isPending || !videoId}
              className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? "Starting…" : "Start"}
            </button>
          </form>
        </ActionSheet>
      )}
    </>
  );
}

// Taryn August Ingest Readiness §5: the Dashboard's second primary
// action. This is deliberately NOT a parallel data model -- it is the
// same Client -> Project -> Video creation path as PlanVideoButton above
// (createVideoLog, resolveVideoAssignment), just entered Client-first and
// filtered to that client's ACTIVE projects, then redirecting straight
// into the new video's workspace instead of staying on the Dashboard.
// Eliminates the old Dashboard -> Productivity -> Projects -> Project ->
// Plan Video chain for the single most common action: starting a new
// piece of work.
export function NewWorkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");

  const availableProjects = useMemo(
    () =>
      (options?.projects ?? []).filter(
        (project) =>
          project.clientId.toString() === clientId &&
          PROJECT_STATUS_GROUPS[project.status] === "active",
      ),
    [clientId, options],
  );

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    startTransition(async () => {
      try {
        setOptions(await getProductivityQuickOptions());
      } catch {
        setFeedback("Could not load clients and projects.");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setClientId("");
    setProjectId("");
    setTitle("");
    setFeedback("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) {
      setFeedback("Choose a client and an active project first.");
      return;
    }
    if (!title.trim()) {
      setFeedback("Name the video.");
      return;
    }
    setFeedback("");
    startTransition(async () => {
      const result = await createVideoLog({
        title: title.trim(),
        projectId: Number(projectId),
        clientId: null,
        notes: "",
        status: "PLANNED",
      });
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setOpen(false);
      router.push(`/productivity?video=${result.videoId}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-5 text-sm font-bold text-white transition-all hover:bg-cyan-600 active:scale-95"
      >
        <span className="text-2xl">＋</span>
        <span>New Work</span>
      </button>

      {open && (
        <ActionSheet title="Start new work" onClose={handleClose}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newWorkClient" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Client
              </label>
              <select
                id="newWorkClient"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setProjectId("");
                }}
                disabled={!options || isPending}
                className={fieldClassName}
              >
                <option value="">Choose client</option>
                {options?.clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newWorkProject" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Project (active only)
              </label>
              <select
                id="newWorkProject"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={!clientId || isPending}
                className={fieldClassName}
              >
                <option value="">Choose project</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              {clientId && availableProjects.length === 0 && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  This client has no active/in-review project yet — create one from their CRM page first.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="newWorkTitle" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Video name
              </label>
              <input
                id="newWorkTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                required
                placeholder="Episode 04, Cut 1.0…"
                className={fieldClassName}
              />
            </div>
            {feedback && <p aria-live="polite" className="text-sm text-amber-300">{feedback}</p>}
            <button
              type="submit"
              disabled={isPending || !projectId || !title.trim()}
              className="min-h-12 w-full rounded-xl bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create & open"}
            </button>
          </form>
        </ActionSheet>
      )}
    </>
  );
}

export function FinishedVideoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [videoId, setVideoId] = useState("");
  const [feedback, setFeedback] = useState("");

  const candidates = options?.videos.filter((video) => isVideoDirectlyFinishable(video.status)) ?? [];

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    startTransition(async () => {
      try {
        const loaded = await getProductivityQuickOptions();
        setOptions(loaded);
        const first = loaded.videos.find((video) => isVideoDirectlyFinishable(video.status));
        setVideoId(first?.id.toString() ?? "");
      } catch {
        setFeedback("Could not load active videos.");
      }
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const selected = candidates.find((video) => video.id === Number(videoId));
    if (!selected) return;
    setFeedback("");
    startTransition(async () => {
      const result = await transitionVideoStatus(selected.id, selected.status, "DONE");
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-5 text-sm font-bold text-white transition-all hover:bg-violet-500 active:scale-95">
        <span className="text-2xl">🎬</span>
        <span>Finished Video</span>
      </button>
      {open && (
        <ActionSheet title="Finish an existing video" onClose={() => setOpen(false)}>
          <p className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs leading-5 text-violet-200">
            This moves the selected canonical Video to Done. It never creates a duplicate record.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="finishedVideoId" className="mb-1.5 block text-xs font-bold text-zinc-400">Video</label>
              <select id="finishedVideoId" value={videoId} onChange={(event) => setVideoId(event.target.value)} disabled={!options || isPending || candidates.length === 0} required className={fieldClassName}>
                {candidates.length === 0 && <option value="">No video is ready to finish</option>}
                {candidates.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.title ?? `Video ${video.date}`} — {video.projectName ?? "Legacy / no project"} — {VIDEO_STATUS_LABELS[video.status]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs leading-5 text-zinc-500">
              Planned videos must first enter production. Changes requested must return to production or review before completion.
            </p>
            {feedback && <p aria-live="polite" className="text-sm text-amber-300">{feedback}</p>}
            <button type="submit" disabled={isPending || !videoId} className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50">
              {isPending ? "Finishing…" : "Mark selected video Done"}
            </button>
          </form>
        </ActionSheet>
      )}
    </>
  );
}

// House Cleaning Wave 2 §7: the +1/-1 "Manage Revision" quick action used
// to be a second, independent write path onto videoLogs.revisionsCount --
// it never wrote a `revisions` row, which is exactly what let the count
// and the detailed provenance table drift apart (see the schema comment
// on `revisions` in db/schema.ts). Retired from operator UI per the
// research report's explicit recommendation: one canonical action
// (recordDetailedRevision, reachable from a video's own workspace) now
// owns revision creation. changeRevisionCount itself is left in
// modules/productivity/actions.ts -- no server logic was deleted.
