"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFxConversion } from "@/modules/fx/actions";

// Same confirm()-gated pattern as DeleteTransactionButton.tsx. No FK
// references fx_conversions from anywhere else in the schema -- deleting
// one observation removes only that observation, nothing else.
export function DeleteFxConversionButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (!confirm("Delete this FX conversion? This only removes the observation, not any transaction.")) return;
        startTransition(async () => {
          await deleteFxConversion(id);
          router.refresh();
        });
      }}
      disabled={isPending}
      className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
    >
      {isPending ? "..." : "Delete"}
    </button>
  );
}
