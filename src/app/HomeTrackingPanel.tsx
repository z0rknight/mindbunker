"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { startWorkSession } from "@/modules/work-sessions/actions";
import {
  DEFAULT_WORK_SESSION_ACTIVITY,
  WORK_SESSION_ACTIVITY_LABELS,
  WORK_SESSION_ACTIVITY_TYPES,
  formatClosedDuration,
  type OpenWorkSession,
  type WorkSessionActivityType,
} from "@/modules/work-sessions/core";

type ClientOption = { id: number; name: string };
type ProjectOption = { id: number; name: string; clientId: number; clientName: string };
type VideoOption = {
  id: number;
  title: string | null;
  date: string;
  projectId: number | null;
  clientId: number | null;
  projectName: string | null;
  clientName: string | null;
};

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-50";

export function HomeTrackingPanel({
  clients,
  projects,
  videos,
  openSession,
  openSessionElapsedSeconds,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  videos: VideoOption[];
  openSession: OpenWorkSession | null;
  openSessionElapsedSeconds: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [activityType, setActivityType] =
    useState<WorkSessionActivityType>(DEFAULT_WORK_SESSION_ACTIVITY);
  const [error, setError] = useState("");

  const availableProjects = useMemo(
    () => projects.filter((project) => project.clientId.toString() === clientId),
    [clientId, projects],
  );
  const availableVideos = useMemo(
    () =>
      videos.filter(
        (video) =>
          video.projectId !== null && video.projectId.toString() === projectId,
      ),
    [projectId, videos],
  );

  function startTracking() {
    const selectedVideoId = Number(videoId);
    if (!Number.isSafeInteger(selectedVideoId) || selectedVideoId <= 0) {
      setError("Choose a client, project, and video first.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await startWorkSession(selectedVideoId, activityType);
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.push(`/productivity?video=${selectedVideoId}`);
    });
  }

  if (openSession) {
    return (
      <section className="mb-8 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Tracking now
            </p>
            <h2 className="mt-2 truncate text-lg font-black text-white">{openSession.videoTitle}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {WORK_SESSION_ACTIVITY_LABELS[openSession.activityType]} · {formatClosedDuration(openSessionElapsedSeconds)} elapsed
            </p>
          </div>
          <Link
            href={`/productivity?video=${openSession.videoId}`}
            className="min-h-12 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-zinc-950 hover:bg-emerald-400"
          >
            Open active workspace
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-cyan-900/60 bg-cyan-950/15 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Start tracking</p>
        <h2 className="mt-1 text-lg font-black text-white">What are you working on?</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Choose the existing production context. The same one-session database guard used by the Video workspace stays authoritative.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold text-zinc-400">
          Client
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setProjectId("");
              setVideoId("");
            }}
            className={`${fieldClassName} mt-1.5`}
          >
            <option value="">Choose client</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>

        <label className="text-xs font-bold text-zinc-400">
          Project
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setVideoId("");
            }}
            disabled={!clientId}
            className={`${fieldClassName} mt-1.5`}
          >
            <option value="">Choose project</option>
            {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>

        <label className="text-xs font-bold text-zinc-400">
          Video
          <select
            value={videoId}
            onChange={(event) => setVideoId(event.target.value)}
            disabled={!projectId}
            className={`${fieldClassName} mt-1.5`}
          >
            <option value="">Choose video</option>
            {availableVideos.map((video) => (
              <option key={video.id} value={video.id}>{video.title?.trim() || `Video ${video.date}`}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold text-zinc-400">
          Activity
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as WorkSessionActivityType)}
            className={`${fieldClassName} mt-1.5`}
          >
            {WORK_SESSION_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>{WORK_SESSION_ACTIVITY_LABELS[type]}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={startTracking}
        disabled={isPending || !videoId}
        className="mt-4 min-h-12 w-full rounded-xl bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:opacity-40 sm:w-auto sm:min-w-44"
      >
        {isPending ? "Starting…" : "Start work"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
