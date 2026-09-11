import Link from "next/link";
import { getClientsAndProjectsForIngest } from "@/modules/production-orders/data";
import { IngestForm } from "./IngestForm";

export const dynamic = "force-dynamic";

export default async function NewProductionOrderPage() {
  const { clients, projects } = await getClientsAndProjectsForIngest();

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-500">
              LET&apos;S COOK
            </p>
            <h1 className="font-mono text-xl font-black text-emerald-300">New Production Order</h1>
          </div>
          <Link
            href="/productivity/orders"
            className="font-mono text-xs text-zinc-500 hover:text-emerald-400"
          >
            ← Orders
          </Link>
        </div>
        <IngestForm clients={clients} projects={projects} />
      </div>
    </div>
  );
}
