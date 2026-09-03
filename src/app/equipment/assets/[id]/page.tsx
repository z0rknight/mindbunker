import Link from "next/link";
import { notFound } from "next/navigation";
import { getEquipmentAsset, getEquipmentAssets, getEquipmentSystems } from "@/modules/equipment/actions";
import {
  DEFAULT_EQUIPMENT_CURRENCY,
  EQUIPMENT_DOMAIN_ICONS,
  EQUIPMENT_DOMAIN_LABELS,
  EQUIPMENT_MAINTENANCE_TYPE_LABELS,
  EQUIPMENT_OWNERSHIP_LABELS,
} from "@/modules/equipment/config";
import { formatCurrency, formatDate, todayISO } from "@/utils/date";
import { daysUntilIsoDate, isHighReplacementExposureContext } from "@/modules/equipment/core";
import {
  EquipmentConditionBadge,
  EquipmentCriticalityBadge,
  EquipmentStatusBadge,
  MaintenanceStatusBadge,
} from "@/components/equipment/EquipmentBadges";
import { AssetFormModal } from "../AssetFormModal";
import { MaintenanceEventFormModal } from "../MaintenanceEventFormModal";
import { DeleteMaintenanceEventButton } from "../DeleteMaintenanceEventButton";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white text-sm mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

export default async function EquipmentAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assetId = Number(id);
  if (!Number.isFinite(assetId)) notFound();

  const [record, allAssets, systemsWithCost] = await Promise.all([
    getEquipmentAsset(assetId),
    getEquipmentAssets(),
    getEquipmentSystems(),
  ]);
  if (!record) notFound();

  const { asset, system, children, parent, maintenanceEvents, maintenanceStatus, recordedTco } = record;
  const currency = DEFAULT_EQUIPMENT_CURRENCY;
  const systems = systemsWithCost.map(({ system: s }) => ({ id: s.id, name: s.name }));
  const assetOptions = allAssets.map((a) => ({ id: a.id, name: a.name }));
  const mostRecentEvent = maintenanceEvents[0] ?? null;
  const today = todayISO();
  const nextInspectionDays = mostRecentEvent?.nextInspection
    ? daysUntilIsoDate(mostRecentEvent.nextInspection, today)
    : null;
  const highReplacementExposure = isHighReplacementExposureContext(asset);
  // Wave 3 §3: "make what needs action next obvious... do not bury
  // below financial fields." Surfaced as one banner directly under
  // IDENTITY, only when there's something genuinely actionable --
  // overdue maintenance or CRITICAL condition -- never a fabricated
  // urgency for e.g. a merely-expired warranty on a fine asset.
  const needsTopBanner = maintenanceStatus === "OVERDUE" || asset.condition === "CRITICAL";

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/equipment/assets" className="text-zinc-500 hover:text-white text-xs font-semibold">← Asset Registry</Link>

      {/* IDENTITY */}
      <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {asset.assetCode} · {EQUIPMENT_OWNERSHIP_LABELS[asset.ownership]} · {EQUIPMENT_DOMAIN_ICONS[asset.domain]} {EQUIPMENT_DOMAIN_LABELS[asset.domain]} · {asset.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EquipmentStatusBadge status={asset.status} />
          <EquipmentConditionBadge condition={asset.condition} />
          <EquipmentCriticalityBadge criticality={asset.criticality} />
        </div>
      </div>

      {/* TOP-PRIORITY ACTION BANNER -- Wave 3 §3: overdue maintenance or
          CRITICAL condition surfaces here, above everything else,
          never buried below financial fields. */}
      {needsTopBanner && (
        <div className="mb-4 rounded-xl border border-red-800/60 bg-red-950/20 px-4 py-3 text-sm text-red-300 font-semibold">
          {[
            asset.condition === "CRITICAL" && "Condition: Critical",
            maintenanceStatus === "OVERDUE" &&
              (nextInspectionDays != null
                ? `Maintenance overdue by ${Math.abs(nextInspectionDays)} day${Math.abs(nextInspectionDays) === 1 ? "" : "s"}`
                : "Maintenance overdue"),
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* AT A GLANCE -- answers WHERE/WHO/WHAT-IT'S-PART-OF/WHAT'S-NEXT
          without reading the rest of the page (Wave 2 brief §2). */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Location</p>
          <p className="text-white text-sm mt-0.5 truncate">{asset.location ?? "Not recorded"}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Assigned To</p>
          <p className="text-white text-sm mt-0.5 truncate">{asset.assignedTo ?? "Not recorded"}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Part Of</p>
          <p className="text-white text-sm mt-0.5 truncate">
            {system ? <Link href={`/equipment/systems/${system.id}`} className="text-violet-400 hover:text-violet-300">{system.name}</Link> : "No system"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">What&rsquo;s Next</p>
          <MaintenanceStatusBadge status={maintenanceStatus} />
          {/* Wave 3 §5: signed day count derived from the same recorded
              nextInspection date -- "X days overdue" / "X days until
              due", never a prediction. */}
          {nextInspectionDays != null && (nextInspectionDays < 0 || maintenanceStatus === "DUE_SOON" || maintenanceStatus === "SCHEDULED") && (
            <p className="text-zinc-500 text-xs mt-1">
              {nextInspectionDays < 0
                ? `${Math.abs(nextInspectionDays)} day${Math.abs(nextInspectionDays) === 1 ? "" : "s"} overdue`
                : nextInspectionDays === 0
                ? "Due today"
                : `${nextInspectionDays} day${nextInspectionDays === 1 ? "" : "s"} until due`}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <AssetFormModal
          mode="edit"
          asset={asset}
          systems={systems}
          otherAssets={assetOptions}
          triggerLabel="✏️ Edit Asset"
          triggerClassName="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* OPERATIONAL CONTEXT */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Operational Context</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Location" value={asset.location} />
              <Field label="Assigned To" value={asset.assignedTo} />
              <Field
                label="System"
                value={system ? <Link href={`/equipment/systems/${system.id}`} className="text-violet-400 hover:text-violet-300">{system.name}</Link> : "—"}
              />
              <Field
                label="Parent Asset"
                value={parent ? <Link href={`/equipment/assets/${parent.id}`} className="text-violet-400 hover:text-violet-300">{parent.name}</Link> : "—"}
              />
              <Field label="Warranty Until" value={asset.warrantyUntil ? formatDate(asset.warrantyUntil) : null} />
              <Field
                label="Next Maintenance Signal"
                value={mostRecentEvent?.nextInspection ? formatDate(mostRecentEvent.nextInspection) : null}
              />
            </div>
          </section>

          {/* FINANCIAL CONTEXT */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Financial Context</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Purchase Date" value={asset.purchaseDate ? formatDate(asset.purchaseDate) : null} />
              <Field label="Purchase Price" value={asset.purchasePrice != null ? formatCurrency(asset.purchasePrice, currency) : null} />
              <Field label="Current Value" value={asset.currentValue != null ? formatCurrency(asset.currentValue, currency) : null} />
              <Field label="Replacement Cost" value={asset.replacementCost != null ? formatCurrency(asset.replacementCost, currency) : null} />
            </div>
            {/* Wave 3 §6: a single-tier factual label, never a numeric
                risk score -- shown only when replacement cost, criticality,
                and condition ALL independently support it. */}
            {highReplacementExposure && (
              <p className="mt-3 inline-block rounded-full border border-amber-700/50 bg-amber-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                Replacement Exposure — High Context
              </p>
            )}
            {recordedTco && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Recorded TCO</p>
                <p className="text-white text-lg font-bold">{formatCurrency(recordedTco.total, currency)}</p>
                <p className="text-zinc-600 text-xs mt-0.5">
                  Purchase {formatCurrency(recordedTco.purchasePrice, currency)}
                  {" + "}Maintenance {formatCurrency(recordedTco.maintenanceCost, currency)}
                  {recordedTco.maintenanceCostCount === 0 && " (none logged)"}
                  {" — recorded, not an estimated lifetime cost"}
                </p>
              </div>
            )}
          </section>

          {/* HISTORY */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Maintenance History {maintenanceEvents.length > 0 && `(${maintenanceEvents.length})`}
              </h2>
              <MaintenanceEventFormModal
                mode="create"
                assetId={asset.id}
                triggerLabel="+ Log Maintenance"
                triggerClassName="rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold px-3 py-1.5 text-xs transition-colors cursor-pointer"
              />
            </div>
            {maintenanceEvents.length === 0 ? (
              <p className="text-zinc-600 text-sm py-4 text-center">No maintenance logged yet. This is unknown, not healthy.</p>
            ) : (
              <div className="space-y-3">
                {maintenanceEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">
                          {EQUIPMENT_MAINTENANCE_TYPE_LABELS[event.type as keyof typeof EQUIPMENT_MAINTENANCE_TYPE_LABELS] ?? event.type}
                          <span className="text-zinc-500 font-normal"> · {formatDate(event.performedAt)}</span>
                        </p>
                        {event.issue && <p className="text-zinc-400 text-xs mt-1">Issue: {event.issue}</p>}
                        {event.action && <p className="text-zinc-400 text-xs">Action: {event.action}</p>}
                        {event.result && <p className="text-zinc-400 text-xs">Result: {event.result}</p>}
                        {event.nextInspection && (
                          <p className="text-zinc-500 text-xs mt-1">Next inspection: {formatDate(event.nextInspection)}</p>
                        )}
                        {event.notes && <p className="text-zinc-500 text-xs mt-1 whitespace-pre-wrap">{event.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        {event.cost != null && (
                          <span className="text-zinc-300 text-xs font-semibold">{formatCurrency(event.cost, currency)}</span>
                        )}
                        <MaintenanceEventFormModal
                          mode="edit"
                          assetId={asset.id}
                          event={event}
                          triggerLabel="Edit"
                          triggerClassName="text-zinc-600 hover:text-white text-xs transition-colors cursor-pointer"
                        />
                        <DeleteMaintenanceEventButton id={event.id} assetId={asset.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* COMPOSITE ASSETS -- one level only (Wave 1/2: no recursive
              tree editor). */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Components {children.length > 0 && `(${children.length})`}
            </h2>
            {children.length === 0 ? (
              <p className="text-zinc-600 text-sm">
                {parent ? "This asset has no sub-components of its own." : "No components recorded under this asset."}
              </p>
            ) : (
              <div className="space-y-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/equipment/assets/${child.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 hover:border-zinc-700 transition-colors"
                  >
                    <span className="text-zinc-300 text-sm truncate">{child.name}</span>
                    <EquipmentConditionBadge condition={child.condition} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* AUDIT / NOTES */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Audit / Notes</h2>
            <div className="space-y-3">
              <Field label="Serial Number" value={asset.serialNumber} />
              {asset.notes && (
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{asset.notes}</p>
                </div>
              )}
              <Field label="Recorded" value={formatDate(new Date(asset.createdAt).toISOString().slice(0, 10))} />
              {asset.updatedAt && (
                <Field label="Last Updated" value={formatDate(new Date(asset.updatedAt).toISOString().slice(0, 10))} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
