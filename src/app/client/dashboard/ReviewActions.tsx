"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transitionVideoStatusAsClient } from "@/modules/productivity/actions";

export function ReviewActions({ videoId }: { videoId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<"approved" | "changes" | null>(null);

  function act(target: "DONE" | "CHANGES_REQUESTED") {
    setError("");
    startTransition(async () => {
      const result = await transitionVideoStatusAsClient(videoId, target);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(target === "DONE" ? "approved" : "changes");
      router.refresh();
    });
  }

  if (done) {
    return (
      <p className="mt-1 rounded-xl border border-emerald-900/70 bg-emerald-950/30 px-3 py-2.5 text-center text-xs font-bold text-emerald-200">
        {done === "approved" ? "Approved — thank you!" : "Changes requested."}
      </p>
    );
  }

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("DONE")}
          disabled={isPending}
          className="min-h-10 flex-1 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => act("CHANGES_REQUESTED")}
          disabled={isPending}
          className="min-h-10 flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-black text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          Request changes
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
