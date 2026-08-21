"use client";

import { useTransition } from "react";
import { convertLeadToClient, deleteClient } from "@/modules/crm/actions";

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
      <button
        onClick={() => {
          if (!confirm("Delete this contact?")) return;
          startTransition(() => deleteClient(id));
        }}
        disabled={isPending}
        className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
      >
        {isPending ? "..." : "✕"}
      </button>
    </div>
  );
}
