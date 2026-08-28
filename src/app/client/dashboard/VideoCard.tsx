import Link from "next/link";
import type { VideoStatus } from "@/modules/productivity/config";
import { CoverImage } from "./CoverImage";
import { ReviewActions } from "./ReviewActions";
import { PriorityToggle } from "./PriorityToggle";

type CardData = {
  id: number;
  title: string;
  status: VideoStatus;
  statusLabel: string;
  projectId: number | null;
  projectName: string | null;
  contentTypeLabel: string | null;
  orientation: "LANDSCAPE" | "VERTICAL" | "SQUARE" | null;
  coverUrl: string | null;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  lastUpdated: string | null;
  isPriority: boolean;
  projectVideoCount: number | null;
};

// Monday Real-Operation Pre-Freeze §6: READY FOR REVIEW -> reviewUrl,
// PUBLISHED -> publishedUrl, otherwise (delivered) -> deliveryUrl.
// Provider-independent everywhere -- this just picks the right FACT for
// the video's current state, never a provider name.
function primaryLink(video: CardData): { href: string; label: string } | null {
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

const STATUS_CLASSES: Record<VideoStatus, string> = {
  PLANNED: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  IN_PROGRESS: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  READY_FOR_REVIEW: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  CHANGES_REQUESTED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  DONE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

// Predictable, orientation-aware containers -- a 9:16 asset gets a portrait
// frame capped in height, a 16:9 asset gets the usual landscape frame,
// unknown orientation falls back to landscape rather than guessing. This is
// what stops a vertical short from stretching a mobile card to 900px tall.
const ASPECT_CLASSES: Record<"LANDSCAPE" | "VERTICAL" | "SQUARE" | "UNKNOWN", string> = {
  LANDSCAPE: "aspect-video",
  VERTICAL: "aspect-[9/16] max-h-72 sm:max-h-80",
  SQUARE: "aspect-square",
  UNKNOWN: "aspect-video",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function VideoCard({
  video,
  dateLabel,
  showReviewActions = false,
}: {
  video: CardData;
  dateLabel?: string;
  showReviewActions?: boolean;
}) {
  const aspectKey = video.orientation ?? "UNKNOWN";
  const formattedDate = formatDate(video.lastUpdated);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
      <Link
        href={`/client/dashboard/videos/${video.id}`}
        className={`relative block w-full overflow-hidden bg-zinc-900 ${ASPECT_CLASSES[aspectKey]}`}
      >
        {video.coverUrl ? (
          <CoverImage src={video.coverUrl} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-700">
            <span className="text-2xl" aria-hidden="true">🎬</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">No preview yet</span>
          </div>
        )}
        <span
          className={`absolute left-2.5 top-2.5 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur ${STATUS_CLASSES[video.status]}`}
        >
          {video.statusLabel}
        </span>
        {video.isPriority && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 backdrop-blur">
            ⭐ Priority
          </span>
        )}
      </Link>

      <div className="space-y-2 p-3.5">
        <h3 className="truncate text-sm font-bold text-white" title={video.title}>
          <Link href={`/client/dashboard/videos/${video.id}`} className="hover:text-violet-300">
            {video.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
          {video.projectName && <span className="font-semibold text-zinc-400">{video.projectName}</span>}
          {video.contentTypeLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.contentTypeLabel}</span>
            </>
          )}
          {formattedDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>{dateLabel ?? "Updated"} {formattedDate}</span>
            </>
          )}
        </div>

        {primaryLink(video) && (
          <a
            href={primaryLink(video)!.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-violet-600 px-3 text-xs font-black text-white transition hover:bg-violet-500"
          >
            {primaryLink(video)!.label}
          </a>
        )}

        {showReviewActions && <ReviewActions videoId={video.id} />}
        {video.projectId !== null && (
          <PriorityToggle
            videoId={video.id}
            isPriority={video.isPriority}
            projectVideoCount={video.projectVideoCount}
          />
        )}
      </div>
    </article>
  );
}
