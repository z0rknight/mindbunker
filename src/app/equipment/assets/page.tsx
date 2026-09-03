import Link from "next/link";
import { getEquipmentAssets, getEquipmentSystems } from "@/modules/equipment/actions";
import {
  EQUIPMENT_DOMAINS,
  EQUIPMENT_DOMAIN_ICONS,
  EQUIPMENT_DOMAIN_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_CONDITION_LABELS,
  DEFAULT_EQUIPMENT_CURRENCY,
  isEquipmentDomain,
  isEquipmentOwnership,
  isEquipmentStatus,
  isEquipmentCondition,
  type EquipmentOwnership,
  type EquipmentDomain,
  type EquipmentStatus,
  type EquipmentCondition,
} from "@/modules/equipment/config";
import { matchesEquipmentSearch } from "@/modules/equipment/core";
import { formatCurrency } from "@/utils/date";
import { OwnershipTabs } from "../OwnershipTabs";
import { AssetFormModal } from "./AssetFormModal";
import {
  EquipmentConditionBadge,
  EquipmentStatusBadge,
} from "@/components/equipment/EquipmentBadges";

export const dynamic = "force-dynamic";

export default async function EquipmentAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ ownership?: string; domain?: string; status?: string; condition?: string; q?: string }>;
}) {
  const query = await searchParams;
  const ownership: EquipmentOwnership | undefined = isEquipmentOwnership(query.ownership)
    ? query.ownership
    : undefined;
  const domain: EquipmentDomain | undefined = isEquipmentDomain(query.domain) ? query.domain : undefined;
  const status: EquipmentStatus | undefined = isEquipmentStatus(query.status) ? query.status : undefined;
  const condition: EquipmentCondition | undefined = isEquipmentCondition(query.condition) ? query.condition : undefined;
  const searchText = query.q?.trim() ?? "";

  const [assets, systemsWithCost] = await Promise.all([
    getEquipmentAssets(ownership),
    getEquipmentSystems(),
  ]);

  const systems = systemsWithCost.map(({ system }) => ({ id: system.id, name: system.name }));
  const systemNameById = new Map(systems.map((s) => [s.id, s.name] as const));

  // Wave 3 §10: lightweight search + filters. Ownership is already
  // applied at the DB query above; domain/status/condition and the
  // text search all compose here as plain array filters -- no
  // combinatorial filter engine, just successive narrowing.
  let filtered = domain ? assets.filter((a) => a.domain === domain) : assets;
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (condition) filtered = filtered.filter((a) => a.condition === condition);
  if (searchText) {
    filtered = filtered.filter((a) =>
      matchesEquipmentSearch(a, a.systemId != null ? systemNameById.get(a.systemId) ?? null : null, searchText),
    );
  }
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const assetOptions = assets.map((a) => ({ id: a.id, name: a.name }));
  const currency = DEFAULT_EQUIPMENT_CURRENCY;

  function buildHref(overrides: { domain?: EquipmentDomain; status?: EquipmentStatus; condition?: EquipmentCondition }) {
    const params = new URLSearchParams();
    if (ownership) params.set("ownership", ownership);
    const nextDomain = "domain" in overrides ? overrides.domain : domain;
    const nextStatus = "status" in overrides ? overrides.status : status;
    const nextCondition = "condition" in overrides ? overrides.condition : condition;
    if (nextDomain) params.set("domain", nextDomain);
    if (nextStatus) params.set("status", nextStatus);
    if (nextCondition) params.set("condition", nextCondition);
    if (searchText) params.set("q", searchText);
    const qs = params.toString();
    return `/equipment/assets${qs ? `?${qs}` : ""}`;
  }

  function domainHref(d: EquipmentDomain | undefined) {
    return buildHref({ domain: d });
  }
  function statusHref(s: EquipmentStatus | undefined) {
    return buildHref({ status: s });
  }
  function conditionHref(c: EquipmentCondition | undefined) {
    return buildHref({ condition: c });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/equipment" className="text-zinc-500 hover:text-white text-xs font-semibold">← Equipment</Link>
          <h1 className="text-2xl font-bold text-white mt-1">📋 Asset Registry</h1>
          <p className="text-zinc-500 text-sm mt-1">{sorted.length} of {assets.length} asset{assets.length === 1 ? "" : "s"} shown</p>
        </div>
        <AssetFormModal
          mode="create"
          systems={systems}
          otherAssets={assetOptions}
          triggerLabel="+ Add Asset"
          triggerClassName="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
        />
      </div>

      {/* Wave 3 §10: search across name/asset code/serial/category/system
          name -- a plain GET form so it works without client JS, and
          composes with whatever filters are already in the URL. */}
      <form action="/equipment/assets" method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {ownership && <input type="hidden" name="ownership" value={ownership} />}
        {domain && <input type="hidden" name="domain" value={domain} />}
        {status && <input type="hidden" name="status" value={status} />}
        {condition && <input type="hidden" name="condition" value={condition} />}
        <input
          type="text"
          name="q"
          defaultValue={searchText}
          placeholder="Search name, code, serial, category, system…"
          className="w-full sm:w-80 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          Search
        </button>
        {searchText && (
          <Link href={buildHref({})} className="text-zinc-500 hover:text-white text-xs font-semibold">
            Clear search
          </Link>
        )}
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <OwnershipTabs active={ownership ?? "ALL"} basePath="/equipment/assets" />
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={domainHref(undefined)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              !domain ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
            }`}
          >
            All Domains
          </Link>
          {EQUIPMENT_DOMAINS.map((d) => (
            <Link
              key={d}
              href={domainHref(d)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                domain === d ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
              }`}
            >
              {EQUIPMENT_DOMAIN_ICONS[d]} {EQUIPMENT_DOMAIN_LABELS[d]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wide mr-1">Status</span>
          <Link
            href={statusHref(undefined)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              !status ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
            }`}
          >
            All
          </Link>
          {EQUIPMENT_STATUSES.map((s) => (
            <Link
              key={s}
              href={statusHref(s)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                status === s ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
              }`}
            >
              {EQUIPMENT_STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wide mr-1">Condition</span>
          <Link
            href={conditionHref(undefined)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              !condition ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
            }`}
          >
            All
          </Link>
          {EQUIPMENT_CONDITIONS.map((c) => (
            <Link
              key={c}
              href={conditionHref(c)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                condition === c ? "border-violet-600/30 bg-violet-600/20 text-violet-300" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white"
              }`}
            >
              {EQUIPMENT_CONDITION_LABELS[c]}
            </Link>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-16 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            {assets.length === 0
              ? "No equipment recorded yet."
              : searchText
              ? `No assets match "${searchText}" with the current filters.`
              : "No assets match this filter."}
          </p>
          {assets.length === 0 && (
            <AssetFormModal
              mode="create"
              systems={systems}
              otherAssets={assetOptions}
              triggerLabel="+ Add First Asset"
              triggerClassName="inline-block rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 py-2.5 text-sm transition-colors cursor-pointer"
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                <th className="py-2.5 px-3 font-medium">Asset</th>
                <th className="py-2.5 px-3 font-medium">Ownership</th>
                <th className="py-2.5 px-3 font-medium">Domain / Category</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Condition</th>
                <th className="py-2.5 px-3 font-medium">Location</th>
                <th className="py-2.5 px-3 font-medium text-right">Purchase Price</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((asset) => (
                <tr key={asset.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900">
                  <td className="py-2.5 px-3">
                    <Link href={`/equipment/assets/${asset.id}`} className="text-white hover:text-violet-300 font-medium">
                      {asset.name}
                    </Link>
                    <p className="text-zinc-600 text-xs">{asset.assetCode}{asset.parentAssetId ? " · component" : ""}</p>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">{asset.ownership}</td>
                  <td className="py-2.5 px-3 text-zinc-400">
                    {EQUIPMENT_DOMAIN_ICONS[asset.domain]} {EQUIPMENT_DOMAIN_LABELS[asset.domain]}
                    <span className="text-zinc-600"> · {asset.category}</span>
                  </td>
                  <td className="py-2.5 px-3"><EquipmentStatusBadge status={asset.status} /></td>
                  <td className="py-2.5 px-3"><EquipmentConditionBadge condition={asset.condition} /></td>
                  <td className="py-2.5 px-3 text-zinc-500">{asset.location ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right text-zinc-300">
                    {asset.purchasePrice != null ? formatCurrency(asset.purchasePrice, currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
