import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { getEquipmentOverview } from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_DOMAIN_ICONS,
  EQUIPMENT_DOMAIN_LABELS,
  EQUIPMENT_SYSTEM_STATUS_LABELS,
  isEquipmentOwnership,
  type EquipmentOwnership,
} from "@/modules/equipment/config";
import type { MoneyCoverage } from "@/modules/equipment/core";
import { formatCurrency } from "@/utils/date";
import { OwnershipTabs } from "./OwnershipTabs";
import {
  EquipmentConditionBadge,
  EquipmentStatusBadge,
} from "@/components/equipment/EquipmentBadges";

export const dynamic = "force-dynamic";

// Wave 1 brief §10: "Current value / R$ 12,400 / 8 / 13 assets valued"
// over false certainty -- missing data stays visibly missing rather than
// silently defaulting to purchase price (unknown current value) or zero
// (unknown replacement cost).
function coverageSub(coverage: MoneyCoverage): string {
  if (coverage.countableCount === 0) return "No assets yet";
  return `${coverage.valuedCount} / ${coverage.countableCount} assets valued`;
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ ownership?: string }>;
}) {
  const query = await searchParams;
  const ownership: EquipmentOwnership | undefined = isEquipmentOwnership(query.ownership)
    ? query.ownership
    : undefined;

  const { assets, systems, summary, byDomain, attention, nextAcquisitions, maintenanceSummary } = await getEquipmentOverview(ownership);
  const currency = DEFAULT_EQUIPMENT_CURRENCY;
  const maxDomainTotal = Math.max(1, ...byDomain.map((d) => d.coverage.total));

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🧰 Equipment</h1>
          <p className="text-zinc-500 text-sm mt-1">
            The operational and patrimonial registry of RMedia &amp; personal physical infrastructure.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/equipment/systems"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            🧩 Systems
          </Link>
          <Link
            href="/equipment/assets"
            className="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2 text-xs uppercase tracking-wide transition-colors"
          >
            📋 Asset Registry
          </Link>
        </div>
      </div>

      {/* FILTER */}
      <div className="mb-6">
        <OwnershipTabs active={ownership ?? "ALL"} basePath="/equipment" />
      </div>

      {/* SUMMARY */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Invested"
          value={formatCurrency(summary.totalInvested.total, currency)}
          sub={coverageSub(summary.totalInvested)}
          accent="violet"
          icon="💰"
        />
        <StatCard
          label="Current Value"
          value={formatCurrency(summary.currentValue.total, currency)}
          sub={coverageSub(summary.currentValue)}
          accent="blue"
          icon="📉"
        />
        <StatCard
          label="Replacement Exposure"
          value={formatCurrency(summary.replacementExposure.total, currency)}
          sub={coverageSub(summary.replacementExposure)}
          accent="amber"
          icon="🛡️"
        />
        <StatCard
          label="Active Assets"
          value={summary.activeCount}
          accent="green"
          icon="✅"
        />
        <StatCard
          label="Needs Attention"
          value={summary.needsAttentionCount}
          accent={summary.needsAttentionCount > 0 ? "red" : "zinc"}
          icon="⚠️"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SYSTEM HEALTH / STATUS */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Systems
            </h2>
            <Link href="/equipment/systems" className="text-violet-400 hover:text-violet-300 text-xs font-semibold">
              View all →
            </Link>
          </div>
          {systems.length === 0 ? (
            <p className="text-zinc-600 text-sm py-6 text-center">
              No systems recorded yet. Systems group assets by operational setup (e.g. &ldquo;RMedia Editing Suite&rdquo;).
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {systems.map(({ system, invested, memberCount }) => (
                <Link
                  key={system.id}
                  href={`/equipment/systems/${system.id}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-white font-semibold text-sm truncate">{system.name}</p>
                    <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
                      {EQUIPMENT_SYSTEM_STATUS_LABELS[system.status]}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs">{memberCount} member{memberCount === 1 ? "" : "s"}</p>
                  <p className="text-zinc-300 text-sm font-semibold mt-1">
                    {invested.valuedCount > 0 ? formatCurrency(invested.total, currency) : "No priced members"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ATTENTION -- Wave 2 §4: ranked CRITICAL > ATTENTION > DUE_SOON,
            derived from condition + overdue/due-soon maintenance +
            expired warranty (computeAttentionItems), every item shows
            WHY it's here, never a bare "needs attention". Wave 3 §2: this
            panel should dominate ONLY when something genuinely needs
            action -- a colored left border when populated, otherwise a
            calm, explicit "nothing needs attention" statement rather than
            an empty panel that reads as broken or as a scary gap. */}
        <section
          className={`rounded-xl border bg-zinc-900/60 p-4 ${
            attention.some((i) => i.severity === "CRITICAL")
              ? "border-red-800/60"
              : attention.some((i) => i.severity === "ATTENTION")
              ? "border-amber-800/60"
              : "border-zinc-800"
          }`}
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Needs Attention {attention.length > 0 && `(${attention.length})`}
          </h2>
          {attention.length === 0 ? (
            <p className="text-emerald-400/80 text-sm py-6 text-center">No equipment needs attention.</p>
          ) : (
            <div className="space-y-2">
              {attention.slice(0, 8).map((item) => (
                <Link
                  key={item.assetId}
                  href={`/equipment/assets/${item.assetId}`}
                  className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    item.severity === "CRITICAL"
                      ? "border-red-900/50 bg-red-950/20 hover:border-red-700"
                      : item.severity === "ATTENTION"
                      ? "border-amber-900/50 bg-amber-950/10 hover:border-amber-700"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200 text-sm font-medium truncate">{item.asset.name}</p>
                    <p className="text-zinc-500 text-xs truncate">{item.reasons.join(" · ")}</p>
                  </div>
                  <EquipmentConditionBadge condition={item.asset.condition} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MAINTENANCE -- Wave 3 §5: deterministic summary only. Overdue/due
          -soon counts come from the same computeMaintenanceStatus map the
          ATTENTION panel above already uses; recorded cost sums only
          logged maintenance events from the last 365 days. No
          predictions, no failure probability, no score. */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 shrink-0">
            Maintenance
          </h2>
          <span className={`text-sm font-semibold ${maintenanceSummary.overdueCount > 0 ? "text-red-400" : "text-zinc-500"}`}>
            {maintenanceSummary.overdueCount} overdue
          </span>
          <span className={`text-sm font-semibold ${maintenanceSummary.dueSoonCount > 0 ? "text-amber-400" : "text-zinc-500"}`}>
            {maintenanceSummary.dueSoonCount} due soon
          </span>
          <span className="text-sm text-zinc-400">
            {formatCurrency(maintenanceSummary.recentCost, currency)} recorded cost
            <span className="text-zinc-600"> · 12 months ({maintenanceSummary.recentEventCount} event{maintenanceSummary.recentEventCount === 1 ? "" : "s"})</span>
          </span>
        </div>
      </div>

      {/* NEXT ACQUISITIONS -- Wave 2 §11: pulled from the real pipeline,
          ranked deterministically (priority, then requiredBy, then age).
          No AI recommendations, no invented probabilities. */}
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Next Acquisitions
          </h2>
          <Link href="/equipment/acquisitions" className="text-violet-400 hover:text-violet-300 text-xs font-semibold">
            Full pipeline →
          </Link>
        </div>
        {nextAcquisitions.length === 0 ? (
          <p className="text-zinc-600 text-sm py-6 text-center">Nothing in the pipeline right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nextAcquisitions.map((acq) => (
              <Link
                key={acq.id}
                href={`/equipment/acquisitions/${acq.id}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-white font-semibold text-sm truncate">{acq.name}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      acq.priority === "CRITICAL"
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : acq.priority === "HIGH"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {acq.priority}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs truncate">{acq.problem}</p>
                <p className="text-zinc-600 text-xs mt-1">
                  {acq.stage}{acq.requiredBy ? ` · needed by ${acq.requiredBy}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* INVESTMENT BY DOMAIN */}
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Investment by Domain
        </h2>
        {byDomain.length === 0 ? (
          <p className="text-zinc-600 text-sm py-6 text-center">No priced assets recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {byDomain.map((d) => (
              <div key={d.domain}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">
                    {EQUIPMENT_DOMAIN_ICONS[d.domain]} {EQUIPMENT_DOMAIN_LABELS[d.domain]}
                    <span className="text-zinc-600"> · {d.assetCount} asset{d.assetCount === 1 ? "" : "s"}</span>
                  </span>
                  <span className="text-zinc-400 font-semibold">
                    {formatCurrency(d.coverage.total, currency)}
                    {d.coverage.valuedCount < d.coverage.countableCount && (
                      <span className="text-zinc-600"> ({d.coverage.valuedCount}/{d.coverage.countableCount} valued)</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700"
                    style={{ width: `${Math.max(2, (d.coverage.total / maxDomainTotal) * 100)}%` }}
                  />
                </div>
                {/* Wave 3 §9: recorded current value / replacement exposure
                    coverage per domain, alongside the invested total above
                    -- "Where is capital concentrated?" without ROI or any
                    recommendation. Coverage counts always shown so partial
                    valuation stays visible rather than reading as R$0. */}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-600">
                  <span>
                    Current Value{" "}
                    {d.currentValue.valuedCount > 0 ? formatCurrency(d.currentValue.total, currency) : "—"}
                    {" "}({d.currentValue.valuedCount}/{d.currentValue.countableCount} assets valued)
                  </span>
                  <span>
                    Replacement Exposure{" "}
                    {d.replacementExposure.valuedCount > 0 ? formatCurrency(d.replacementExposure.total, currency) : "—"}
                    {" "}({d.replacementExposure.valuedCount}/{d.replacementExposure.countableCount} assets covered)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ASSET / INFRASTRUCTURE AREA */}
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Recently Added
          </h2>
          <Link href="/equipment/assets" className="text-violet-400 hover:text-violet-300 text-xs font-semibold">
            Full registry →
          </Link>
        </div>
        {assets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-zinc-500 text-sm mb-3">
              No equipment recorded yet. Add the first asset to start the registry.
            </p>
            <Link
              href="/equipment/assets"
              className="inline-block rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2 text-xs uppercase tracking-wide transition-colors"
            >
              + Add Asset
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Asset</th>
                  <th className="py-2 pr-3 font-medium">Domain</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Condition</th>
                  <th className="py-2 pr-3 font-medium text-right">Purchase Price</th>
                </tr>
              </thead>
              <tbody>
                {[...assets]
                  .sort((a, b) => b.id - a.id)
                  .slice(0, 8)
                  .map((asset) => (
                    <tr key={asset.id} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                      <td className="py-2 pr-3">
                        <Link href={`/equipment/assets/${asset.id}`} className="text-white hover:text-violet-300 font-medium">
                          {asset.name}
                        </Link>
                        <p className="text-zinc-600 text-xs">{asset.assetCode}</p>
                      </td>
                      <td className="py-2 pr-3 text-zinc-400">
                        {EQUIPMENT_DOMAIN_ICONS[asset.domain]} {EQUIPMENT_DOMAIN_LABELS[asset.domain]}
                      </td>
                      <td className="py-2 pr-3"><EquipmentStatusBadge status={asset.status} /></td>
                      <td className="py-2 pr-3"><EquipmentConditionBadge condition={asset.condition} /></td>
                      <td className="py-2 pr-3 text-right text-zinc-300">
                        {asset.purchasePrice != null ? formatCurrency(asset.purchasePrice, currency) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
