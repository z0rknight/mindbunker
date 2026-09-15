"use client";

import { useState } from "react";
import { SensorSessionActions } from "../../SensorSessionActions";
import { SensorSessionEditForm } from "./SensorSessionEditForm";
import type { WorkSessionActivityType } from "@/modules/work-sessions/core";
import type { WorkSessionVideoOption } from "@/modules/work-sessions/data";

export function SensorSessionDetailControls({
  sessionId,
  state,
  contextType,
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
  contextType: string;
  approvedWorkSessionId: number | null;
  videoId: number | null;
  startedAt: number;
  endedAt: number | null;
  activityType: WorkSessionActivityType;
  note: string | null;
  videoOptions: WorkSessionVideoOption[];
}) {
  const [editing, setEditing] = useState(false);
  // Correcting attribution before approval only makes sense for CLIENT work
  // -- there is no video to re-pick for Lead/Internal/Admin, and forcing one
  // would be exactly the "fake video_id" the sync hotfix explicitly forbids.
  const canEdit = contextType === "CLIENT" && state === "PENDING" && endedAt !== null && videoId !== null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SensorSessionActions id={sessionId} state={state} contextType={contextType} approvedWorkSessionId={approvedWorkSessionId} />
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
      {editing && endedAt !== null && videoId !== null && (
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
