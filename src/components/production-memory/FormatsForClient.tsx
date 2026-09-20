import Link from "next/link";
import type { ProductionMemoryRecord } from "@/modules/production-memory/data";
import { ProductionMemoryDetails, ProductionMemoryStatusBadge } from "./ProductionMemoryDetails";

// Hot-path affordance for the Project and Production Order pages: a compact,
// collapsed "Formats for <client> (N)" that READS the client-owned memories.
// Never a gate before work; renders nothing when the client has none. One
// click opens the list, a second opens a format -- the edit surface stays in
// the CRM dossier (the client owns the record).
export function FormatsForClient({
  clientId,
  clientName,
  memories,
}: {
  clientId: number;
  clientName: string;
  memories: ProductionMemoryRecord[];
}) {
  if (memories.length === 0) return null;
  return (
    <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 font-mono" data-testid="formats-for-client">
      <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-200">
        Formats for {clientName} ({memories.length})
      </summary>
      <div className="space-y-2 border-t border-zinc-800 p-3">
        {memories.map((memory) => (
          <details key={memory.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm font-bold text-zinc-100">
              {memory.name}
              <ProductionMemoryStatusBadge status={memory.status} />
            </summary>
            <div className="border-t border-zinc-800 p-3">
              <ProductionMemoryDetails memory={memory} />
            </div>
          </details>
        ))}
        <Link
          href={`/crm/${clientId}#production-memory`}
          className="inline-block text-[11px] font-bold text-zinc-500 hover:text-cyan-300"
        >
          Manage in CRM →
        </Link>
      </div>
    </details>
  );
}
