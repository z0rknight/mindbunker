"use client";

import { useTransition } from "react";
import { convertLeadToClient, deleteClient } from "@/modules/crm/actions";

export function ClientActions({ id, showConvert }: { id: number; showConvert: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Permanently delete this contact? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteClient(id);
      if (!result.success) {
        alert(result.error);
      }
    });
  }

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
        onClick={handleDelete}
        disabled={isPending}
        title="Permanently delete (blocked if this contact has real history — use Geladeira instead)"
        className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
      >
        {isPending ? "..." : "✕"}
      </button>
    </div>
  );
}
