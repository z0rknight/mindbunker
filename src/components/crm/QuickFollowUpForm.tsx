"use client";

import { useState, useTransition } from "react";
import { updateOpportunity } from "@/modules/gateway/actions";

// Tuesday Patch Priority 3 mini workbench: "Add follow-up" and "Schedule
// call" are both instances of the same canonical fact -- clients.nextAction
// / nextActionDate, written through the same updateOpportunity action the
// full client profile and Productivity's FollowUpControl already use (see
// app/productivity/FollowUpControl.tsx for the identical reasoning). The
// caller already has the client's current stage/serviceInterest/
// qualificationNotes loaded (the CRM list query selects full client rows),
// so this form doesn't need FollowUpControl's own lazy fetch.
function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function todayPlusDays(days: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const inputClass =
  "min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-white outline-none focus:border-violet-500";
const chipButton =
  "min-h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

export function QuickFollowUpForm({
  clientId,
  currentStage,
  currentServiceInterest,
  currentQualificationNotes,
  initialNextAction = "",
  initialNextActionDate = "",
  onDone,
  onCancel,
}: {
  clientId: number;
  currentStage: string;
  currentServiceInterest: string | null;
  currentQualificationNotes: string | null;
  initialNextAction?: string;
  initialNextActionDate?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nextAction, setNextAction] = useState(initialNextAction);
  const [nextActionDate, setNextActionDate] = useState(initialNextActionDate);
  const [error, setError] = useState("");

  function save() {
    setError("");
    startTransition(async () => {
      const result = await updateOpportunity(clientId, {
        stage: currentStage,
        serviceInterest: currentServiceInterest ?? "",
        nextAction,
        nextActionDate,
        qualificationNotes: currentQualificationNotes ?? "",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <input
        value={nextAction}
        onChange={(event) => setNextAction(event.target.value)}
        placeholder="What's the next step?"
        maxLength={500}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Tomorrow", value: todayPlusDays(1) },
          { label: "In 3 days", value: todayPlusDays(3) },
          { label: "Next week", value: todayPlusDays(7) },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={pending}
            onClick={() => setNextActionDate(preset.value)}
            className={chipButton}
          >
            {preset.label}
          </button>
        ))}
        <input
          aria-label="Follow-up date"
          type="date"
          value={nextActionDate}
          onChange={(event) => setNextActionDate(event.target.value)}
          className={`${inputClass} w-auto`}
        />
      </div>
      {error && <p className="text-xs text-red-300" aria-live="assertive">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
