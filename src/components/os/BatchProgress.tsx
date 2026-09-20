import type { VideoStatus } from "@/modules/productivity/config";
import { summarizeBatchProgress } from "@/modules/client-portal/batch-progress";

/**
 * Shared batch composition rail (client "In production now" section since M2;
 * operator Production Order deliverables since M3 -- one semantic language, no
 * duplicated logic). Server-rendered
 * from the same canonical items the section already lists: after a child video
 * changes and the page revalidates, the matching segment (stable key = video
 * id) transitions from its previous look. The text carries the meaning; the
 * rail is decorative (`aria-hidden`). READY_FOR_REVIEW is never drawn as done.
 */
export function BatchProgress({ items }: { items: ReadonlyArray<{ id: number; status: VideoStatus }> }) {
  const progress = summarizeBatchProgress(items);
  if (progress.total < 2) return null;
  return (
    <div className="mt-4">
      <div className="os-segbar" aria-hidden="true">
        {progress.segments.map((segment) => (
          <span key={segment.id} className="os-seg" data-status={segment.status} />
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-zinc-400" data-batch-progress>
        {progress.summary}
      </p>
    </div>
  );
}
