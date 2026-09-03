"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEquipmentMaintenanceEvent } from "@/modules/equipment/actions";

export function DeleteMaintenanceEventButton({ id, assetId }: { id: number; assetId: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
          if (!confirm("Delete this maintenance event?")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteEquipmentMaintenanceEvent(id, assetId);
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
        {isPending ? "…" : "Delete"}
      </button>
      {error && <span className="max-w-48 text-right text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
