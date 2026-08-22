import {
  VIDEO_STATUS_LABELS,
  type VideoStatus,
} from "@/modules/productivity/config";

const STATUS_CLASSES: Record<VideoStatus, string> = {
  PLANNED: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  IN_PROGRESS: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  READY_FOR_REVIEW:
    "border-violet-500/30 bg-violet-500/10 text-violet-300",
  CHANGES_REQUESTED:
    "border-amber-500/30 bg-amber-500/10 text-amber-300",
  DONE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {VIDEO_STATUS_LABELS[status]}
    </span>
  );
}
