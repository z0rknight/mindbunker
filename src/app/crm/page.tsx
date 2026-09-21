import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { displayClientName, isInternalClientName } from "@/lib/client-identity";
import {
  getAllClients,
  getClientListStats,
  getCRMWorkbenchData,
} from "@/modules/crm/actions";
import {
  RELATIONSHIP_STATUS_LABELS,
  computeCRMActionableKPIs,
  type WorkbenchClient,
  type WorkbenchQuote,
} from "@/modules/crm/core";
import { formatDate, formatCurrency, todayISO } from "@/utils/date";
import { describeLeadSource, isReferralSource } from "@/modules/referrals/core";
import { AddClientButton } from "./AddClientButton";
import { ClientActions } from "./ClientActions";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getSystemInbound } from "@/modules/system-inbound/data";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  const [rawClients, listStats, workbenchData, systemInbound] = await Promise.all([
    getAllClients(),
    getClientListStats(),
    getCRMWorkbenchData(),
    getSystemInbound(),
  ]);

  const today = todayISO();
  const clients = rawClients.map((client) => {
    const currentProject = workbenchData.currentProjectByClient.get(client.id) ?? null;
    return {
      ...client,
      createdAt: client.createdAt ? client.createdAt.toISOString() : null,
      lastInteractionAt: client.lastInteractionAt ? client.lastInteractionAt.toISOString() : null,
      liveProjectCount: listStats.projectCounts.get(client.id) ?? 0,
      liveRevenueByCurrency: listStats.revenueByCurrency.get(client.id) ?? [],
      currentProjectName: currentProject?.name ?? null,
    };
  });

  const kpis = computeCRMActionableKPIs(
    clients as WorkbenchClient[],
    workbenchData.quotes as WorkbenchQuote[],
    today,
  );

  const visibleClients = clients.filter((c) => c.archivalState !== "GELADEIRA");
  const internalClient = visibleClients.find((c) => isInternalClientName(c.name)) ?? null;
  const externalVisibleClients = visibleClients.filter((c) => c !== internalClient);
  const activeClients = externalVisibleClients.filter((c) => c.status === "active");
  const leads = externalVisibleClients.filter((c) => c.status === "lead");
  const inactiveClients = externalVisibleClients.filter((c) => c.status === "inactive");
  const geladeiraClients = clients.filter((c) => c.archivalState === "GELADEIRA");

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">👥 CRM</h1>
          <p className="text-zinc-500 text-sm mt-1">Who needs contact, and how the relationship is advancing</p>
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

      <nav aria-label="CRM views" className="mb-6 flex gap-2 border-b border-zinc-800">
        <Link href="/crm" aria-current="page" className="border-b-2 border-red-500 px-3 py-2 text-sm font-bold text-white">
          All
        </Link>
        <Link href="/crm/inbound" className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-400 hover:text-white">
          Inbound
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white" aria-label={`${systemInbound.unreadEventCount} unread system intake events`}>
            {systemInbound.unreadEventCount}
          </span>
        </Link>
      </nav>

      <div className="mb-6">
        <AddClientButton />
      </div>

      {/* Leads */}
      {leads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Leads ({leads.length})
          </h2>
          <ClientList clients={leads} showConvert />
        </div>
      )}

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
          <ClientList clients={activeClients} />
        </div>
      )}

      {/* Dormant / Inactive */}
      {inactiveClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Dormant ({inactiveClients.length})
          </h2>
          <ClientList clients={inactiveClients} />
        </div>
      )}

      {/* Actionable commercial KPIs (brief §CRM.4): replaces the old
          Total Contacts / Leads This Month generic pair -- these five all
          answer "what needs me to act," not just "how many rows exist." */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3 md:grid-cols-5">
        <StatCard
          label="Follow-ups Due"
          value={kpis.followUpsDue}
          accent={kpis.followUpsDue > 0 ? "amber" : "zinc"}
          icon="📅"
        />
        <StatCard
          label="Leads Awaiting Reply"
          value={kpis.leadsAwaitingReply}
          accent="zinc"
          icon="⏳"
        />
        <StatCard
          label="Open Quotes"
          value={kpis.openQuotes}
          accent="zinc"
          icon="📝"
        />
        <StatCard
          label="Pipeline Value"
          value={
            kpis.pipelineValueByCurrency.length === 0
              ? "—"
              : kpis.pipelineValueByCurrency
                  .map((row) => formatCurrency(row.amount, row.currency))
                  .join(" · ")
          }
          accent="zinc"
          icon="💼"
        />
        <StatCard
          label="Clients at Risk"
          value={kpis.clientsAtRisk}
          accent={kpis.clientsAtRisk > 0 ? "red" : "zinc"}
          icon="⚠️"
        />
      </div>

      {geladeiraClients.length > 0 && (
        <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-zinc-400 text-xs font-semibold uppercase tracking-widest">
            🧊 Geladeira ({geladeiraClients.length}) — archived, not deleted
          </summary>
          <div className="px-4 pb-4">
            <ClientList clients={geladeiraClients} />
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

type ListClient = {
  id: number;
  name: string;
  status: string;
  email: string | null;
  instagramUsername: string | null;
  instagramProfilePictureUrl: string | null;
  source: string | null;
  notes: string | null;
  opportunityStage: string;
  serviceInterest: string | null;
  qualificationNotes: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  currentProjectName: string | null;
  liveRevenueByCurrency: Array<{ currency: string; amount: number }>;
};

function ClientList({ clients, showConvert = false }: { clients: ListClient[]; showConvert?: boolean }) {
  return (
    <div className="space-y-1.5">
      {clients.map((client) => (
        <ClientRow key={client.id} client={client} showConvert={showConvert} />
      ))}
    </div>
  );
}

function ClientRow({ client, showConvert }: { client: ListClient; showConvert: boolean }) {
  const relationshipLabel =
    RELATIONSHIP_STATUS_LABELS[client.status as keyof typeof RELATIONSHIP_STATUS_LABELS] ?? client.status;
  const offer = client.currentProjectName ?? "No active project";
  const nextAction = client.nextAction ?? "No next action set";
  const followUpDate = client.nextActionDate ? `Due ${formatDate(client.nextActionDate)}` : "No follow-up set";
  const value =
    client.liveRevenueByCurrency.length === 0
      ? null
      : client.liveRevenueByCurrency
          .map((row) => formatCurrency(row.amount, row.currency))
          .join(" · ");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <LeadAvatar name={client.name} photoUrl={client.instagramProfilePictureUrl} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/crm/${client.id}`} className="truncate font-bold text-white hover:text-cyan-400">
                {client.name}
              </Link>
              {client.source === "book" && (
                <span className="rounded border border-violet-800/60 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-400">
                  via /book
                </span>
              )}
              {isReferralSource(client.source) && (
                <span className="rounded border border-emerald-800/60 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-400">
                  {describeLeadSource(client.source)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {client.instagramUsername ? `@${client.instagramUsername}` : client.email ?? "No contact detail yet"}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-400">
              <span className="font-bold text-zinc-300">{relationshipLabel}</span>
              <span className="text-zinc-700">·</span>
              <span>{offer}</span>
              <span className="text-zinc-700">·</span>
              <span>{nextAction}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">{followUpDate}</span>
              {value && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="font-mono text-emerald-400">{value}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ClientActions id={client.id} showConvert={showConvert} />
        </div>
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
