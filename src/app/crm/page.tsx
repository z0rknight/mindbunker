import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { displayClientName, isInternalClientName } from "@/lib/client-identity";
import { getCRMSummary, getAllClients, getClientListStats } from "@/modules/crm/actions";
import { formatDate, formatCurrency, currentMonthName } from "@/utils/date";
import { formatLastActive } from "@/modules/work-sessions/core";
import { AddClientButton } from "./AddClientButton";
import { ClientActions } from "./ClientActions";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  const [summary, rawClients, listStats] = await Promise.all([
    getCRMSummary(),
    getAllClients(),
    getClientListStats(),
  ]);

  // Sprint 3 P1: replace the stale clients.totalProjects /
  // clients.totalRevenue cached columns with the live figures computed
  // in getClientListStats -- see that function for the root-cause note.
  const nowIso = new Date().toISOString();
  const clients = rawClients.map((client) => ({
    ...client,
    liveProjectCount: listStats.projectCounts.get(client.id) ?? 0,
    liveRevenueByCurrency: listStats.revenueByCurrency.get(client.id) ?? [],
    lastActiveAt: listStats.lastActiveByClient.get(client.id) ?? null,
  }));

  // Geladeira (Sprint 1.2 P0): the CRM main list is a P0 visibility
  // surface — Geladeira clients are excluded from the three operational
  // groups below by default and shown only in their own collapsed section.
  const visibleClients = clients.filter((c) => c.archivalState !== "GELADEIRA");
  // Quick Morning Reality Patch §6: RMEDIA's own internal record is a real
  // clients row (used to log internal work against) but is not a real
  // client relationship -- pulled out of the ordinary status buckets so
  // it never inflates "Active Clients," and given its own small line
  // below instead of disappearing.
  const internalClient = visibleClients.find((c) => isInternalClientName(c.name)) ?? null;
  const externalVisibleClients = visibleClients.filter((c) => c !== internalClient);
  const activeClients = externalVisibleClients.filter((c) => c.status === "active");
  const leads = externalVisibleClients.filter((c) => c.status === "lead");
  const inactiveClients = externalVisibleClients.filter((c) => c.status === "inactive");
  const geladeiraClients = clients.filter((c) => c.archivalState === "GELADEIRA");

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">👥 CRM</h1>
          <p className="text-zinc-500 text-sm mt-1">Clients & leads management</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/projects"
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm font-bold text-zinc-300 transition hover:border-zinc-600 sm:w-auto"
          >
            Projects & videos →
          </Link>
          <Link
            href="/crm/availability"
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-900/70 bg-cyan-950/30 px-4 text-sm font-bold text-cyan-300 transition hover:border-cyan-700 hover:bg-cyan-950/50 sm:w-auto"
          >
            Call availability
          </Link>
        </div>
      </div>

      {/* Add Client */}
      <div className="mb-8">
        <AddClientButton />
      </div>

      {/* Local dogfooding round: CRM visual order now leads with Leads
          (top of funnel, the thing most likely to need action), then the
          rest of the active roster, then summary Metrics, with Geladeira
          pushed intentionally to the very bottom -- "it is the fridge." */}

      {/* Leads */}
      {leads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Leads ({leads.length})
          </h2>
          <ClientTable clients={leads} showConvert nowIso={nowIso} />
        </div>
      )}

      {/* RMEDIA — internal record, not a client relationship. Kept out of
          Active Clients/Leads/Inactive so it never reads as one, but still
          one click away for logging internal Operations/Marketing/
          Administration/Product work against it. */}
      {internalClient && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Internal
          </h2>
          <Link
            href={`/crm/${internalClient.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition hover:border-zinc-600"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden="true" />
              {displayClientName(internalClient.name)}
            </span>
            <span className="text-xs font-semibold text-zinc-600">
              {internalClient.liveProjectCount} project{internalClient.liveProjectCount === 1 ? "" : "s"} →
            </span>
          </Link>
        </div>
      )}

      {/* Active Clients */}
      {activeClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Active Clients ({activeClients.length})
          </h2>
          <ClientTable clients={activeClients} nowIso={nowIso} />
        </div>
      )}

      {/* Inactive */}
      {inactiveClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Inactive ({inactiveClients.length})
          </h2>
          <ClientTable clients={inactiveClients} nowIso={nowIso} />
        </div>
      )}

      {/* Metrics */}
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

      {/* Geladeira — collapsed by default. Preserved history, hidden from
          the default operational view. Reactivate on the client's own
          detail page. */}
      {geladeiraClients.length > 0 && (
        <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">
            🧊 Geladeira ({geladeiraClients.length}) — archived, not deleted
          </summary>
          <div className="px-4 pb-4">
            <ClientTable clients={geladeiraClients} nowIso={nowIso} />
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
  nowIso,
}: {
  clients: Array<{
    id: number;
    name: string;
    status: string;
    email: string | null;
    instagramUsername: string | null;
    instagramProfilePictureUrl: string | null;
    source: string | null;
    liveProjectCount: number;
    liveRevenueByCurrency: Array<{ currency: string; amount: number }>;
    contacted: boolean;
    createdAt: Date | null;
    lastActiveAt: string | null;
  }>;
  showConvert?: boolean;
  nowIso: string;
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
                    {client.source === "book" && (
                      <span className="mt-0.5 inline-block rounded border border-violet-800/60 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-400">
                        via /book
                      </span>
                    )}
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
                <p className="mt-0.5 font-bold text-zinc-200">{client.liveProjectCount}</p>
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2.5">
                <p className="text-zinc-500">Revenue</p>
                <p className="mt-0.5 font-mono font-bold text-emerald-400 space-x-1.5">
                  {client.liveRevenueByCurrency.length === 0
                    ? formatCurrency(0)
                    : client.liveRevenueByCurrency.map((row) => (
                        <span key={row.currency}>{formatCurrency(row.amount, row.currency)}</span>
                      ))}
                </p>
              </div>
            </div>
            {client.lastActiveAt && (
              <p className="mt-2 text-[11px] text-zinc-600">
                Last active: {formatLastActive(client.lastActiveAt, nowIso)}
              </p>
            )}
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
            <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs uppercase tracking-wider">Last active</th>
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
                    <div className="flex items-center gap-1.5">
                      <Link href={`/crm/${client.id}`} className="text-white font-medium hover:text-cyan-400 transition-colors">
                        {client.name}
                      </Link>
                      {client.source === "book" && (
                        <span className="rounded border border-violet-800/60 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-400">
                          via /book
                        </span>
                      )}
                    </div>
                    {client.instagramUsername && <p className="mt-0.5 text-[11px] text-fuchsia-400">@{client.instagramUsername}</p>}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{client.email ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-300">{client.liveProjectCount}</td>
              <td className="px-4 py-3 text-emerald-400 font-mono space-x-1.5">
                {client.liveRevenueByCurrency.length === 0
                  ? formatCurrency(0)
                  : client.liveRevenueByCurrency.map((row) => (
                      <span key={row.currency}>{formatCurrency(row.amount, row.currency)}</span>
                    ))}
              </td>
              <td className="px-4 py-3 text-zinc-500 text-xs">
                {client.lastActiveAt ? formatLastActive(client.lastActiveAt, nowIso) : "—"}
              </td>
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
