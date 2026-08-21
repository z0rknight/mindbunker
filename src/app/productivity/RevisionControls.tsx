"use client";

import { changeRevisionCount } from "@/modules/productivity/actions";
import { useState, useTransition } from "react";

export function RevisionControls({
  videoId,
  initialCount,
}: {
  videoId: number;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function change(delta: -1 | 1) {
    setError("");
    startTransition(async () => {
      const result = await changeRevisionCount(videoId, delta);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (typeof result.revisionsCount === "number") {
        setCount(result.revisionsCount);
      }
    });
  }

  return (
    <div>
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
        <button
          type="button"
          onClick={() => change(-1)}
          disabled={isPending || count === 0}
          aria-label="Remove one revision"
          className="flex min-h-11 min-w-11 items-center justify-center text-lg font-black text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-10 px-2 text-center font-mono text-sm font-black text-amber-300">
          {count}
        </span>
        <button
          type="button"
          onClick={() => change(1)}
          disabled={isPending}
          aria-label="Add one revision"
          className="flex min-h-11 min-w-11 items-center justify-center text-lg font-black text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          +
        </button>
      </div>
      {error && <p className="mt-1 max-w-40 text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
