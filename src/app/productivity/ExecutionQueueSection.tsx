"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PixelEmptyState, PixelIcon } from "@/components/ui/PixelVisuals";
import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import { resolveCoverUrl } from "@/modules/media/core";
import { reorderExecutionQueueItem } from "@/modules/productivity/actions";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import { stageForQueueItem, type QueueEntry, type QueueEligibleVideo, type QueueMoveDirection } from "@/modules/productivity/queue";
import { startWorkSession } from "@/modules/work-sessions/actions";
import { DEFAULT_WORK_SESSION_ACTIVITY } from "@/modules/work-sessions/core";
import { formatDate } from "@/utils/date";

export type QueueRow = QueueEntry<QueueEligibleVideo>;

const STAGES = [
  { key: "PLANNED", label: "Queued", hint: "Ready to enter production", tone: "border-zinc-700/80 bg-zinc-950/65" },
  { key: "MAKING", label: "In production", hint: "Editing or requested changes", tone: "border-cyan-800/50 bg-cyan-950/10" },
  { key: "REVIEW", label: "Review", hint: "Waiting for a decision", tone: "border-violet-800/50 bg-violet-950/10" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function stageFor(item: QueueRow): StageKey {
  return stageForQueueItem(item.status);
}

function formatCommitmentDue(value: Date | string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ExecutionQueueSection({ queue, activeVideoId }: { queue: QueueRow[]; activeVideoId: number | null }) {
  const firstExecutableId = queue.find((item) => item.isExecutable)?.id ?? null;

  return (
    <section aria-labelledby="execution-queue" className="mb-7">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Production flow</p>
          <h2 id="execution-queue" className="mt-1 text-lg font-black text-white sm:text-xl">
            Video Queue <span className="font-mono text-sm text-zinc-600">{queue.length}</span>
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
            Each tile is one canonical video. Status moves left to right; queue controls only change execution order.
          </p>
        </div>
        <Link href="/productivity/orders" className="text-xs font-black text-emerald-400 hover:text-emerald-300">Open batches →</Link>
      </div>

      {queue.length === 0 ? (
        <PixelEmptyState icon="stack" title="Queue clear" className="rounded-2xl">
          No client-work videos waiting in the active queue.
        </PixelEmptyState>
      ) : (
        // QA fix (2026-09-14): stages used to be three side-by-side grid
        // columns of equal height (grid-cols-3, each stage a single-file
        // vertical stack). With 33 Queued / 7 In production / 1 Review --
        // the real shape of this queue -- that stretched every column to
        // the tallest one, leaving Review's column empty below its one
        // card and reading as a broken grid rather than an intentional
        // board (exactly Emmanuel's report). Each stage is now its own
        // full-width section, stacked top to bottom, with its OWN
        // responsive card grid inside (1 col phone / 2 tablet / 3
        // desktop) -- a short stage is simply a short section, not an
        // empty column next to a tall one. This also shortens the tallest
        // stage from N rows to ceil(N/3) rows.
        <div className="space-y-6" data-testid="horizontal-video-pipeline">
          {STAGES.map((stage) => {
            const items = queue.filter((item) => stageFor(item) === stage.key);
            return (
              <section key={stage.key} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${stage.tone}`}>
                <header className="mb-3 flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">{stage.label}</h3>
                    <p className="mt-0.5 text-[10px] text-zinc-600">{stage.hint}</p>
                  </div>
                  <span className="rounded border border-zinc-700 bg-black/40 px-2 py-0.5 font-mono text-xs text-zinc-400">{items.length}</span>
                </header>
                {items.length === 0 ? (
                  <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-zinc-800/80 px-3 text-center text-[11px] text-zinc-700">No videos here</div>
                ) : (
                  // Sep 16 Operational Reality Patch: the fixed sm/lg/xl
                  // step (1/2/3/4) never added a column past xl -- on a
                  // real 4K/fullscreen monitor a batch's video tiles stayed
                  // capped at the same count as a laptop screen (reported
                  // directly: "não importa o tamanho da tela sempre ficam 3
                  // videos por fileira"). auto-fill/minmax fills whatever
                  // width is actually available instead of a hardcoded
                  // per-breakpoint column count.
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {items.map((item) => (
                      <QueueTile
                        key={item.id}
                        item={item}
                        isFirstExecutable={item.id === firstExecutableId}
                        isActive={item.id === activeVideoId}
                        isFirst={queue[0]?.id === item.id}
                        isLast={queue.at(-1)?.id === item.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function QueueTile({ item, isFirstExecutable, isActive, isFirst, isLast }: { item: QueueRow; isFirstExecutable: boolean; isActive: boolean; isFirst: boolean; isLast: boolean }) {
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
      if (result.success) router.push(videoWorkspaceHref(item.id));
    });
  }

  // Sep 16 Operational Reality Patch: same tier order as Projects
  // (resolveCoverUrl in modules/media/core.ts) -- video's own cover, then
  // its project's, then the client's chosen default, then the client's
  // avatar. Operator-reported: without this, every queued/planned video
  // rendered as an indistinguishable gray tile ("parece tudo um monte de
  // coisa cinza, acabo nem usando o painel no dia a dia").
  const resolvedCoverUrl = resolveCoverUrl(
    item.coverUrl,
    item.projectCoverUrl,
    item.clientDefaultCoverUrl,
    item.clientAvatarUrl,
  );
  const coverStyle = resolvedCoverUrl
    ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.08)), url("${resolvedCoverUrl.replaceAll('"', "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;
  const subtitle = [item.clientName, item.projectName].filter(Boolean).join(" / ") || "Standalone";

  return (
    <article data-stage={stageFor(item)} className={`mb-stage-enter pixel-frame overflow-hidden rounded-xl border bg-zinc-950/85 transition-colors ${isFirstExecutable ? "mb-next-marker border-emerald-500/45" : item.isBlocked ? "border-red-900/55" : "border-zinc-800"}`}>
      <div className="relative aspect-video overflow-hidden border-b border-zinc-800 bg-gradient-to-br from-cyan-950 via-zinc-900 to-violet-950" style={coverStyle}>
        {/* Bottom padding reserves the exact strip the absolutely-positioned
            status badge below renders into -- without it, a long client/
            project name here collides with that badge instead of stacking
            above it. */}
        {!resolvedCoverUrl && (
          <div className="absolute inset-0 flex flex-col justify-between p-3 pb-8" aria-hidden="true">
            <PixelIcon name="video" className="h-5 w-5 text-cyan-400/60" />
            <p className="line-clamp-2 text-xs font-bold leading-tight text-white/80">{subtitle}</p>
          </div>
        )}
        <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
          <VideoStatusBadge status={item.status} />
          {isActive && <span className="mb-live-pulse" aria-label="Active now" />}
        </div>
        {isFirstExecutable && <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-emerald-500/45 bg-black/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300"><PixelIcon name="flag" className="h-3 w-3" /> Next</span>}
      </div>

      <div className="p-3">
        <p className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-white">{title}</p>
        <p className="mt-1 truncate text-[11px] text-zinc-500">{subtitle}</p>
        <div className="mt-2 flex min-h-5 flex-wrap gap-1">
          {item.isBlocked && <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-300">Blocked{item.blockerCategory ? ` · ${item.blockerCategory}` : ""}</span>}
          {commitmentDue && <span className="text-[10px] font-bold text-amber-300">Due {commitmentDue}</span>}
          {!commitmentDue && item.projectDeadline && <span className="text-[10px] text-zinc-600">Project due {formatDate(item.projectDeadline)}</span>}
        </div>

        {/* Global Health Audit — Productivity density: "Move to top" and a
            per-tile ⌘K button were removed here. Up/Down cover ordinary
            reordering; jumping far is rare enough to not need a dedicated
            button on every one of ~40+ tiles, and ⌘K is already globally
            available (see the page header's own "Press ⌘K anywhere" copy)
            -- this was the exact same action exposed a second time on
            every card. No capability is lost, only the duplicate control. */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-2">
          <div className="flex items-center gap-1" role="group" aria-label={`Reorder ${title}`}>
            <button type="button" disabled={isPending || isFirst} onClick={() => move("up")} title="Move up" aria-label="Move up" className="min-h-9 min-w-9 rounded border border-zinc-800 text-xs text-zinc-400 disabled:opacity-25">↑</button>
            <button type="button" disabled={isPending || isLast} onClick={() => move("down")} title="Move down" aria-label="Move down" className="min-h-9 min-w-9 rounded border border-zinc-800 text-xs text-zinc-400 disabled:opacity-25">↓</button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href={videoWorkspaceHref(item.id)} className="flex min-h-10 items-center justify-center rounded-lg border border-zinc-700 px-2 text-center text-[11px] font-black text-zinc-200 hover:border-violet-500/60">Workspace</Link>
          {item.isExecutable && !isActive ? (
            <button type="button" disabled={isPending} onClick={start} className="min-h-10 rounded-lg bg-emerald-600 px-2 text-[11px] font-black text-white hover:bg-emerald-500 disabled:opacity-50">Start work</button>
          ) : (
            <span className="flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-2 text-center text-[10px] font-bold text-zinc-500">{isActive ? "Active now" : "Awaiting review"}</span>
          )}
        </div>
      </div>
    </article>
  );
}
