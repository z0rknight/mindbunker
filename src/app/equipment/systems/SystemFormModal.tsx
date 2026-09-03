"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEquipmentSystem, updateEquipmentSystem } from "@/modules/equipment/actions";
import {
  EQUIPMENT_OWNERSHIPS,
  EQUIPMENT_OWNERSHIP_LABELS,
  EQUIPMENT_SYSTEM_STATUSES,
  EQUIPMENT_SYSTEM_STATUS_LABELS,
} from "@/modules/equipment/config";

export function SystemFormModal({
  mode,
  system,
  triggerLabel,
  triggerClassName,
}: {
  mode: "create" | "edit";
  system?: {
    id: number;
    name: string;
    ownership: string;
    description: string | null;
    status: string;
    location: string | null;
  };
  triggerLabel: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState(system?.name ?? "");
  const [ownership, setOwnership] = useState(system?.ownership ?? "RMEDIA");
  const [description, setDescription] = useState(system?.description ?? "");
  const [status, setStatus] = useState(system?.status ?? "ACTIVE");
  const [location, setLocation] = useState(system?.location ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, ownership, description: description || null, status, location: location || null };
      const result =
        mode === "edit" && system
          ? await updateEquipmentSystem(system.id, input)
          : await createEquipmentSystem(input);

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
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">
                {mode === "edit" ? "✏️ Edit System" : "🧩 Add System"}
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
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="RMedia Editing Suite" className={fieldClass} />
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
                  <label className={labelClass}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                    {EQUIPMENT_SYSTEM_STATUSES.map((v) => (
                      <option key={v} value={v}>{EQUIPMENT_SYSTEM_STATUS_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Home office rack" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldClass} />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Create System"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
