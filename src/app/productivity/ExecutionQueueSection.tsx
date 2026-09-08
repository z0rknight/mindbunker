"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import { startWorkSession } from "@/modules/work-sessions/actions";
import { DEFAULT_WORK_SESSION_ACTIVITY } from "@/modules/work-sessions/core";
import { reorderExecutionQueueItem } from "@/modules/productivity/actions";
import type { QueueEntry, QueueEligibleVideo, QueueMoveDirection } from "@/modules/productivity/queue";
import { formatDate } from "@/utils/date";

// P0.4: "restaurant tickets" execution queue. One row per canonical
// video_logs item -- no duplicated task records, no separate model. The
// server already resolved isBlocked/isAwaitingReview/isExecutable via
// modules/productivity/queue.ts; this component only renders that and
// wires the three reliable fallback reorder controls (Move up/down/top --
// no drag-and-drop library, per the Tuesday Patch instruction to prefer
// reliability over gesture polish here).
export type QueueRow = QueueEntry<QueueEligibleVideo>;

function formatCommitmentDue(value: Date | string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ExecutionQueueSection({
  queue,
  activeVideoId,
}: {
  queue: QueueRow[];
  activeVideoId: number | null;
}) {
  const firstExecutableId = queue.find((item) => item.isExecutable)?.id ?? null;

  return (
    <section aria-labelledby="execution-queue" className="mb-7">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">In order</p>
        <h2 id="execution-queue" className="mt-1 text-lg font-black text-white sm:text-xl">
          Execution Queue <span className="font-mono text-sm text-zinc-600">{queue.length}</span>
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
          The real order you intend to work through client production. Reorder freely — this never changes deadlines or status.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/35 px-4 py-6 text-sm text-zinc-600">
          No client-work videos waiting in the active queue.
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((item, index) => (
            <QueueRowView
              key={item.id}
              item={item}
              isFirstExecutable={item.id === firstExecutableId}
              isActive={item.id === activeVideoId}
              isFirst={index === 0}
              isLast={index === queue.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QueueRowView({
  item,
  isFirstExecutable,
  isActive,
  isFirst,
  isLast,
}: {
  item: QueueRow;
  isFirstExecutable: boolean;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const title = item.title ?? `Video ${formatDate(item.date)}`;
  const commitmentDue = formatCommitmentDue(item.soonestCommitmentDueAt);

  function move(direction: QueueMoveDirection) {
    startTransition(async () => {
      await reorderExecutionQueueItem(item.id, direction);
      router.refresh();
    });
  }

  function start() {
    startTransition(async () => {
      const result = await startWorkSession(item.id, DEFAULT_WORK_SESSION_ACTIVITY);
      if (result.success) router.push(`/productivity?video=${item.id}`);
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
        isFirstExecutable
          ? "border-emerald-500/40 bg-emerald-500/[0.06]"
          : item.isBlocked
            ? "border-red-900/40 bg-red-950/10"
            : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isFirstExecutable && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
              Next
            </span>
          )}
          <VideoStatusBadge status={item.status} />
          {item.isBlocked && (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300">
              Blocked{item.blockerCategory ? ` · ${item.blockerCategory}` : ""}
            </span>
          )}
          {item.isAwaitingReview && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-300">
              Awaiting review
            </span>
          )}
          {isActive && (
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-300">
              Active now
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {[item.clientName, item.projectName].filter(Boolean).join(" / ") || "Standalone"}
          {commitmentDue && <> · Due {commitmentDue}</>}
          {!commitmentDue && item.projectDeadline && <> · Project due {formatDate(item.projectDeadline)}</>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={`Reorder ${title}`}>
          <button
            type="button"
            disabled={isPending || isFirst}
            onClick={() => move("top")}
            title="Move to top"
            aria-label="Move to top"
            className="min-h-9 min-w-9 rounded-lg border border-zinc-700 bg-zinc-950/60 text-xs font-black text-zinc-300 hover:border-violet-500/60 disabled:opacity-30"
          >
            ⤒
          </button>
          <button
            type="button"
            disabled={isPending || isFirst}
            onClick={() => move("up")}
            title="Move up"
            aria-label="Move up"
            className="min-h-9 min-w-9 rounded-lg border border-zinc-700 bg-zinc-950/60 text-xs font-black text-zinc-300 hover:border-violet-500/60 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isPending || isLast}
            onClick={() => move("down")}
            title="Move down"
            aria-label="Move down"
            className="min-h-9 min-w-9 rounded-lg border border-zinc-700 bg-zinc-950/60 text-xs font-black text-zinc-300 hover:border-violet-500/60 disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        {item.isExecutable && !isActive ? (
          <button
            type="button"
            disabled={isPending}
            onClick={start}
            className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Start
          </button>
        ) : (
          <Link
            href={`/productivity?video=${item.id}`}
            className="min-h-9 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs font-black text-zinc-200 hover:border-violet-500/60"
          >
            Open workspace
          </Link>
        )}
      </div>
    </div>
  );
}
