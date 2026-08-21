"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/modules/finance/actions";

export function DeleteTransactionButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("Delete this transaction?")) return;
        startTransition(() => deleteTransaction(id));
      }}
      disabled={isPending}
      className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
