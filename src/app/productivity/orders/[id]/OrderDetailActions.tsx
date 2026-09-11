"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelProductionOrder,
  cancelProductionOrderItem,
  closeProductionOrder,
} from "@/modules/production-orders/actions";

export function CancelItemButton({ videoId }: { videoId: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancel this item? It stays visible with full history, just excluded from active counts.")) {
          return;
        }
        startTransition(async () => {
          const result = await cancelProductionOrderItem(videoId);
          if (!result.success) alert(result.error);
          else router.refresh();
        });
      }}
      className="rounded border border-red-900/60 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:border-red-600 disabled:opacity-40"
    >
      Cancel
    </button>
  );
}

export function OrderLifecycleActions({ orderId }: { orderId: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await closeProductionOrder(orderId);
            if (!result.success) alert(result.error);
            else router.refresh();
          });
        }}
        className="rounded-lg border border-zinc-700 px-3 py-2 font-mono text-xs font-bold text-zinc-300 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
      >
        Close order
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Cancel this whole order? Items keep their history; nothing is deleted.")) return;
          startTransition(async () => {
            const result = await cancelProductionOrder(orderId);
            if (!result.success) alert(result.error);
            else router.refresh();
          });
        }}
        className="rounded-lg border border-red-900/60 px-3 py-2 font-mono text-xs font-bold text-red-400 hover:border-red-500 disabled:opacity-40"
      >
        Cancel order
      </button>
    </div>
  );
}
