import { getAdminBookingConfiguration } from "@/modules/booking/data";
import { getClientById } from "@/modules/crm/actions";
import { getAdminGatewayWorkspace } from "@/modules/gateway/data";
import { OPPORTUNITY_STAGE_LABELS } from "@/modules/gateway/config";
import { getProjectsForClient } from "@/modules/projects/actions";
import { getInstagramImportStatus } from "@/modules/crm/actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClientTabs } from "./ClientTabs";
import { OpportunityPanel } from "./OpportunityPanel";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (isNaN(clientId)) {
    notFound();
  }

  const client = await getClientById(clientId);
  if (!client) {
    notFound();
  }
  const [workspace, bookingConfiguration, projects, instagramStatus] = await Promise.all([
    getAdminGatewayWorkspace(clientId),
    getAdminBookingConfiguration(),
    getProjectsForClient(clientId),
    getInstagramImportStatus(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/crm"
          className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
        >
          ← Back to CRM
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 text-xs font-black text-zinc-400">
            {client.instagramProfilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.instagramProfilePictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              client.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-white">{client.name}</h1>
            {client.instagramUsername && <p className="mt-0.5 text-xs font-bold text-fuchsia-400">@{client.instagramUsername}</p>}
          </div>
        </div>
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
          <span className="rounded bg-violet-500/15 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
            {OPPORTUNITY_STAGE_LABELS[client.opportunityStage]}
          </span>
          {client.source && (
            <span className="text-zinc-500 text-xs">via {client.source}</span>
          )}
        </div>
      </div>

      <OpportunityPanel
        client={{
          id: client.id,
          opportunityStage: client.opportunityStage,
          serviceInterest: client.serviceInterest,
          nextAction: client.nextAction,
          nextActionDate: client.nextActionDate,
          qualificationNotes: client.qualificationNotes,
        }}
        invitation={
          workspace.invitation
            ? {
                id: workspace.invitation.id,
                status: workspace.invitation.status,
                expiresAt: workspace.invitation.expiresAt.toISOString(),
                openedAt: workspace.invitation.openedAt?.toISOString() ?? null,
              }
            : null
        }
        briefingSubmitted={Boolean(workspace.briefing)}
        bookingTimezone={bookingConfiguration.settings.timezone}
        booking={
          workspace.booking
            ? {
                status: workspace.booking.status,
                startsAt: workspace.booking.startsAt.toISOString(),
                endsAt: workspace.booking.endsAt.toISOString(),
              }
            : null
        }
      />

      {/* Client Tabs */}
      <ClientTabs
        client={client}
        briefing={workspace.briefing}
        events={workspace.events}
        projects={projects}
        instagramImportConfigured={instagramStatus.configured}
      />
    </div>
  );
}
