"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEquipmentMaintenanceEvent,
  updateEquipmentMaintenanceEvent,
} from "@/modules/equipment/actions";
import {
  EQUIPMENT_MAINTENANCE_TYPES,
  EQUIPMENT_MAINTENANCE_TYPE_LABELS,
} from "@/modules/equipment/config";
import { todayISO } from "@/utils/date";

export function MaintenanceEventFormModal({
  mode,
  assetId,
  event,
  triggerLabel,
  triggerClassName,
}: {
  mode: "create" | "edit";
  assetId: number;
  event?: {
    id: number;
    type: string;
    performedAt: string;
    cost: number | null;
    issue: string | null;
    action: string | null;
    result: string | null;
    nextInspection: string | null;
    notes: string | null;
  };
  triggerLabel: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [type, setType] = useState(event?.type ?? "INSPECTION");
  const [performedAt, setPerformedAt] = useState(event?.performedAt ?? todayISO());
  const [cost, setCost] = useState(event?.cost?.toString() ?? "");
  const [issue, setIssue] = useState(event?.issue ?? "");
  const [action, setAction] = useState(event?.action ?? "");
  const [result, setResult] = useState(event?.result ?? "");
  const [nextInspection, setNextInspection] = useState(event?.nextInspection ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        assetId,
        type,
        performedAt,
        cost: cost ? Number(cost) : null,
        issue: issue || null,
        action: action || null,
        result: result || null,
        nextInspection: nextInspection || null,
        notes: notes || null,
      };
      const result_ =
        mode === "edit" && event
          ? await updateEquipmentMaintenanceEvent(event.id, input)
          : await createEquipmentMaintenanceEvent(input);

      if (!result_.success) {
        setError(result_.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const fieldClass =
    "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500";
  const labelClass = "text-zinc-400 text-xs uppercase tracking-wider block mb-1";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">
                {mode === "edit" ? "✏️ Edit Maintenance Event" : "🔧 Log Maintenance"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
                    {EQUIPMENT_MAINTENANCE_TYPES.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_MAINTENANCE_TYPE_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Performed On</label>
                  <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} required className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Issue</label>
                <input type="text" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What prompted this?" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Action Taken</label>
                <input type="text" value={action} onChange={(e) => setAction(e.target.value)} placeholder="What was done" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Result</label>
                <input type="text" value={result} onChange={(e) => setResult(e.target.value)} placeholder="Outcome" className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Cost</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Next Inspection</label>
                  <input type="date" value={nextInspection} onChange={(e) => setNextInspection(e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Log Event"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
