"use client";

import { useState } from "react";
import { ProductionMemoryDetails, ProductionMemoryStatusBadge } from "@/components/production-memory/ProductionMemoryDetails";
import type { ProductionMemoryRecord } from "@/modules/production-memory/data";
import { DeleteMemoryButton, ProductionMemoryEditor, type EditorMemory } from "./ProductionMemoryEditor";

// The client's production memory: the ONE place these records are managed.
// Project and Production Order pages read them contextually (FormatsForClient).
// Deliberately not a "Vault"/library: "Vault" already names the client-facing
// portal in this product, and this is operator-only reusable memory.
export function ProductionMemoryPanel({
  clientId,
  memories,
  videoOptions,
}: {
  clientId: number;
  memories: ProductionMemoryRecord[];
  videoOptions: Array<{ id: number; title: string }>;
}) {
  const [editingId, setEditingId] = useState<number | "new" | null>(null);

  return (
    <section id="production-memory" className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4" data-testid="production-memory-panel">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Production memory</h2>
        {editingId === null && (
          <button type="button" onClick={() => setEditingId("new")} className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-300">
            + Add format
          </button>
        )}
      </div>
      <p className="mb-3 text-[11px] text-zinc-600">
        What to remember when producing this kind of work for this client. Operator-only; not the current job&apos;s brief.
      </p>

      {editingId === "new" && (
        <div className="mb-3">
          <ProductionMemoryEditor clientId={clientId} memory={null} videoOptions={videoOptions} onDone={() => setEditingId(null)} />
        </div>
      )}

      {memories.length === 0 && editingId !== "new" && (
        <p className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-600">No formats recorded for this client yet.</p>
      )}

      <div className="space-y-2">
        {memories.map((memory) => {
          const editable: EditorMemory = { ...memory, referenceVideoId: memory.referenceVideo?.id ?? null };
          return editingId === memory.id ? (
            <ProductionMemoryEditor key={memory.id} clientId={clientId} memory={editable} videoOptions={videoOptions} onDone={() => setEditingId(null)} />
          ) : (
            <details key={memory.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm font-bold text-zinc-100">
                {memory.name}
                <ProductionMemoryStatusBadge status={memory.status} />
              </summary>
              <div className="space-y-3 border-t border-zinc-800 p-3">
                <ProductionMemoryDetails memory={memory} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingId(memory.id)} className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:text-cyan-300">
                    Edit
                  </button>
                  <DeleteMemoryButton clientId={clientId} id={memory.id} name={memory.name} />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
