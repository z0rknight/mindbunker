import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEquipmentAcquisition,
  getEquipmentAssets,
  getEquipmentSystems,
} from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_ACQUISITION_STAGE_LABELS,
  EQUIPMENT_ACQUISITION_TERMINAL_STAGES,
  EQUIPMENT_DOMAIN_LABELS,
} from "@/modules/equipment/config";
import { formatCurrency, formatDate } from "@/utils/date";
import { AcquisitionFormModal } from "../AcquisitionFormModal";
import { AssetFormModal } from "../../assets/AssetFormModal";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white text-sm mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

const PRIORITY_CLASSES: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-300",
  HIGH: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  MEDIUM: "border-zinc-700 bg-zinc-800 text-zinc-400",
  LOW: "border-zinc-800 bg-zinc-900 text-zinc-600",
};

export default async function EquipmentAcquisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acquisitionId = Number(id);
  if (!Number.isFinite(acquisitionId)) notFound();

  const [record, allAssets, systemsWithCost] = await Promise.all([
    getEquipmentAcquisition(acquisitionId),
    getEquipmentAssets(),
    getEquipmentSystems(),
  ]);
  if (!record) notFound();

  const { acquisition, system, resultingAsset } = record;
  const currency = DEFAULT_EQUIPMENT_CURRENCY;
  const systems = systemsWithCost.map(({ system: s }) => ({ id: s.id, name: s.name }));
  const assetOptions = allAssets.map((a) => ({ id: a.id, name: a.name }));
  const isTerminal = (EQUIPMENT_ACQUISITION_TERMINAL_STAGES as readonly string[]).includes(acquisition.stage);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/equipment/acquisitions" className="text-zinc-500 hover:text-white text-xs font-semibold">← Acquisitions</Link>

      <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{acquisition.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{acquisition.problem}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${PRIORITY_CLASSES[acquisition.priority]}`}>
            {acquisition.priority}
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-300">
            {EQUIPMENT_ACQUISITION_STAGE_LABELS[acquisition.stage as keyof typeof EQUIPMENT_ACQUISITION_STAGE_LABELS]}
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <AcquisitionFormModal
          mode="edit"
          acquisition={acquisition}
          systems={systems}
          triggerLabel="✏️ Edit Acquisition"
          triggerClassName="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        />
        {resultingAsset ? (
          <Link
            href={`/equipment/assets/${resultingAsset.id}`}
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/50 transition-colors"
          >
            ✅ View resulting asset: {resultingAsset.name}
          </Link>
        ) : (
          !isTerminal && (
            <AssetFormModal
              mode="create"
              fromAcquisitionId={acquisition.id}
              prefill={{
                name: acquisition.name,
                systemId: acquisition.systemId,
                purchasePrice: acquisition.estimatedCost,
                notes: `Created from acquisition: ${acquisition.name}`,
              }}
              systems={systems}
              otherAssets={assetOptions}
              triggerLabel="📦 Create Asset from Acquisition"
              triggerClassName="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-3 py-2 text-xs transition-colors cursor-pointer"
            />
          )
        )}
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Record</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Estimated Cost" value={acquisition.estimatedCost != null ? formatCurrency(acquisition.estimatedCost, currency) : null} />
          <Field label="Required By" value={acquisition.requiredBy ? formatDate(acquisition.requiredBy) : null} />
          <Field
            label="System"
            value={system ? <Link href={`/equipment/systems/${system.id}`} className="text-violet-400 hover:text-violet-300">{system.name}</Link> : null}
          />
          <Field label="Domain" value={acquisition.domain ? EQUIPMENT_DOMAIN_LABELS[acquisition.domain as keyof typeof EQUIPMENT_DOMAIN_LABELS] : null} />
          <Field label="Expected Impact" value={acquisition.expectedImpact} />
          <Field label="Risk Reduction" value={acquisition.riskReduction} />
          <Field label="Revenue Impact" value={acquisition.revenueImpact} />
        </div>
        {acquisition.notes && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Notes</p>
            <p className="text-zinc-300 text-sm whitespace-pre-wrap">{acquisition.notes}</p>
          </div>
        )}
      </section>
    </div>
  );
}
