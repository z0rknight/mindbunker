"use client";

import { useState } from "react";
import Link from "next/link";
import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import { formatDate } from "@/utils/date";
import { BulkEditVideosButton } from "./BulkEditVideosButton";
import type { VideoStatus } from "@/modules/productivity/config";

type WorkspaceVideo = {
  id: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  revisionsCount: number;
  batchLabel: string | null;
};

// Brief C ("Final Local Ingest / Live Readiness") §7/§8/§9: the video list
// itself needed to become a selection surface (checkboxes + "Edit
// selected") without turning into a spreadsheet app -- a modal for
// selected rows (BulkEditVideosButton) is sufficient per the brief. Also
// carries the returnTo context on every video link so closing that video
// from here comes back to this Project (§8), and displays the batch label
// set at bulk-create time (§6) since ordering (§9) already groups by it
// server-side in getProjectWorkspace.
export function ProjectVideoList({
  projectId,
  videos,
}: {
  projectId: number;
  videos: WorkspaceVideo[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const returnTo = encodeURIComponent(`/projects/${projectId}`);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === videos.length ? new Set() : new Set(videos.map((v) => v.id)),
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
        <p className="font-black text-white">No videos planned yet</p>
        <p className="mt-1 text-sm text-zinc-500">Plan the first production unit inside this Project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-400">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === videos.length}
            onChange={toggleAll}
            className="h-4 w-4"
          />
          Select all
        </label>
        <BulkEditVideosButton
          projectId={projectId}
          selectedIds={Array.from(selected)}
          onDone={() => setSelected(new Set())}
        />
      </div>

      {videos.map((video) => (
        <div
          key={video.id}
          className="flex min-h-20 flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-violet-500/35 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(video.id)}
              onChange={() => toggle(video.id)}
              className="h-4 w-4 shrink-0"
              aria-label={`Select ${video.title ?? "video"}`}
            />
            <Link href={`/productivity?video=${video.id}&returnTo=${returnTo}`} className="min-w-0 flex-1">
              <p className="truncate font-black text-white">{video.title ?? `Video ${formatDate(video.date)}`}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
                <span>{formatDate(video.date)} · {video.revisionsCount} revision{video.revisionsCount === 1 ? "" : "s"}</span>
                {video.batchLabel && (
                  <span className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-fuchsia-300">
                    {video.batchLabel}
                  </span>
                )}
              </div>
            </Link>
          </div>
          <Link href={`/productivity?video=${video.id}&returnTo=${returnTo}`} className="flex shrink-0 items-center gap-3">
            <VideoStatusBadge status={video.status} />
            <span className="text-sm font-black text-violet-300">Open video →</span>
          </Link>
        </div>
      ))}
    </div>
  );
}
