"use client";

import {
  changeRevisionCount,
  getProductivityQuickOptions,
  logFinishedVideo,
} from "@/modules/productivity/actions";
import { useState, useTransition } from "react";

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

async function loadOptions(
  setOptions: (options: QuickOptions) => void,
  setFeedback: (message: string) => void,
) {
  try {
    setOptions(await getProductivityQuickOptions());
  } catch {
    setFeedback("Could not load projects and videos.");
  }
}

export function FinishedVideoButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    startTransition(() => loadOptions(setOptions, setFeedback));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await logFinishedVideo({
        title,
        projectId: projectId ? Number(projectId) : null,
        clientId: projectId ? null : clientId ? Number(clientId) : null,
        notes,
      });
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setTitle("");
      setProjectId("");
      setClientId("");
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-5 text-sm font-bold text-white transition-all hover:bg-violet-500 active:scale-95"
      >
        <span className="text-2xl">🎬</span>
        <span>Finished Video</span>
      </button>

      {open && (
        <ActionSheet title="Log finished video" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="quickVideoTitle" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Video name
              </label>
              <input
                id="quickVideoTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                required
                autoFocus
                placeholder="Launch reel, Episode 04…"
                className={fieldClassName}
              />
            </div>
            <div>
              <label htmlFor="quickVideoProject" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Project
              </label>
              <select
                id="quickVideoProject"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  if (event.target.value) setClientId("");
                }}
                disabled={!options || isPending}
                className={fieldClassName}
              >
                <option value="">No project</option>
                {options?.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.clientName}
                  </option>
                ))}
              </select>
            </div>
            {!projectId && (
              <div>
                <label htmlFor="quickVideoClient" className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Client <span className="font-normal text-zinc-600">optional</span>
                </label>
                <select
                  id="quickVideoClient"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  disabled={!options || isPending}
                  className={fieldClassName}
                >
                  <option value="">Standalone / personal</option>
                  {options?.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="quickVideoNotes" className="mb-1.5 block text-xs font-bold text-zinc-400">
                Notes <span className="font-normal text-zinc-600">optional</span>
              </label>
              <input
                id="quickVideoNotes"
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
              disabled={isPending || !title.trim()}
              className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save video"}
            </button>
          </form>
        </ActionSheet>
      )}
    </>
  );
}

export function AddRevisionButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [videoId, setVideoId] = useState("");
  const [feedback, setFeedback] = useState("");

  function handleOpen() {
    setOpen(true);
    setFeedback("");
    startTransition(async () => {
      try {
        const loaded = await getProductivityQuickOptions();
        setOptions(loaded);
        setVideoId(loaded.videos[0]?.id.toString() ?? "");
      } catch {
        setFeedback("Could not load your videos.");
      }
    });
  }

  function change(delta: -1 | 1) {
    if (!videoId) return;
    setFeedback("");
    startTransition(async () => {
      const result = await changeRevisionCount(Number(videoId), delta);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setOptions((current) => current
        ? {
            ...current,
            videos: current.videos.map((video) =>
              video.id === Number(videoId)
                ? { ...video, revisionsCount: result.revisionsCount ?? video.revisionsCount }
                : video,
            ),
          }
        : current,
      );
      setFeedback(result.message ?? "Saved.");
    });
  }

  const selected = options?.videos.find(
    (video) => video.id === Number(videoId),
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-amber-800 px-6 py-5 text-sm font-bold text-white transition-all hover:bg-amber-700 active:scale-95"
      >
        <span className="text-2xl">🔄</span>
        <span>Manage Revision</span>
      </button>

      {open && (
        <ActionSheet title="Manage revision" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {options && options.videos.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm leading-6 text-zinc-400">
                Log a named video first. Revisions always belong to a video now.
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="revisionVideo" className="mb-1.5 block text-xs font-bold text-zinc-400">
                    Which video?
                  </label>
                  <select
                    id="revisionVideo"
                    value={videoId}
                    onChange={(event) => {
                      setVideoId(event.target.value);
                      setFeedback("");
                    }}
                    disabled={!options || isPending}
                    className={fieldClassName}
                  >
                    {options?.videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.title ?? `Video ${video.date}`} — {video.projectName ?? video.clientName ?? "Standalone"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Revisions</p>
                  <p className="mt-2 text-5xl font-black text-white">{selected?.revisionsCount ?? 0}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => change(-1)}
                      disabled={isPending || !selected || selected.revisionsCount === 0}
                      className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 text-sm font-black text-zinc-200 disabled:opacity-40"
                    >
                      − Remove one
                    </button>
                    <button
                      type="button"
                      onClick={() => change(1)}
                      disabled={isPending || !selected}
                      className="min-h-12 rounded-xl bg-amber-700 text-sm font-black text-white disabled:opacity-40"
                    >
                      + Add one
                    </button>
                  </div>
                </div>
              </>
            )}
            {feedback && <p aria-live="polite" className="text-sm text-amber-300">{feedback}</p>}
          </div>
        </ActionSheet>
      )}
    </>
  );
}
