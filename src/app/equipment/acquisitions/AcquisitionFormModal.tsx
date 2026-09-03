"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEquipmentAcquisition,
  updateEquipmentAcquisition,
} from "@/modules/equipment/actions";
import {
  EQUIPMENT_ACQUISITION_PRIORITIES,
  EQUIPMENT_ACQUISITION_PRIORITY_LABELS,
  EQUIPMENT_ACQUISITION_STAGES,
  EQUIPMENT_ACQUISITION_STAGE_LABELS,
  EQUIPMENT_ACQUISITION_TERMINAL_STAGES,
  EQUIPMENT_DOMAINS,
  EQUIPMENT_DOMAIN_LABELS,
} from "@/modules/equipment/config";

type SystemOption = { id: number; name: string };

export function AcquisitionFormModal({
  mode,
  acquisition,
  systems,
  triggerLabel,
  triggerClassName,
}: {
  mode: "create" | "edit";
  acquisition?: {
    id: number;
    name: string;
    stage: string;
    problem: string;
    expectedImpact: string | null;
    estimatedCost: number | null;
    priority: string;
    requiredBy: string | null;
    riskReduction: string | null;
    revenueImpact: string | null;
    systemId: number | null;
    domain: string | null;
    notes: string | null;
  };
  systems: SystemOption[];
  triggerLabel: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState(acquisition?.name ?? "");
  const [stage, setStage] = useState(acquisition?.stage ?? "IDEA");
  const [problem, setProblem] = useState(acquisition?.problem ?? "");
  const [expectedImpact, setExpectedImpact] = useState(acquisition?.expectedImpact ?? "");
  const [estimatedCost, setEstimatedCost] = useState(acquisition?.estimatedCost?.toString() ?? "");
  const [priority, setPriority] = useState(acquisition?.priority ?? "MEDIUM");
  const [requiredBy, setRequiredBy] = useState(acquisition?.requiredBy ?? "");
  const [riskReduction, setRiskReduction] = useState(acquisition?.riskReduction ?? "");
  const [revenueImpact, setRevenueImpact] = useState(acquisition?.revenueImpact ?? "");
  const [systemId, setSystemId] = useState(acquisition?.systemId?.toString() ?? "");
  const [domain, setDomain] = useState(acquisition?.domain ?? "");
  const [notes, setNotes] = useState(acquisition?.notes ?? "");

  const isTerminal =
    mode === "edit" &&
    acquisition &&
    (EQUIPMENT_ACQUISITION_TERMINAL_STAGES as readonly string[]).includes(acquisition.stage);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        name,
        stage,
        problem,
        expectedImpact: expectedImpact || null,
        estimatedCost: estimatedCost ? Number(estimatedCost) : null,
        priority,
        requiredBy: requiredBy || null,
        riskReduction: riskReduction || null,
        revenueImpact: revenueImpact || null,
        systemId: systemId ? Number(systemId) : null,
        domain: domain || null,
        notes: notes || null,
      };
      const result =
        mode === "edit" && acquisition
          ? await updateEquipmentAcquisition(acquisition.id, input)
          : await createEquipmentAcquisition(input);

      if (!result.success) {
        setError(result.error);
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
                {mode === "edit" ? "✏️ Edit Acquisition" : "💡 Add Acquisition"}
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
              <div>
                <label className={labelClass}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="10Gbe upgrade for editing suite" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Problem</label>
                <textarea value={problem} onChange={(e) => setProblem(e.target.value)} required rows={2} placeholder="What does this solve?" className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
                    {EQUIPMENT_ACQUISITION_PRIORITIES.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_ACQUISITION_PRIORITY_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    disabled={Boolean(isTerminal)}
                    className={`${fieldClass} disabled:opacity-50`}
                  >
                    {EQUIPMENT_ACQUISITION_STAGES.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_ACQUISITION_STAGE_LABELS[v]}</option>
                    ))}
                  </select>
                  {isTerminal && (
                    <p className="text-zinc-600 text-[10px] mt-1">{acquisition!.stage} is final and can&rsquo;t be changed.</p>
                  )}
                </div>
              </div>

              <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 open:pb-1">
                <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white">
                  More details (optional)
                </summary>
                <div className="space-y-4 px-3 pt-1 pb-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Estimated Cost</label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Required By</label>
                      <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className={fieldClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>System</label>
                      <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className={fieldClass}>
                        <option value="">— None —</option>
                        {systems.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Domain</label>
                      <select value={domain} onChange={(e) => setDomain(e.target.value)} className={fieldClass}>
                        <option value="">— Unspecified —</option>
                        {EQUIPMENT_DOMAINS.map((d) => (
                          <option key={d} value={d}>{EQUIPMENT_DOMAIN_LABELS[d]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Expected Impact</label>
                    <input type="text" value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Risk Reduction</label>
                    <input type="text" value={riskReduction} onChange={(e) => setRiskReduction(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Revenue Impact</label>
                    <input type="text" value={revenueImpact} onChange={(e) => setRevenueImpact(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
                  </div>
                </div>
              </details>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Acquisition"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
