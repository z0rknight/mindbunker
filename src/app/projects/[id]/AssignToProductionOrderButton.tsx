"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { attachExistingVideosToProductionOrder } from "@/modules/production-orders/actions";
import type { ExistingProductionOrderOption } from "@/modules/production-orders/data";

// Sep 18 Morning Congruence Patch: reuses the exact same selection state
// ProjectVideoList already built for BulkEditVideosButton -- "already have
// these deliverables, they're today's working batch" only needed a second
// small action on that same selection, not a new multi-select surface.
// Only this project's own OPEN orders are offered (see
// getOpenProductionOrdersForProject) -- attaching never crosses a client
// or project boundary.
export function AssignToProductionOrderButton({
  projectId,
  selectedIds,
  openProductionOrders,
  onDone,
}: {
  projectId: number;
  selectedIds: number[];
  openProductionOrders: ExistingProductionOrderOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>(openProductionOrders[0]?.id.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function openModal() {
    setOrderId(openProductionOrders[0]?.id.toString() ?? "");
    setError("");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) {
      setError("Choose which batch these videos belong to.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await attachExistingVideosToProductionOrder(Number(orderId), selectedIds);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDone();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={selectedIds.length === 0}
        className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 hover:bg-emerald-900/40 px-4 py-2.5 text-sm font-black text-emerald-300 transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        Add to batch ({selectedIds.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Add to an existing batch</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none" aria-label="Close">×</button>
            </div>
            <p className="mb-4 text-xs font-bold text-amber-300">
              {selectedIds.length} video{selectedIds.length === 1 ? "" : "s"} will be grouped under the chosen Production Order. Status, delivery/review evidence, and tracked time are untouched.
            </p>

            {openProductionOrders.length === 0 ? (
              <p className="text-sm text-zinc-400">
                This project has no open batch yet.{" "}
                <Link href={`/productivity/orders/new?projectId=${projectId}`} className="font-bold text-emerald-300 hover:text-emerald-200">
                  Start one with LET&apos;S COOK →
                </Link>{" "}
                then come back and add these videos to it.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-400">Batch / Production Order</span>
                  <select
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {openProductionOrders.map((order) => (
                      <option key={order.id} value={order.id}>{order.label}</option>
                    ))}
                  </select>
                </label>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
                >
                  {isPending ? "Adding…" : `Add ${selectedIds.length} video${selectedIds.length === 1 ? "" : "s"} to batch`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
