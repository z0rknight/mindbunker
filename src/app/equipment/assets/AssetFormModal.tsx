"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEquipmentAsset, createEquipmentAssetFromAcquisition, updateEquipmentAsset } from "@/modules/equipment/actions";
import {
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CRITICALITIES,
  EQUIPMENT_CRITICALITY_LABELS,
  EQUIPMENT_DOMAINS,
  EQUIPMENT_DOMAIN_LABELS,
  EQUIPMENT_OWNERSHIPS,
  EQUIPMENT_OWNERSHIP_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
} from "@/modules/equipment/config";

type SystemOption = { id: number; name: string };
type AssetOption = { id: number; name: string };

// Wave 1 brief §8: "practical Add Asset flow, not 20 required fields."
// Name/Ownership/Domain/Category are the only required inputs, always
// visible; everything else lives behind a collapsed <details> disclosure
// so the common case (register a thing quickly) stays a 4-field form,
// while the complete record is still reachable in the same modal.
export function AssetFormModal({
  mode,
  asset,
  prefill,
  fromAcquisitionId,
  systems,
  otherAssets,
  triggerLabel,
  triggerClassName,
}: {
  mode: "create" | "edit";
  asset?: {
    id: number;
    name: string;
    ownership: string;
    domain: string;
    category: string;
    systemId: number | null;
    parentAssetId: number | null;
    location: string | null;
    assignedTo: string | null;
    status: string;
    condition: string;
    criticality: string;
    purchaseDate: string | null;
    purchasePrice: number | null;
    currentValue: number | null;
    replacementCost: number | null;
    warrantyUntil: string | null;
    serialNumber: string | null;
    notes: string | null;
  };
  // Create-mode-only initial values that aren't an edit target -- used by
  // "Create asset from acquisition" (Wave 2 §5) to pre-fill known fields
  // while still requiring the operator to review and submit explicitly.
  prefill?: {
    name?: string;
    ownership?: string;
    domain?: string;
    category?: string;
    systemId?: number | null;
    purchasePrice?: number | null;
    notes?: string | null;
  };
  fromAcquisitionId?: number;
  systems: SystemOption[];
  otherAssets: AssetOption[];
  triggerLabel: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState(asset?.name ?? prefill?.name ?? "");
  const [ownership, setOwnership] = useState(asset?.ownership ?? prefill?.ownership ?? "RMEDIA");
  const [domain, setDomain] = useState(asset?.domain ?? prefill?.domain ?? "COMPUTE");
  const [category, setCategory] = useState(asset?.category ?? prefill?.category ?? "");
  const [systemId, setSystemId] = useState(asset?.systemId?.toString() ?? prefill?.systemId?.toString() ?? "");
  const [parentAssetId, setParentAssetId] = useState(asset?.parentAssetId?.toString() ?? "");
  const [location, setLocation] = useState(asset?.location ?? "");
  const [assignedTo, setAssignedTo] = useState(asset?.assignedTo ?? "");
  const [status, setStatus] = useState(asset?.status ?? "ACTIVE");
  const [condition, setCondition] = useState(asset?.condition ?? "GOOD");
  const [criticality, setCriticality] = useState(asset?.criticality ?? "CONVENIENCE");
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate ?? "");
  const [purchasePrice, setPurchasePrice] = useState(asset?.purchasePrice?.toString() ?? prefill?.purchasePrice?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState(asset?.currentValue?.toString() ?? "");
  const [replacementCost, setReplacementCost] = useState(asset?.replacementCost?.toString() ?? "");
  const [warrantyUntil, setWarrantyUntil] = useState(asset?.warrantyUntil ?? "");
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? prefill?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        name,
        ownership,
        domain,
        category,
        systemId: systemId ? Number(systemId) : null,
        parentAssetId: parentAssetId ? Number(parentAssetId) : null,
        location: location || null,
        assignedTo: assignedTo || null,
        status,
        condition,
        criticality,
        purchaseDate: purchaseDate || null,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        currentValue: currentValue ? Number(currentValue) : null,
        replacementCost: replacementCost ? Number(replacementCost) : null,
        warrantyUntil: warrantyUntil || null,
        serialNumber: serialNumber || null,
        notes: notes || null,
      };

      const result =
        mode === "edit" && asset
          ? await updateEquipmentAsset(asset.id, input)
          : fromAcquisitionId != null
          ? await createEquipmentAssetFromAcquisition(fromAcquisitionId, input)
          : await createEquipmentAsset(input);

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
                {mode === "edit" ? "✏️ Edit Asset" : "🧰 Add Asset"}
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
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Mac mini M2 Pro" className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Ownership</label>
                  <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className={fieldClass}>
                    {EQUIPMENT_OWNERSHIPS.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_OWNERSHIP_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Domain</label>
                  <select value={domain} onChange={(e) => setDomain(e.target.value)} className={fieldClass}>
                    {EQUIPMENT_DOMAINS.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_DOMAIN_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="Workstation, HDD, Switch, Camera Body…" className={fieldClass} />
              </div>

              <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 open:pb-1">
                <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white">
                  More details (optional)
                </summary>
                <div className="space-y-4 px-3 pt-1 pb-2">
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
                      <label className={labelClass}>Parent Asset</label>
                      <select value={parentAssetId} onChange={(e) => setParentAssetId(e.target.value)} className={fieldClass}>
                        <option value="">— None —</option>
                        {otherAssets.filter((a) => a.id !== asset?.id).map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Location</label>
                      <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Home office" className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Assigned To</label>
                      <input type="text" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Emmanuel" className={fieldClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                        {EQUIPMENT_STATUSES.map((v) => (
                          <option key={v} value={v}>{EQUIPMENT_STATUS_LABELS[v]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Condition</label>
                      <select value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldClass}>
                        {EQUIPMENT_CONDITIONS.map((v) => (
                          <option key={v} value={v}>{EQUIPMENT_CONDITION_LABELS[v]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Criticality</label>
                      <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className={fieldClass}>
                        {EQUIPMENT_CRITICALITIES.map((v) => (
                          <option key={v} value={v}>{EQUIPMENT_CRITICALITY_LABELS[v]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Purchase Price</label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Current Value</label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Replacement Cost</label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" value={replacementCost} onChange={(e) => setReplacementCost(e.target.value)} className={fieldClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Purchase Date</label>
                      <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Warranty Until</label>
                      <input type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} className={fieldClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Serial Number</label>
                    <input type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={fieldClass} />
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
                {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Asset"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
