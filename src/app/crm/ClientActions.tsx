"use client";

import { useTransition } from "react";
import { convertLeadToClient } from "@/modules/crm/actions";

export function ClientActions({ id, showConvert }: { id: number; showConvert: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {showConvert && (
        <button
          onClick={() => {
            if (!confirm("Convert this lead to active client?")) return;
            startTransition(() => convertLeadToClient(id));
          }}
          disabled={isPending}
          className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          Convert →
        </button>
      )}
    </div>
  );
}
