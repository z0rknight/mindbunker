"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveSensorSession,
  archiveSensorSession,
  deleteArchivedSensorSession,
} from "@/modules/sensor/actions";

export function SensorSessionActions({
  id,
  state,
  approvedWorkSessionId,
  contextType = "CLIENT",
}: {
  id: number;
  state: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
  approvedWorkSessionId: number | null;
  contextType?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "The Sensor session could not be updated.");
        return;
      }
      router.refresh();
    });
  }

  if (state === "DELETED") {
    return <p className="text-xs text-zinc-600">Manually deleted from operational review; evidence tombstone retained.</p>;
  }

  if (state === "APPROVED") {
    return (
      <p className="text-xs font-semibold text-emerald-300">
        Approved as Work Session #{approvedWorkSessionId ?? "—"}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {state === "PENDING" && (
          <>
            {contextType === "CLIENT" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => approveSensorSession(id))}
                className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-black text-zinc-950 hover:bg-emerald-300 disabled:opacity-50"
              >
                Approve
              </button>
            ) : (
              <p className="flex items-center text-xs text-zinc-600">
                {contextType} work has no canonical Video -- Archive when reviewed.
              </p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => archiveSensorSession(id))}
              className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Archive
            </button>
          </>
        )}
        {state === "ARCHIVED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this archived Sensor session from review? The evidence tombstone is retained.")) {
                run(() => deleteArchivedSensorSession(id));
              }
            }}
            className="min-h-10 rounded-lg border border-red-900/70 px-3 text-xs font-bold text-red-300 hover:bg-red-950/30 disabled:opacity-50"
          >
            Delete manually…
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
