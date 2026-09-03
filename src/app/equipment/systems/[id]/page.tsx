import Link from "next/link";
import { notFound } from "next/navigation";
import { getEquipmentSystem } from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_DOMAIN_ICONS,
  EQUIPMENT_DOMAIN_LABELS,
  EQUIPMENT_SYSTEM_STATUS_LABELS,
} from "@/modules/equipment/config";
import { formatCurrency } from "@/utils/date";
import {
  EquipmentConditionBadge,
  EquipmentStatusBadge,
} from "@/components/equipment/EquipmentBadges";
import { SystemFormModal } from "../SystemFormModal";

export const dynamic = "force-dynamic";

export default async function EquipmentSystemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const systemId = Number(id);
  if (!Number.isFinite(systemId)) notFound();

  const record = await getEquipmentSystem(systemId);
  if (!record) notFound();

  const { system, members, invested, financials, conditions, attention } = record;
  const currency = DEFAULT_EQUIPMENT_CURRENCY;
  const topLevel = members.filter((m) => !m.parentAssetId || !members.some((other) => other.id === m.parentAssetId));

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/equipment/systems" className="text-zinc-500 hover:text-white text-xs font-semibold">← Systems</Link>

      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{system.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {system.location ? `📍 ${system.location} · ` : ""}{members.length} member{members.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {conditions.worst && <EquipmentConditionBadge condition={conditions.worst} />}
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold uppercase text-zinc-300">
            {EQUIPMENT_SYSTEM_STATUS_LABELS[system.status]}
          </span>
        </div>
      </div>

      {system.description && <p className="text-zinc-400 text-sm mb-6 max-w-2xl">{system.description}</p>}

      {/* Wave 3 §8: compact system-level Attention summary -- worst
          factual condition + overdue/due-soon maintenance among members,
          never a fabricated system health score. */}
      {attention.overdueCount > 0 || attention.dueSoonCount > 0 || attention.attentionAssetCount > 0 ? (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          attention.worstCondition === "CRITICAL" || attention.overdueCount > 0
            ? "border-red-800/60 bg-red-950/20 text-red-300"
            : "border-amber-800/60 bg-amber-950/20 text-amber-300"
        }`}>
          <span className="font-semibold">Needs attention:</span>{" "}
          {[
            attention.overdueCount > 0 && `${attention.overdueCount} maintenance overdue`,
            attention.dueSoonCount > 0 && `${attention.dueSoonCount} due soon`,
            attention.attentionAssetCount > 0 && `${attention.attentionAssetCount} asset${attention.attentionAssetCount === 1 ? "" : "s"} below Good condition`,
          ].filter(Boolean).join(" · ")}
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-emerald-400/80">
          No members need attention.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-violet-600/30 bg-violet-600/5 px-4 py-3">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Invested</p>
          <p className="text-xl font-bold text-violet-400">
            {financials.invested.valuedCount > 0 ? formatCurrency(financials.invested.total, currency) : "—"}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {financials.invested.valuedCount}/{financials.invested.countableCount} priced · components excluded when parent priced
          </p>
        </div>
        <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 px-4 py-3">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Current Value</p>
          <p className="text-xl font-bold text-blue-400">
            {financials.currentValue.valuedCount > 0 ? formatCurrency(financials.currentValue.total, currency) : "—"}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {financials.currentValue.valuedCount}/{financials.currentValue.countableCount} valued
          </p>
        </div>
        <div className="rounded-xl border border-amber-600/30 bg-amber-600/5 px-4 py-3">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Replacement Exposure</p>
          <p className="text-xl font-bold text-amber-400">
            {financials.replacementExposure.valuedCount > 0 ? formatCurrency(financials.replacementExposure.total, currency) : "—"}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {financials.replacementExposure.valuedCount}/{financials.replacementExposure.countableCount} valued
          </p>
        </div>
      </div>

      <div className="mb-6">
        <SystemFormModal
          mode="edit"
          system={system}
          triggerLabel="✏️ Edit System"
          triggerClassName="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Member Assets</h2>
        {members.length === 0 ? (
          <p className="text-zinc-600 text-sm py-6 text-center">No assets assigned to this system yet.</p>
        ) : (
          <div className="space-y-2">
            {topLevel.map((asset) => {
              const componentsOfAsset = members.filter((m) => m.parentAssetId === asset.id);
              return (
                <div key={asset.id}>
                  <Link
                    href={`/equipment/assets/${asset.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{asset.name}</p>
                      <p className="text-zinc-600 text-xs">
                        {EQUIPMENT_DOMAIN_ICONS[asset.domain]} {EQUIPMENT_DOMAIN_LABELS[asset.domain]} · {asset.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <EquipmentStatusBadge status={asset.status} />
                      <EquipmentConditionBadge condition={asset.condition} />
                    </div>
                  </Link>
                  {componentsOfAsset.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-3">
                      {componentsOfAsset.map((c) => (
                        <Link
                          key={c.id}
                          href={`/equipment/assets/${c.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-zinc-900 transition-colors"
                        >
                          <span className="text-zinc-400 text-xs truncate">↳ {c.name}</span>
                          <EquipmentConditionBadge condition={c.condition} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
