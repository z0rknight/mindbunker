"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePersonalTransaction } from "@/modules/personal-finance/actions";

// Same confirm()-gated pattern as DeleteFxConversionButton.tsx. Only ever
// rendered for an income/expense row -- the action itself also rejects
// opening_balance/owner_pay_receipt server-side as a second line of
// defense (see deletePersonalTransaction's comment in actions.ts).
export function DeletePersonalTransactionButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => {
          if (!confirm("Delete this transaction? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            const result = await deletePersonalTransaction(id);
            if (!result.success) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        disabled={isPending}
        className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
      >
        {isPending ? "..." : "Delete"}
      </button>
      {error && <p className="mt-0.5 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
