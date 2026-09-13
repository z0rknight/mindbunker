import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/modules/projects/config";

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  planned: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  active: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  review: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`pixel-badge inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
