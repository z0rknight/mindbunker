import Link from "next/link";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getCommercialContracts } from "@/modules/finance/actions";
import { getAllClients } from "@/modules/crm/actions";
import { AddContractButton } from "./AddContractButton";

export const dynamic = "force-dynamic";

// Monday Money Lab P0 §2/§6: minimum commercial-contract list. Billing
// evidence, reconciliation, and money-linking all live one level down at
// /finance/contracts/[id] — this page is deliberately just a directory.
export default async function ContractsPage() {
  const [contracts, clients] = await Promise.all([
    getCommercialContracts(),
    getAllClients(),
  ]);

  return (
    <div className={`${OPERATOR_WORKSPACE_CLASS} max-w-4xl`}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
          <h1 className="text-2xl font-bold text-white mt-1">🧾 Commercial Contracts</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Billing truth — what clients/platforms actually bill. Never mutates Work Sessions.
          </p>
        </div>
        <AddContractButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      {contracts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">
            No commercial contracts yet. Add one — e.g. Taryn Dubreuil / Upwork / HOURLY / USD 25.00.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/finance/contracts/${c.id}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-violet-700/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold text-sm">{c.clientName} — {c.platform}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.status === "ACTIVE"
                    ? "bg-emerald-900/50 text-emerald-400"
                    : c.status === "PAUSED"
                    ? "bg-amber-900/50 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}>
                  {c.status}
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-1">
                {c.billingType === "HOURLY"
                  ? `HOURLY · ${c.currency} ${c.hourlyRate?.toFixed(2)}/hour`
                  : `FIXED · ${c.currency}`}
                {c.externalReference ? ` · ${c.externalReference}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
