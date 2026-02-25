import { getClientById } from "@/modules/crm/actions";
import { formatCurrency, formatDate } from "@/utils/date";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClientTabs } from "./ClientTabs";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = parseInt(params.id, 10);
  if (isNaN(clientId)) {
    notFound();
  }

  const client = await getClientById(clientId);
  if (!client) {
    notFound();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/crm"
          className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
        >
          ← Back to CRM
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">{client.name}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span
            className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded ${
              client.status === "active"
                ? "bg-emerald-500/20 text-emerald-400"
                : client.status === "lead"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-zinc-500/20 text-zinc-400"
            }`}
          >
            {client.status}
          </span>
          {client.source && (
            <span className="text-zinc-500 text-xs">via {client.source}</span>
          )}
        </div>
      </div>

      {/* Client Tabs */}
      <ClientTabs client={client} />
    </div>
  );
}