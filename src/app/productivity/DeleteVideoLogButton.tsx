"use client";

import { useTransition } from "react";
import { deleteVideoLog } from "@/modules/productivity/actions";

export function DeleteVideoLogButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("Delete this log?")) return;
        startTransition(async () => {
          const result = await deleteVideoLog(id);
          if (!result.success) alert(result.error);
        });
      }}
      disabled={isPending}
      className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
