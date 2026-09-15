"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewVideoLogsBulkDeletion,
  deleteVideoLogsBulk,
  type BulkVideoDeletionPreflight,
} from "@/modules/productivity/actions";

type Stage =
  | { step: "closed" }
  | { step: "loading" }
  | { step: "preflight"; preflight: BulkVideoDeletionPreflight }
  | { step: "done"; deletedCount: number; protectedCount: number };

// Tuesday Reality Patch: bulk delete reuses the exact same canonical
// deletion decision the single-video Delete button already uses (via
// previewVideoLogsBulkDeletion/deleteVideoLogsBulk in productivity/actions.ts,
// both built on resolveVideoDeletionOutcome) -- there is only one
// definition of "deletable" in this app. Flow: select → Delete selected
// → preflight (CAN DELETE / PROTECTED, with reasons) → one deliberate
// confirmation → delete only the eligible items → report what was
// protected. No title-typing confirmation.
export function BulkDeleteVideosButton({
  selectedIds,
  onDone,
}: {
  selectedIds: number[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "closed" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function openPreflight() {
    setError("");
    setStage({ step: "loading" });
    startTransition(async () => {
      const result = await previewVideoLogsBulkDeletion(selectedIds);
      if (!result.success) {
        setError(result.error);
        setStage({ step: "closed" });
        return;
      }
      setStage({ step: "preflight", preflight: result.result });
    });
  }

  function confirmDelete() {
    if (stage.step !== "preflight") return;
    const eligibleIds = stage.preflight.eligible.map((v) => v.id);
    if (eligibleIds.length === 0) return;
    setError("");
    startTransition(async () => {
      const result = await deleteVideoLogsBulk(eligibleIds);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStage({
        step: "done",
        deletedCount: result.result.deletedCount,
        protectedCount: result.result.protectedItems.length,
      });
      onDone();
      router.refresh();
    });
  }

  function close() {
    if (isPending) return;
    setStage({ step: "closed" });
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreflight}
        disabled={selectedIds.length === 0 || isPending}
        className="rounded-xl border border-red-800/60 bg-red-950/30 hover:bg-red-900/40 px-4 py-2.5 text-sm font-black text-red-300 transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        Delete selected ({selectedIds.length})
      </button>

      {stage.step !== "closed" && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Delete selected videos</h2>
              <button type="button" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none" aria-label="Close">×</button>
            </div>

            {stage.step === "loading" && <p className="mt-4 text-sm text-zinc-400">Checking history for {selectedIds.length} video{selectedIds.length === 1 ? "" : "s"}…</p>}

            {stage.step === "preflight" && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-1.5 text-sm font-black text-emerald-300">
                    {stage.preflight.eligible.length} CAN DELETE
                  </span>
                  {stage.preflight.protectedItems.length > 0 && (
                    <span className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-sm font-black text-amber-300">
                      {stage.preflight.protectedItems.length} PROTECTED
                    </span>
                  )}
                </div>

                {stage.preflight.protectedItems.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-1.5">
                    {stage.preflight.protectedItems.map((item) => (
                      <p key={item.id} className="text-xs text-zinc-400">
                        <span className="font-bold text-zinc-200">{item.title}</span> — {item.reason}
                      </p>
                    ))}
                  </div>
                )}

                {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}

                {stage.preflight.eligible.length > 0 ? (
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={isPending}
                    className="mt-4 w-full rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
                  >
                    {isPending ? "Deleting…" : `Delete ${stage.preflight.eligible.length} eligible video${stage.preflight.eligible.length === 1 ? "" : "s"}`}
                  </button>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">Every selected video is protected — nothing to delete.</p>
                )}
              </>
            )}

            {stage.step === "done" && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-bold text-emerald-300">
                  {stage.deletedCount} video{stage.deletedCount === 1 ? "" : "s"} deleted.
                </p>
                {stage.protectedCount > 0 && (
                  <p className="text-sm text-amber-300">{stage.protectedCount} protected video{stage.protectedCount === 1 ? "" : "s"} preserved.</p>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
