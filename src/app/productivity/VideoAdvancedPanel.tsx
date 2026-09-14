"use client";

// House Cleaning Wave 2 §5-§6, §9 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// the research found no evidence the 8-stage Production Ticket is
// actually maintained daily, and the mission explicitly asks for
// Friction logging to stop being a second daily write path once
// "Blocked" (VideoEssentialsPanel) covers the same real fact. Neither
// table is dropped and neither server action is deleted -- this is a
// collapsed, closed-by-default, low-emphasis home for existing history
// plus the Production Ticket's still-supported (rarely needed) editing,
// exactly per the mission's "ADVANCED / HISTORY, collapsed, read-only
// unless a real edit need exists" instruction.
import {
  getVideoOperationalSnapshot,
  setProductionChecklistStep,
  type VideoOperationalSnapshot,
} from "@/modules/video-operations/actions";
import {
  CHECKLIST_STATUSES,
  PRODUCTION_STEPS,
  type ChecklistStatus,
} from "@/modules/video-operations/config";
import { useEffect, useState, useTransition } from "react";

type Snapshot = Extract<VideoOperationalSnapshot, { success: true }>["data"];

export function VideoAdvancedPanel({ videoId }: { videoId: number }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getVideoOperationalSnapshot(videoId).then((result) => {
      if (cancelled || !result.success) return;
      setSnapshot(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  function setStep(step: (typeof PRODUCTION_STEPS)[number], status: ChecklistStatus) {
    startTransition(async () => {
      const result = await setProductionChecklistStep(videoId, step, status);
      if (result.success) {
        const refreshed = await getVideoOperationalSnapshot(videoId);
        if (refreshed.success) setSnapshot(refreshed.data);
      }
    });
  }

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-950/25 p-3.5">
      <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-wider text-zinc-500">
        <span className="mr-1.5 inline-block transition group-open:rotate-90">▸</span>Advanced / history
      </summary>
      {snapshot && (
        <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
              Production checklist · {snapshot.checklistProgress.done}/{snapshot.checklistProgress.applicable}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRODUCTION_STEPS.map((step) => {
                const current = snapshot.checklist.find((item) => item.step === step)?.status ?? "NOT_STARTED";
                return (
                  <label key={step} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                    <span className="block text-[10px] font-black text-zinc-500">{step}</span>
                    <select
                      value={current}
                      disabled={pending}
                      onChange={(event) => setStep(step, event.target.value as ChecklistStatus)}
                      className="mt-1 w-full bg-transparent text-xs font-bold text-zinc-200 outline-none"
                    >
                      {CHECKLIST_STATUSES.map((status) => (
                        <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          {snapshot.friction.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                Friction log (history · {snapshot.friction.length})
              </p>
              <ul className="space-y-1.5">
                {snapshot.friction.map((item) => (
                  <li key={item.id} className="text-xs text-zinc-500">
                    {item.category}
                    {item.minutesLost ? ` · ${item.minutesLost}m` : ""}
                    {item.note ? ` · ${item.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.revisions.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                Revision detail (history · {snapshot.revisions.length})
              </p>
              <ul className="space-y-1.5">
                {snapshot.revisions.map((item) => (
                  <li key={item.id} className="text-xs text-zinc-500">
                    {item.causedBy.replaceAll("_", " ")}
                    {item.category ? ` · ${item.category}` : ""}
                    {item.note ? ` · ${item.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-zinc-600">
            Forgot to start the timer? Log it in{" "}
            <a href="/mindbunker/productivity/backfill" className="font-bold text-violet-300 hover:text-violet-200">Backfill a day</a>
            {" "}or Sessions, not here.
          </p>
        </div>
      )}
    </details>
  );
}
