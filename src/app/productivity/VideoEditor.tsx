"use client";

import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import {
  transitionVideoStatus,
  updateVideoMetadata,
} from "@/modules/productivity/actions";
import { validateCoverUrl, validateDeliveryUrl } from "@/modules/productivity/core";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import {
  VIDEO_CONTENT_TYPE_LABELS,
  VIDEO_CONTENT_TYPES,
  VIDEO_KIND_LABELS,
  VIDEO_KINDS,
  VIDEO_ORIENTATION_LABELS,
  VIDEO_ORIENTATIONS,
  VIDEO_STATUS_LABELS,
  getAllowedVideoTransitions,
  type VideoContentType,
  type VideoKind,
  type VideoOrientation,
  type VideoStatus,
} from "@/modules/productivity/config";
import type { VideoWorkSessionState } from "@/modules/work-sessions/core";
import { formatDate } from "@/utils/date";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WorkSessionPanel } from "./WorkSessionPanel";
import { VideoMemoryPanel } from "./VideoMemoryPanel";
import { CommercialTermsPanel } from "./CommercialTermsPanel";
import { ProjectReferencesPanel } from "./ProjectReferencesPanel";
import { CoverUploadField } from "@/components/media/CoverUploadField";
import { OperationalMemoryPanel } from "./OperationalMemoryPanel";
import { RevisionControls } from "./RevisionControls";

type VideoEditorProps = {
  video: {
    id: number;
    date: string;
    title: string | null;
    clientId: number | null;
    clientName: string | null;
    projectId: number | null;
    projectName: string | null;
    projectDeadline: string | null;
    deliveryUrl: string | null;
    reviewUrl: string | null;
    publishedUrl: string | null;
    notes: string | null;
    coverUrl: string | null;
    orientation: VideoOrientation | null;
    contentType: VideoContentType | null;
    videoKind: VideoKind;
    status: VideoStatus;
    revisionsCount: number;
  };
  clients: Array<{ id: number; name: string }>;
  projects: Array<{
    id: number;
    name: string;
    clientId: number;
    clientName: string;
  }>;
  initialWorkSessionState: VideoWorkSessionState;
  initiallyOpen?: boolean;
  // Brief C §8: only ever an already-validated internal path (see
  // isSafeInternalPath in utils/navigation.ts, applied where the query
  // param is first read). Falls back to "/productivity" when absent --
  // this is what keeps the Productivity -> Video -> close regression sane.
  returnTo?: string;
  triggerLabel?: string;
};

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10";

export function VideoEditor({
  video,
  clients,
  projects,
  initialWorkSessionState,
  initiallyOpen = false,
  returnTo,
  triggerLabel,
}: VideoEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(video.title ?? "");
  const [projectId, setProjectId] = useState(
    video.projectId?.toString() ?? "",
  );
  const [clientId, setClientId] = useState(
    video.clientId?.toString() ?? "",
  );
  const [deliveryUrl, setDeliveryUrl] = useState(video.deliveryUrl ?? "");
  const [reviewUrl, setReviewUrl] = useState(video.reviewUrl ?? "");
  const [publishedUrl, setPublishedUrl] = useState(video.publishedUrl ?? "");
  const [notes, setNotes] = useState(video.notes ?? "");
  const [coverUrl, setCoverUrl] = useState(video.coverUrl ?? "");
  const [orientation, setOrientation] = useState(video.orientation ?? "");
  const [contentType, setContentType] = useState(video.contentType ?? "");
  const [videoKind, setVideoKind] = useState<VideoKind>(video.videoKind);
  const [status, setStatus] = useState(video.status);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const displayTitle = video.title ?? `Video ${video.date}`;
  const allowedTransitions = getAllowedVideoTransitions(status);
  const validatedDeliveryUrl = validateDeliveryUrl(video.deliveryUrl);
  const safeDeliveryUrl = validatedDeliveryUrl.success
    ? validatedDeliveryUrl.value
    : null;
  const validatedCoverUrl = validateCoverUrl(video.coverUrl);
  const safeCoverUrl = validatedCoverUrl.success ? validatedCoverUrl.value : null;
  const coverAspectClass =
    video.orientation === "VERTICAL"
      ? "aspect-[9/16] max-h-80"
      : video.orientation === "SQUARE"
        ? "aspect-square max-h-80"
        : "aspect-video";

  function openEditor() {
    // Always rehydrate the draft from the latest server props. The workspace
    // can stay mounted while another server action refreshes the page.
    setTitle(video.title ?? "");
    setProjectId(video.projectId?.toString() ?? "");
    setClientId(video.clientId?.toString() ?? "");
    setDeliveryUrl(video.deliveryUrl ?? "");
    setReviewUrl(video.reviewUrl ?? "");
    setPublishedUrl(video.publishedUrl ?? "");
    setNotes(video.notes ?? "");
    setCoverUrl(video.coverUrl ?? "");
    setOrientation(video.orientation ?? "");
    setContentType(video.contentType ?? "");
    setVideoKind(video.videoKind);
    setStatus(video.status);
    setFeedback("");
    setError("");
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    // Brief C §8: honor an already-validated internal returnTo (e.g. the
    // Project this video was opened from) when present; otherwise keep the
    // exact previous behavior of returning to Productivity.
    if (initiallyOpen) router.replace(returnTo ?? "/productivity", { scroll: false });
  }

  function saveMetadata(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await updateVideoMetadata(video.id, {
        title,
        projectId: projectId ? Number(projectId) : null,
        clientId: projectId ? null : clientId ? Number(clientId) : null,
        deliveryUrl,
        reviewUrl,
        publishedUrl,
        notes,
        coverUrl,
        orientation: (orientation || null) as VideoOrientation | null,
        contentType: (contentType || null) as VideoContentType | null,
        videoKind,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback(result.message ?? "Saved.");
      router.refresh();
    });
  }

  function moveTo(targetStatus: VideoStatus) {
    setError("");
    setFeedback("");
    startTransition(async () => {
      // Monday Real-Operation Pre-Freeze §5: entering READY_FOR_REVIEW
      // (AWAITING_CLIENT_APPROVAL) requires a review URL -- pass the
      // current draft's reviewUrl so "paste the link and mark ready" works
      // as one action even if it hasn't been saved via saveMetadata yet.
      const result = await transitionVideoStatus(video.id, status, targetStatus, reviewUrl || null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.status) setStatus(result.status);
      setFeedback(result.message ?? "Status updated.");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className={
          triggerLabel
            ? "min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500"
            : "max-w-full text-left font-bold text-white underline decoration-zinc-700 underline-offset-4 transition hover:text-violet-300 hover:decoration-violet-400"
        }
        aria-label={`Edit ${displayTitle}`}
      >
        {triggerLabel ?? displayTitle}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          onClick={(event) => event.target === event.currentTarget && closeEditor()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`video-workspace-title-${video.id}`}
            className="safe-sheet max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:rounded-2xl sm:p-6 md:max-w-6xl md:p-7"
          >
            <header className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                  Video #{video.id}
                </p>
                <h2 id={`video-workspace-title-${video.id}`} className="mt-1 truncate text-xl font-black text-white">
                  {displayTitle}
                </h2>
                <nav aria-label="Video relationships" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {video.clientId && (
                    <Link href={`/crm/${video.clientId}`} className="font-bold text-zinc-300 hover:text-cyan-300">
                      {video.clientName ?? "Client"}
                    </Link>
                  )}
                  {video.projectId && video.projectName && (
                    <>
                      <span className="text-zinc-700">→</span>
                      <Link
                        href={`/projects/${video.projectId}`}
                        className="font-bold text-cyan-400 hover:text-cyan-300"
                      >
                        {video.projectName}
                      </Link>
                    </>
                  )}
                </nav>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-300"
                aria-label="Close video details"
              >
                ×
              </button>
            </header>

            <div className="grid gap-5 md:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.35fr)] md:items-start">
              <aside className="space-y-4 md:sticky md:top-0">
                <section className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 ${coverAspectClass}`}>
                  {safeCoverUrl ? (
                    <Image
                      src={safeCoverUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 34vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-700">
                      <span className="text-3xl" aria-hidden="true">🎬</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">No cover yet</span>
                    </div>
                  )}
                  {safeDeliveryUrl && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                      <a
                        href={safeDeliveryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white shadow-lg shadow-black/50 hover:bg-violet-500"
                      >
                        Preview / Watch ↗
                      </a>
                      <CopyLinkButton
                        url={safeDeliveryUrl}
                        label="Copy"
                        className="inline-flex min-h-11 items-center rounded-xl bg-zinc-900/90 px-3 text-xs font-bold text-zinc-300 shadow-lg shadow-black/50 hover:bg-zinc-800"
                      />
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 md:block">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Lifecycle
                      </p>
                      <VideoStatusBadge status={status} />
                    </div>
                    <div className="mt-0 flex flex-wrap justify-end gap-2 md:mt-4 md:justify-start">
                      {allowedTransitions.map((targetStatus) => (
                        <button
                          key={targetStatus}
                          type="button"
                          onClick={() => moveTo(targetStatus)}
                          disabled={isPending}
                          className="min-h-11 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-black text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-40"
                        >
                          → {VIDEO_STATUS_LABELS[targetStatus]}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <WorkSessionPanel
                  key={`${video.id}-${initialWorkSessionState.summary.closedSeconds}-${initialWorkSessionState.summary.sessionCount}-${initialWorkSessionState.openSession?.id ?? "idle"}`}
                  videoId={video.id}
                  initialState={initialWorkSessionState}
                />

                <section className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Revisions</p>
                    <div className="mt-2">
                      <RevisionControls videoId={video.id} initialCount={video.revisionsCount} />
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-600">Manage revisions</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Deadline</p>
                    <p className="mt-1 text-sm font-black text-zinc-300">
                      {video.projectDeadline ? formatDate(video.projectDeadline) : "Not set"}
                    </p>
                  </div>
                </section>

                {video.projectId && (
                  <ProjectReferencesPanel projectId={video.projectId} active={open} />
                )}
              </aside>

              <div className="space-y-4">
                <CommercialTermsPanel videoId={video.id} />
                <VideoMemoryPanel videoId={video.id} />
                <OperationalMemoryPanel videoId={video.id} />
                <form onSubmit={saveMetadata} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/25 p-4 sm:p-5">
                <div className="mb-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Video details</p>
                  <p className="mt-1 text-xs text-zinc-600">Canonical metadata and the client-safe delivery link.</p>
                </div>
              <div>
                <label htmlFor={`video-title-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Video name
                </label>
                <input
                  id={`video-title-${video.id}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={180}
                  required
                  autoFocus={!video.title}
                  placeholder="Launch reel, Episode 04…"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label htmlFor={`video-project-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Project
                </label>
                <select
                  id={`video-project-${video.id}`}
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    if (event.target.value) setClientId("");
                  }}
                  className={fieldClassName}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} — {project.clientName}
                    </option>
                  ))}
                </select>
              </div>

              {!projectId && (
                <div>
                  <label htmlFor={`video-client-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                    Client <span className="font-normal text-zinc-600">optional</span>
                  </label>
                  <select
                    id={`video-client-${video.id}`}
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Standalone / personal</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor={`video-delivery-url-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Delivery / watch URL <span className="font-normal text-zinc-600">optional</span>
                </label>
                <input
                  id={`video-delivery-url-${video.id}`}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={deliveryUrl}
                  onChange={(event) => setDeliveryUrl(event.target.value)}
                  maxLength={2_048}
                  placeholder="https://…"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
                  HTTPS only. This link becomes visible in the client portal.
                </p>
              </div>

              <div>
                <label htmlFor={`video-review-url-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Review URL <span className="font-normal text-zinc-600">required before Ready for review</span>
                </label>
                <input
                  id={`video-review-url-${video.id}`}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={reviewUrl}
                  onChange={(event) => setReviewUrl(event.target.value)}
                  maxLength={2_048}
                  placeholder="https://frame.io/…"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
                  HTTPS only. Today this is usually a Frame.io link — the field itself is provider-independent.
                </p>
              </div>

              <div>
                <label htmlFor={`video-published-url-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Published URL <span className="font-normal text-zinc-600">optional</span>
                </label>
                <input
                  id={`video-published-url-${video.id}`}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={publishedUrl}
                  onChange={(event) => setPublishedUrl(event.target.value)}
                  maxLength={2_048}
                  placeholder="https://…"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
                  HTTPS only. Where the finished content actually lives once published.
                </p>
              </div>

              <div>
                <label htmlFor={`video-cover-url-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Cover <span className="font-normal text-zinc-600">optional</span>
                </label>
                <input
                  id={`video-cover-url-${video.id}`}
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={coverUrl}
                  onChange={(event) => setCoverUrl(event.target.value)}
                  maxLength={2_048}
                  placeholder="Use an HTTPS image URL…"
                  className={fieldClassName}
                />
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
                  Upload an image below, or keep using an external HTTPS URL. Shown on the client portal.
                </p>
                <CoverUploadField
                  targetType="video"
                  targetId={video.id}
                  coverUrl={coverUrl}
                  onCoverUrlChange={setCoverUrl}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`video-orientation-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                    Orientation <span className="font-normal text-zinc-600">optional</span>
                  </label>
                  <select
                    id={`video-orientation-${video.id}`}
                    value={orientation}
                    onChange={(event) => setOrientation(event.target.value as VideoOrientation | "")}
                    className={fieldClassName}
                  >
                    <option value="">Unknown</option>
                    {VIDEO_ORIENTATIONS.map((value) => (
                      <option key={value} value={value}>
                        {VIDEO_ORIENTATION_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`video-content-type-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                    Content type <span className="font-normal text-zinc-600">optional</span>
                  </label>
                  <select
                    id={`video-content-type-${video.id}`}
                    value={contentType}
                    onChange={(event) => setContentType(event.target.value as VideoContentType | "")}
                    className={fieldClassName}
                  >
                    <option value="">Unclassified</option>
                    {VIDEO_CONTENT_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {VIDEO_CONTENT_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={`video-kind-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Classification
                </label>
                <select
                  id={`video-kind-${video.id}`}
                  value={videoKind}
                  onChange={(event) => setVideoKind(event.target.value as VideoKind)}
                  className={fieldClassName}
                >
                  {VIDEO_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {VIDEO_KIND_LABELS[value]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-600">
                  Only Client work counts toward production stats (Productivity, CRM, Projects, War Room). Sample and Internal videos keep their full history but are excluded from those counts.
                </p>
              </div>

              <div>
                <label htmlFor={`video-notes-${video.id}`} className="mb-1.5 block text-xs font-bold text-zinc-400">
                  Notes
                </label>
                <textarea
                  id={`video-notes-${video.id}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2_000}
                  rows={4}
                  placeholder="Version, format, delivery context…"
                  className={`${fieldClassName} py-3`}
                />
              </div>

              {error && <p aria-live="assertive" className="text-sm text-red-300">{error}</p>}
              {feedback && <p aria-live="polite" className="text-sm text-emerald-300">{feedback}</p>}

              <button
                type="submit"
                disabled={isPending || !title.trim()}
                className="min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save video details"}
              </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
