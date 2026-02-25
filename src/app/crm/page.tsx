import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { getCRMSummary, getAllClients } from "@/modules/crm/actions";
import { formatDate, formatCurrency, currentMonthName } from "@/utils/date";
import { AddClientButton } from "./AddClientButton";
import { ClientActions } from "./ClientActions";

export default async function CRMPage() {
  const [summary, clients] = await Promise.all([
    getCRMSummary(),
    getAllClients(),
  ]);

  const activeClients = clients.filter((c) => c.status === "active");
  const leads = clients.filter((c) => c.status === "lead");
  const inactiveClients = clients.filter((c) => c.status === "inactive");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">👥 CRM</h1>
        <p className="text-zinc-500 text-sm mt-1">Clients & leads management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Active Clients"
          value={summary.activeClientsCount}
          accent="blue"
          icon="✅"
        />
        <StatCard
          label="Leads This Month"
          value={summary.leadsThisMonth}
          sub={currentMonthName()}
          accent="blue"
          icon="🎯"
        />
        <StatCard
          label="Total Contacts"
          value={summary.totalClients}
          accent="zinc"
          icon="📋"
        />
      </div>

      {/* Add Client */}
      <div className="mb-8">
        <AddClientButton />
      </div>

      {/* Active Clients */}
      {activeClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Active Clients ({activeClients.length})
          </h2>
          <ClientTable clients={activeClients} />
        </div>
      )}

      {/* Leads */}
      {leads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Leads ({leads.length})
          </h2>
          <ClientTable clients={leads} showConvert />
        </div>
      )}

      {/* Inactive */}
      {inactiveClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Inactive ({inactiveClients.length})
          </h2>
          <ClientTable clients={inactiveClients} />
        </div>
      )}

      {clients.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No clients or leads yet. Add your first contact!</p>
        </div>
      )}
    </div>
  );
}

function ClientTable({
  clients,
  showConvert = false,
}: {
  clients: Array<{
    id: number;
    name: string;
    status: string;
    email: string | null;
    source: string | null;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    createdAt: Date | null;
  }>;
  showConvert?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Name</th>
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Email</th>
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Projects</th>
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Revenue</th>
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Added</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, i) => (
            <tr key={client.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/20"}`}>
              <td className="px-4 py-3">
                <Link href={`/crm/${client.id}`} className="text-white font-medium hover:text-cyan-400 transition-colors">
                  {client.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{client.email ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-300">{client.totalProjects}</td>
              <td className="px-4 py-3 text-emerald-400 font-mono">{formatCurrency(client.totalRevenue)}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs">
                {client.createdAt ? formatDate(client.createdAt.toISOString().split("T")[0]) : "—"}
              </td>
              <td className="px-4 py-3">
                <ClientActions id={client.id} showConvert={showConvert} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
