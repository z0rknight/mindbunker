import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { getCRMSummary, getAllClients } from "@/modules/crm/actions";
import { formatDate, formatCurrency, currentMonthName } from "@/utils/date";
import { AddClientButton } from "./AddClientButton";
import { ClientActions } from "./ClientActions";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  const [summary, clients] = await Promise.all([
    getCRMSummary(),
    getAllClients(),
  ]);

  // Geladeira (Sprint 1.2 P0): the CRM main list is a P0 visibility
  // surface — Geladeira clients are excluded from the three operational
  // groups below by default and shown only in their own collapsed section.
  const visibleClients = clients.filter((c) => c.archivalState !== "GELADEIRA");
  const activeClients = visibleClients.filter((c) => c.status === "active");
  const leads = visibleClients.filter((c) => c.status === "lead");
  const inactiveClients = visibleClients.filter((c) => c.status === "inactive");
  const geladeiraClients = clients.filter((c) => c.archivalState === "GELADEIRA");

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">👥 CRM</h1>
          <p className="text-zinc-500 text-sm mt-1">Clients & leads management</p>
        </div>
        <Link
          href="/crm/availability"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-900/70 bg-cyan-950/30 px-4 text-sm font-bold text-cyan-300 transition hover:border-cyan-700 hover:bg-cyan-950/50 sm:w-auto"
        >
          Call availability
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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
        <StatCard
          label="Geladeira"
          value={summary.geladeiraCount}
          accent="zinc"
          icon="🧊"
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

      {/* Geladeira — collapsed by default. Preserved history, hidden from
          the default operational view. Reactivate on the client's own
          detail page. */}
      {geladeiraClients.length > 0 && (
        <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">
            🧊 Geladeira ({geladeiraClients.length}) — archived, not deleted
          </summary>
          <div className="px-4 pb-4">
            <ClientTable clients={geladeiraClients} />
          </div>
        </details>
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
    instagramUsername: string | null;
    instagramProfilePictureUrl: string | null;
    source: string | null;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    createdAt: Date | null;
  }>;
  showConvert?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="divide-y divide-zinc-800 md:hidden">
        {clients.map((client) => (
          <article key={client.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <LeadAvatar name={client.name} photoUrl={client.instagramProfilePictureUrl} />
                  <div className="min-w-0">
                    <Link href={`/crm/${client.id}`} className="block truncate font-bold text-white active:text-cyan-400">
                      {client.name}
                    </Link>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {client.instagramUsername ? `@${client.instagramUsername}` : client.email ?? client.source ?? "No contact detail yet"}
                    </p>
                  </div>
                </div>
              </div>
              <ClientActions id={client.id} showConvert={showConvert} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-800/60 p-2.5">
                <p className="text-zinc-500">Projects</p>
                <p className="mt-0.5 font-bold text-zinc-200">{client.totalProjects}</p>
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2.5">
                <p className="text-zinc-500">Revenue</p>
                <p className="mt-0.5 font-mono font-bold text-emerald-400">{formatCurrency(client.totalRevenue)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
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
                <div className="flex items-center gap-3">
                  <LeadAvatar name={client.name} photoUrl={client.instagramProfilePictureUrl} />
                  <div>
                    <Link href={`/crm/${client.id}`} className="text-white font-medium hover:text-cyan-400 transition-colors">
                      {client.name}
                    </Link>
                    {client.instagramUsername && <p className="mt-0.5 text-[11px] text-fuchsia-400">@{client.instagramUsername}</p>}
                  </div>
                </div>
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
    </div>
  );
}

function LeadAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-black text-zinc-400">
      {photoUrl ? (
        // Remote Instagram CDN URLs are HTTPS-validated before persistence.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
