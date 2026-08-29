"use client";

import { useState, useTransition } from "react";
import { deleteTransaction } from "@/modules/finance/actions";

export function DeleteTransactionButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
          if (!confirm("Delete this transaction?")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteTransaction(id);
            if (!result.success) setError(result.error);
          });
        }}
        disabled={isPending}
        className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
      >
        {isPending ? "..." : "Delete"}
      </button>
      {error && <span className="max-w-48 text-right text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
