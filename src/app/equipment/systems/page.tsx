import Link from "next/link";
import { getEquipmentSystems } from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_SYSTEM_STATUS_LABELS,
  isEquipmentOwnership,
  type EquipmentOwnership,
} from "@/modules/equipment/config";
import { formatCurrency } from "@/utils/date";
import { OwnershipTabs } from "../OwnershipTabs";
import { SystemFormModal } from "./SystemFormModal";
import { EquipmentConditionBadge } from "@/components/equipment/EquipmentBadges";

export const dynamic = "force-dynamic";

export default async function EquipmentSystemsPage({
  searchParams,
}: {
  searchParams: Promise<{ ownership?: string }>;
}) {
  const query = await searchParams;
  const ownership: EquipmentOwnership | undefined = isEquipmentOwnership(query.ownership)
    ? query.ownership
    : undefined;

  const systems = await getEquipmentSystems(ownership);
  const currency = DEFAULT_EQUIPMENT_CURRENCY;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/equipment" className="text-zinc-500 hover:text-white text-xs font-semibold">← Equipment</Link>
          <h1 className="text-2xl font-bold text-white mt-1">🧩 Systems</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Operational groupings of assets — what setup does this participate in, not what kind of thing it is.
          </p>
        </div>
        <SystemFormModal
          mode="create"
          triggerLabel="+ Add System"
          triggerClassName="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
        />
      </div>

      <div className="mb-6">
        <OwnershipTabs active={ownership ?? "ALL"} basePath="/equipment/systems" />
      </div>

      {systems.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-16 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            No systems recorded yet. A system groups assets by operational setup, e.g. &ldquo;RMedia Editing Suite&rdquo; or &ldquo;Home/RMedia Network&rdquo;.
          </p>
          <SystemFormModal
            mode="create"
            triggerLabel="+ Add First System"
            triggerClassName="inline-block rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map(({ system, financials, conditions, attention, memberCount }) => (
            <Link
              key={system.id}
              href={`/equipment/systems/${system.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-white font-semibold text-sm">{system.name}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {conditions.worst && <EquipmentConditionBadge condition={conditions.worst} />}
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
                    {EQUIPMENT_SYSTEM_STATUS_LABELS[system.status]}
                  </span>
                </div>
              </div>
              {system.location && <p className="text-zinc-500 text-xs mb-2">📍 {system.location}</p>}
              <p className="text-zinc-500 text-xs">{memberCount} member{memberCount === 1 ? "" : "s"}</p>
              <p className="text-white text-lg font-bold mt-1">
                {financials.invested.valuedCount > 0 ? formatCurrency(financials.invested.total, currency) : "—"}
              </p>
              {financials.invested.valuedCount < financials.invested.countableCount && financials.invested.countableCount > 0 && (
                <p className="text-zinc-600 text-xs">{financials.invested.valuedCount}/{financials.invested.countableCount} priced</p>
              )}
              {memberCount > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-zinc-600">Current Value</p>
                    <p className="text-zinc-300">
                      {financials.currentValue.valuedCount > 0 ? formatCurrency(financials.currentValue.total, currency) : "—"}
                      <span className="text-zinc-600"> ({financials.currentValue.valuedCount}/{financials.currentValue.countableCount})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600">Replacement Exp.</p>
                    <p className="text-zinc-300">
                      {financials.replacementExposure.valuedCount > 0 ? formatCurrency(financials.replacementExposure.total, currency) : "—"}
                      <span className="text-zinc-600"> ({financials.replacementExposure.valuedCount}/{financials.replacementExposure.countableCount})</span>
                    </p>
                  </div>
                </div>
              )}
              {(attention.overdueCount > 0 || attention.dueSoonCount > 0) && (
                <p className="mt-2 text-[11px] font-semibold text-amber-400">
                  {attention.overdueCount > 0 && `${attention.overdueCount} maintenance overdue`}
                  {attention.overdueCount > 0 && attention.dueSoonCount > 0 && " · "}
                  {attention.dueSoonCount > 0 && `${attention.dueSoonCount} due soon`}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
