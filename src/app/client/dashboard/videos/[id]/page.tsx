import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientAuth } from "@/lib/client-portal-session";
import { getClientVideoDetailView } from "@/modules/client-portal/data";
import { CoverImage } from "../../CoverImage";
import { ReviewActions } from "../../ReviewActions";
import { PriorityToggle } from "../../PriorityToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Video | RMEDIA",
  robots: { index: false, follow: false },
};

const STATUS_CLASSES: Record<string, string> = {
  PLANNED: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  IN_PROGRESS: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  READY_FOR_REVIEW: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  CHANGES_REQUESTED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  DONE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const ASPECT_CLASSES: Record<string, string> = {
  LANDSCAPE: "aspect-video",
  VERTICAL: "aspect-[9/16] max-h-96",
  SQUARE: "aspect-square",
  UNKNOWN: "aspect-video",
};

function primaryLink(video: {
  status: string;
  reviewUrl: string | null;
  publishedUrl: string | null;
  deliveryUrl: string | null;
}): { href: string; label: string } | null {
  if (video.status === "READY_FOR_REVIEW" && video.reviewUrl) {
    return { href: video.reviewUrl, label: "Review video" };
  }
  if (video.publishedUrl) {
    return { href: video.publishedUrl, label: "View published" };
  }
  if (video.deliveryUrl) {
    return { href: video.deliveryUrl, label: "Watch" };
  }
  return null;
}

export default async function ClientVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const videoId = Number(id);
  const clientId = await requireClientAuth("/client/login");

  if (!Number.isSafeInteger(videoId) || videoId <= 0) {
    notFound();
  }

  const view = await getClientVideoDetailView(clientId, videoId);
  if (view.status === "unavailable") {
    notFound();
  }

  const { video } = view;
  const aspectKey = video.orientation ?? "UNKNOWN";
  const link = primaryLink(video);

  return (
    <main className="min-h-dvh bg-zinc-950 pb-16 text-white">
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/client/dashboard"
            className="flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-zinc-400 hover:text-white"
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <div className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 ${ASPECT_CLASSES[aspectKey]}`}>
          {video.coverUrl ? (
            <CoverImage src={video.coverUrl} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-700">
              <span className="text-3xl" aria-hidden="true">🎬</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">No preview yet</span>
            </div>
          )}
          <span
            className={`absolute left-3 top-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur ${STATUS_CLASSES[video.status] ?? STATUS_CLASSES.PLANNED}`}
          >
            {video.statusLabel}
          </span>
          {video.isPriority && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 backdrop-blur">
              ⭐ Priority
            </span>
          )}
        </div>

        <div>
          <h1 className="text-xl font-black text-white">{video.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            {video.projectName && <span className="font-semibold text-zinc-400">{video.projectName}</span>}
            {video.contentTypeLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span>{video.contentTypeLabel}</span>
              </>
            )}
          </p>
          {video.batchLabel && (
            <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-violet-300">
              Batch · {video.batchLabel}
            </p>
          )}
        </div>

        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500"
          >
            {link.label}
          </a>
        )}

        {video.canReview && video.status === "READY_FOR_REVIEW" && <ReviewActions videoId={video.id} />}
        {video.canSetPriority && video.projectId !== null && (
          <PriorityToggle
            videoId={video.id}
            isPriority={video.isPriority}
            projectVideoCount={video.projectVideoCount}
          />
        )}

        {video.quote && (
          <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Approved quote</p>
            <p className="mt-1.5 text-2xl font-black text-white">{video.quote.amount}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span>{video.quote.turnaround} turnaround</span>
              <span>
                {video.quote.revisionsIncluded} revision{video.quote.revisionsIncluded === 1 ? "" : "s"} included
              </span>
            </div>
            {video.quote.scope.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">What I&apos;ll do</p>
                <ul className="mt-1.5 space-y-1 text-sm text-zinc-300">
                  {video.quote.scope.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-emerald-400" aria-hidden="true">•</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
