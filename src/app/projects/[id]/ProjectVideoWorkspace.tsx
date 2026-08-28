"use client";

import { useState } from "react";
import { ProjectVideoCards, type WorkspaceVideoCardData } from "./ProjectVideoCards";
import { ProjectVideoList } from "./ProjectVideoList";

// Quick Morning Reality Patch §7: Cards is the default operating view
// (production-ticket style); List is kept exactly as-is underneath as the
// dense bulk-edit mode -- nothing about BulkEditVideosButton or the
// existing List UI changes, this only decides which one is on screen.
export function ProjectVideoWorkspace({
  projectId,
  videos,
  projectCoverUrl = null,
  clientAvatarUrl = null,
  clientName = "",
}: {
  projectId: number;
  videos: WorkspaceVideoCardData[];
  projectCoverUrl?: string | null;
  clientAvatarUrl?: string | null;
  clientName?: string;
}) {
  const [mode, setMode] = useState<"cards" | "list">("cards");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/60 p-1 text-xs font-black">
          <button
            type="button"
            onClick={() => setMode("cards")}
            aria-pressed={mode === "cards"}
            className={`rounded-lg px-3 py-1.5 transition ${
              mode === "cards" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setMode("list")}
            aria-pressed={mode === "list"}
            className={`rounded-lg px-3 py-1.5 transition ${
              mode === "list" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {mode === "cards" ? (
        <ProjectVideoCards
          projectId={projectId}
          videos={videos}
          projectCoverUrl={projectCoverUrl}
          clientAvatarUrl={clientAvatarUrl}
          clientName={clientName}
        />
      ) : (
        <ProjectVideoList
          projectId={projectId}
          videos={videos}
          projectCoverUrl={projectCoverUrl}
          clientAvatarUrl={clientAvatarUrl}
          clientName={clientName}
        />
      )}
    </div>
  );
}
