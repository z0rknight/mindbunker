"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setVideoPriorityAsClient } from "@/modules/productivity/actions";

export function PriorityToggle({
  videoId,
  isPriority,
  projectVideoCount,
}: {
  videoId: number;
  isPriority: boolean;
  // Quick Morning Reality Patch (26 Aug 2026) §4: null when the video has
  // no project (no toggle makes sense without one -- see the callers,
  // which only render PriorityToggle when projectId is set). <= 1 means
  // this is the only video in its project: there is nothing else to
  // prioritize against, so an actionable "mark as priority" toggle would
  // imply a choice that doesn't exist. Show an honest static state
  // instead of a false choice.
  projectVideoCount: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const isOnlyVideoInProject = projectVideoCount !== null && projectVideoCount <= 1;

  function toggle() {
    setError("");
    startTransition(async () => {
      const result = await setVideoPriorityAsClient(videoId, !isPriority);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (isOnlyVideoInProject) {
    return (
      <div
        className="mt-1 flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 text-center text-xs font-black text-amber-200"
        title="This is the only active video in its project, so it's the current priority by default."
      >
        ⭐ Only active video — current priority
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={isPriority}
        className={`min-h-9 w-full rounded-xl border px-3 text-xs font-black transition disabled:opacity-50 ${
          isPriority
            ? "border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            : "border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        {isPriority ? "⭐ Priority now — tap to clear" : "☆ Mark as priority now"}
      </button>
      {error && <p role="alert" className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
