import { getAdminBookingConfiguration } from "@/modules/booking/data";
import { getClientById, getClientIntelligence } from "@/modules/crm/actions";
import { getAdminGatewayWorkspace } from "@/modules/gateway/data";
import { getProjectsForClient } from "@/modules/projects/actions";
import { PROJECT_STATUS_GROUPS } from "@/modules/projects/config";
import { getInstagramImportStatus } from "@/modules/crm/actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClientIntelligencePanel } from "./ClientIntelligencePanel";
import { ClientTabs } from "./ClientTabs";
import { RenameClientButton } from "./RenameClientButton";
import { GeladeiraControl } from "./GeladeiraControl";
import { OpportunityPanel } from "./OpportunityPanel";
import { PortalAccessPanel } from "./PortalAccessPanel";
import { QuotePanel } from "./QuotePanel";
import { getQuotesForClient } from "@/modules/quotes/data";
import { computeClientCommercialValue } from "@/modules/quotes/core";
import { ClientCommercialValuePanel } from "./ClientCommercialValuePanel";
import { getClientCustody } from "@/modules/custody/data";
import { ChainOfCustodyPanel } from "@/components/custody/ChainOfCustodyPanel";
import { getPaymentRequestsForClient } from "@/modules/payment-requests/data";
import { getRateEquivalentsForPeriod } from "@/modules/finance/actions";
import { mondayOfWeek } from "@/modules/work-sessions/core";
import { todayISO } from "@/utils/date";
import { ClientOperationalDossier } from "./ClientOperationalDossier";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    createProject?: string | string[];
    returnTo?: string | string[];
    // House Cleaning Wave 2 §22: Pricing Lab's "Create Quote from this
    // calculation" bridge. All plain strings, all optional -- read-only
    // pre-fill for QuoteCreateForm's own local state; nothing here is
    // persisted until Emmanuel saves the form.
    createQuote?: string | string[];
    amount?: string | string[];
    currency?: string | string[];
    contentType?: string | string[];
    turnaround?: string | string[];
    revisions?: string | string[];
    scope?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedTab = query.tab;
  const shouldCreateProject = query.createProject === "1";
  // House Cleaning Wave 2 §22: a string param here only ever seeds
  // QuoteCreateForm's local state (see QuoteCreateFormPrefill) -- it is
  // never written to the database directly, so there is no injection or
  // trust concern in reading it straight from the query string.
  const shouldCreateQuote = query.createQuote === "1";
  const quotePrefill = shouldCreateQuote
    ? {
        amountDollars: typeof query.amount === "string" ? query.amount : undefined,
        currency: typeof query.currency === "string" ? query.currency.toUpperCase() : undefined,
        contentTypeLabel: typeof query.contentType === "string" ? query.contentType : undefined,
        turnaroundLabel: typeof query.turnaround === "string" ? query.turnaround : undefined,
        revisionsIncluded: typeof query.revisions === "string" ? query.revisions : undefined,
        scopeText: typeof query.scope === "string" ? query.scope : undefined,
      }
    : undefined;
  const projectReturnTo =
    query.returnTo === "/productivity?planVideo=1"
      ? query.returnTo
      : undefined;
  const clientId = parseInt(id, 10);
  if (isNaN(clientId)) {
    notFound();
  }

  const client = await getClientById(clientId);
  if (!client) {
    notFound();
  }
  const today = todayISO();
  const [workspace, bookingConfiguration, projects, instagramStatus, clientIntelligence, quotes, custody, weekEstimates, paymentRequests] =
    await Promise.all([
      getAdminGatewayWorkspace(clientId),
      getAdminBookingConfiguration(),
      getProjectsForClient(clientId),
      getInstagramImportStatus(),
      getClientIntelligence(clientId),
      getQuotesForClient(clientId),
      getClientCustody(clientId),
      // Tuesday Patch Completion Round §H: "put the weekly value where the
      // complaint actually was" -- the original complaint about Dave's
      // $300/week was made looking at this exact page. Reuses the same
      // War Room calculation (getRateEquivalentsForPeriod), never a
      // second monetary computation; Finance stays the canonical owner.
      getRateEquivalentsForPeriod(mondayOfWeek(today), today),
      getPaymentRequestsForClient(clientId),
    ]);
  const weekEstimateForClient = weekEstimates.find((row) => row.clientId === clientId) ?? null;
  // Client Service Reality Patch §6/§8 -- Quote rows carry Date | null
  // fields (createdAt) from the DB layer; serialize to string | null
  // before crossing into the "use client" QuotePanel, same pattern as
  // every other date field already serialized on this page.
  const serializedQuotes = quotes.map((quote) => ({
    id: quote.id,
    status: quote.status,
    currency: quote.currency,
    amountCents: quote.amountCents,
    contentTypeLabel: quote.contentTypeLabel,
    turnaroundLabel: quote.turnaroundLabel,
    revisionsIncluded: quote.revisionsIncluded,
    scopeText: quote.scopeText,
    projectId: quote.projectId,
    videoId: quote.videoId,
    createdAt: quote.createdAt ? quote.createdAt.toISOString() : null,
  }));
  const commercialValue = computeClientCommercialValue(quotes);

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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-white">{client.name}</h1>
              <RenameClientButton clientId={client.id} currentName={client.name} />
            </div>
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
          {/* Brief C §11A: the opportunity-stage badge that used to render
              here duplicated the exact same label OpportunityPanel already
              shows in its own header just below -- when opportunityStage is
              "active" the page visibly said "ACTIVE" twice. Removed here;
              OpportunityPanel remains the one place that stage renders. */}
          {client.source && (
            <span className="text-zinc-500 text-xs">via {client.source}</span>
          )}
          <Link
            href={`/crm/${client.id}/preview`}
            className="ml-auto rounded-full border border-amber-700/40 bg-amber-950/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-900/40"
          >
            👁 View as client
          </Link>
        </div>
      </div>

      <ClientOperationalDossier
        status={client.status}
        lastInteractionAt={client.lastInteractionAt?.toISOString() ?? null}
        realizedRevenue={clientIntelligence.totalRevenueByCurrency}
        activeProjectsCount={clientIntelligence.activeProjectsCount}
        currentProductionCount={clientIntelligence.videosInProgressCount}
        nextAction={client.nextAction}
        nextActionDate={client.nextActionDate}
      />

      {/* Brief C ("Final Local Ingest / Live Readiness") §11B: real QA
          found Active Projects "too buried" -- reachable only inside the
          Projects tab several clicks down. This surfaces them right at the
          top, using the exact same `projects` data already fetched below
          for ProjectManager (no new query), and links straight into each
          Project workspace. Compact operational metrics (active project
          count, total videos, tracked hours) already exist and are shown
          just below in ClientIntelligencePanel -- not duplicated here. */}
      {(() => {
        const activeProjects = projects.filter(
          (project) => PROJECT_STATUS_GROUPS[project.status] === "active",
        );
        if (activeProjects.length === 0) return null;
        return (
          <div className="mb-6 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              Active projects ({activeProjects.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {activeProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-xl border border-cyan-700/40 bg-zinc-950/50 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-900/30"
                >
                  {project.name}
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

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

      <GeladeiraControl
        clientId={client.id}
        archivalState={client.archivalState}
        archivedAt={client.archivedAt ? client.archivedAt.toISOString() : null}
        invitation={
          workspace.invitation
            ? { id: workspace.invitation.id, status: workspace.invitation.status }
            : null
        }
        hasPortalPassword={Boolean(client.portalPasswordHash)}
      />

      {/* House Cleaning Wave 2 §21: a portal login is premature for a lead
          -- there's no production relationship yet for them to check on.
          Conditionally simplified using the existing client.status field,
          not a new entity/model. Once a lead converts (status becomes
          "active"), this section appears with nothing lost -- the
          underlying portalPasswordHash/setAt fields are untouched either
          way. */}
      {client.status !== "lead" && (
        <div className="mb-6">
          <PortalAccessPanel
            clientId={client.id}
            clientEmail={client.email}
            portalPasswordSetAt={
              client.portalPasswordSetAt ? client.portalPasswordSetAt.toISOString() : null
            }
          />
        </div>
      )}

      {/* Quote Approval (Client Service Reality Patch §6) -- log a quote
          from a Pricing Lab calculation, move it DRAFT -> SENT ->
          APPROVED/DECLINED, then create the linked Project/Video once
          approved via the canonical creation path. */}
      <div className="mb-6">
        <QuotePanel
          clientId={client.id}
          clientName={client.name}
          currentStage={client.opportunityStage}
          currentServiceInterest={client.serviceInterest}
          currentQualificationNotes={client.qualificationNotes}
          quotes={serializedQuotes}
          prefill={quotePrefill}
          autoOpen={shouldCreateQuote}
        />
      </div>

      {/* Client Tabs */}
      <ClientTabs
        client={client}
        totalProjectsCount={clientIntelligence.totalProjectsCount}
        totalRevenueByCurrency={clientIntelligence.totalRevenueByCurrency}
        briefing={workspace.briefing}
        events={workspace.events}
        projects={projects}
        instagramImportConfigured={instagramStatus.configured}
        paymentRequests={paymentRequests}
        initialTab={requestedTab === "projects" ? "projects" : undefined}
        initialProjectCreation={shouldCreateProject}
        projectReturnTo={projectReturnTo}
      />

      {/* House Cleaning Wave 2 §18 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
          Client Intelligence, Commercial Truth, and Chain of Custody used
          to be three separate, always-open panels between Active Projects
          and the Opportunity panel -- all three are context/evidence an
          operator checks occasionally, not facts needed to decide what to
          do next (that's Operational Dossier + Opportunity's Next Action
          above). Folded into one collapsed "Recent activity" disclosure,
          closed by default. No data was removed -- every number, note,
          and evidence row below is exactly what these three panels
          already showed, just no longer competing for space above the
          fold. */}
      <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/35">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-200">
          Recent activity &amp; history
        </summary>
        <div className="space-y-6 border-t border-zinc-800 p-4">
          <ClientIntelligencePanel summary={clientIntelligence} weekEstimate={weekEstimateForClient} />
          <ClientCommercialValuePanel
            realizedRevenueByCurrency={clientIntelligence.totalRevenueByCurrency}
            commercialValue={commercialValue}
          />
          {custody && <ChainOfCustodyPanel custody={custody} />}
        </div>
      </details>
    </div>
  );
}
