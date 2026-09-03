import Link from "next/link";
import { getEquipmentAcquisitions, getEquipmentSystems } from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_ACQUISITION_STAGES,
  EQUIPMENT_ACQUISITION_STAGE_LABELS,
} from "@/modules/equipment/config";
import { formatCurrency } from "@/utils/date";
import { AcquisitionFormModal } from "./AcquisitionFormModal";

export const dynamic = "force-dynamic";

const PRIORITY_CLASSES: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-300",
  HIGH: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  MEDIUM: "border-zinc-700 bg-zinc-800 text-zinc-400",
  LOW: "border-zinc-800 bg-zinc-900 text-zinc-600",
};

export default async function EquipmentAcquisitionsPage() {
  const [acquisitions, systemsWithCost] = await Promise.all([
    getEquipmentAcquisitions(),
    getEquipmentSystems(),
  ]);
  const systems = systemsWithCost.map(({ system }) => ({ id: system.id, name: system.name }));
  const currency = DEFAULT_EQUIPMENT_CURRENCY;

  const byStage = new Map<string, typeof acquisitions>();
  for (const stage of EQUIPMENT_ACQUISITION_STAGES) byStage.set(stage, []);
  for (const acq of acquisitions) {
    const list = byStage.get(acq.stage) ?? [];
    list.push(acq);
    byStage.set(acq.stage, list);
  }
  // rankAcquisitions already ordered `acquisitions` overall; within each
  // stage column that relative order (priority, then requiredBy, then
  // age) is preserved since we just partition it, not re-sort.

  const activeStages = EQUIPMENT_ACQUISITION_STAGES.filter((s) => s !== "CANCELLED");

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/equipment" className="text-zinc-500 hover:text-white text-xs font-semibold">← Equipment</Link>
          <h1 className="text-2xl font-bold text-white mt-1">💡 Acquisitions</h1>
          <p className="text-zinc-500 text-sm mt-1">
            What we&rsquo;re considering, why, and how urgent — a decision pipeline, not a wishlist.
          </p>
        </div>
        <AcquisitionFormModal
          mode="create"
          systems={systems}
          triggerLabel="+ Add Acquisition"
          triggerClassName="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
        />
      </div>

      {acquisitions.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-16 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            Nothing in the pipeline yet. Add a considered purchase — what problem it solves and how urgent it is.
          </p>
          <AcquisitionFormModal
            mode="create"
            systems={systems}
            triggerLabel="+ Add First Acquisition"
            triggerClassName="inline-block rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:overflow-x-auto md:pb-2">
          {activeStages.map((stage) => {
            const items = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="md:w-64 md:shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    {EQUIPMENT_ACQUISITION_STAGE_LABELS[stage]}
                  </h2>
                  <span className="text-zinc-600 text-xs">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-zinc-700 text-xs px-1 py-2">—</p>
                  ) : (
                    items.map((acq) => (
                      <Link
                        key={acq.id}
                        href={`/equipment/acquisitions/${acq.id}`}
                        className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-white text-sm font-medium truncate">{acq.name}</p>
                          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIORITY_CLASSES[acq.priority]}`}>
                            {acq.priority}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs truncate">{acq.problem}</p>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="text-zinc-600">{acq.requiredBy ? `by ${acq.requiredBy}` : ""}</span>
                          <span className="text-zinc-400 font-semibold">
                            {acq.estimatedCost != null ? formatCurrency(acq.estimatedCost, currency) : ""}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(byStage.get("CANCELLED")?.length ?? 0) > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-white">
            Cancelled ({byStage.get("CANCELLED")!.length})
          </summary>
          <div className="mt-3 space-y-2">
            {byStage.get("CANCELLED")!.map((acq) => (
              <Link
                key={acq.id}
                href={`/equipment/acquisitions/${acq.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 hover:border-zinc-700 transition-colors"
              >
                <span className="text-zinc-500 text-sm truncate line-through">{acq.name}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
