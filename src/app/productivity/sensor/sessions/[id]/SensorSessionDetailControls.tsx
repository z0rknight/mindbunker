"use client";

import { useState } from "react";
import { SensorSessionActions } from "../../SensorSessionActions";
import { SensorSessionEditForm } from "./SensorSessionEditForm";
import type { WorkSessionActivityType } from "@/modules/work-sessions/core";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";

export function SensorSessionDetailControls({
  sessionId,
  state,
  approvedWorkSessionId,
  videoId,
  startedAt,
  endedAt,
  activityType,
  note,
  videoOptions,
}: {
  sessionId: number;
  state: "PENDING" | "APPROVED" | "ARCHIVED" | "DELETED";
  approvedWorkSessionId: number | null;
  videoId: number;
  startedAt: number;
  endedAt: number | null;
  activityType: WorkSessionActivityType;
  note: string | null;
  videoOptions: WorkSessionVideoOption[];
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = state === "PENDING" && endedAt !== null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SensorSessionActions id={sessionId} state={state} approvedWorkSessionId={approvedWorkSessionId} />
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-10 rounded-lg border border-amber-700/60 px-3 text-xs font-bold text-amber-300 hover:bg-amber-950/30"
          >
            Edit before approving
          </button>
        )}
      </div>
      {editing && endedAt !== null && (
        <SensorSessionEditForm
          sessionId={sessionId}
          videoId={videoId}
          startedAt={startedAt}
          endedAt={endedAt}
          activityType={activityType}
          note={note}
          videoOptions={videoOptions}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
