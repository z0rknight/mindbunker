import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getAdminBookingConfiguration } from "@/modules/booking/data";
import { getClientById, getClientIntelligence } from "@/modules/crm/actions";
import { getAdminGatewayWorkspace } from "@/modules/gateway/data";
import { getProjectsForClient, getUnassignedClientVideos } from "@/modules/projects/actions";
import { getInstagramImportStatus } from "@/modules/crm/actions";
import { getClientProjectCommercialAttribution, getCommercialContracts } from "@/modules/finance/actions";
import { notFound } from "next/navigation";
import { ClientIntelligencePanel } from "./ClientIntelligencePanel";
import { ClientTabs } from "./ClientTabs";
import { ProductionMemoryPanel } from "./ProductionMemoryPanel";
import { getProductionMemoryForClient, getReferenceVideoOptions } from "@/modules/production-memory/data";
import { GeladeiraControl } from "./GeladeiraControl";
import { OpportunityPanel } from "./OpportunityPanel";
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
import { ClientIdentityRail } from "./ClientIdentityRail";
import { ActiveJobsPanel } from "./ActiveJobsPanel";
import { ClientMetricStrip } from "./ClientMetricStrip";
import { ClientDashboardManager } from "./ClientDashboardManager";
import { filterVideosForClient, selectActiveContractForClient } from "@/modules/crm/spatial-composition";
import { indexClientBillingByProject } from "@/modules/client-portal/core";

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
  const [
    workspace,
    bookingConfiguration,
    projects,
    instagramStatus,
    clientIntelligence,
    quotes,
    custody,
    weekEstimates,
    paymentRequests,
    allUnassignedVideos,
    allContracts,
    commercialAttribution,
    productionMemories,
    referenceVideoOptions,
  ] = await Promise.all([
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
    // Spatial Recomposition Wave 4 §6: these two are global (all-clients)
    // queries that already exist for other surfaces -- filtered to this
    // client in JS below rather than adding new client-scoped SQL, so the
    // page stays at the same query count it already had.
    getUnassignedClientVideos(),
    getCommercialContracts(),
    // Operator Project Commercial Attribution: already clientId-scoped
    // (unlike the two global queries above), so no client-side filter
    // needed -- this is the one new query this page adds.
    getClientProjectCommercialAttribution(clientId),
    // Wave 3: client-owned production memory (operator-only).
    getProductionMemoryForClient(clientId),
    getReferenceVideoOptions(clientId),
  ]);
  const weekEstimateForClient = weekEstimates.find((row) => row.clientId === clientId) ?? null;
  const unassignedVideos = filterVideosForClient(allUnassignedVideos, clientId);
  const activeContract = selectActiveContractForClient(allContracts, clientId);
  const recentNote = clientIntelligence.recentMemoryNotes[0] ?? null;
  const commercialByProject = indexClientBillingByProject(commercialAttribution.byProject);
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
    <div className={OPERATOR_WORKSPACE_CLASS}>
      {/* Spatial Recomposition Wave 4: 5-region grid -- Identity Rail
          (left) / Active Jobs (center, primary) / Operational Dossier
          (right) on desktop, stacking Identity -> Dossier -> Active Jobs
          on narrow screens per the blueprint's mobile order. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[17%_minmax(0,1fr)_26%]">
        <div className="order-1">
          <ClientIdentityRail client={client} />
        </div>
        <div className="order-3 lg:order-2">
          <ActiveJobsPanel
            clientId={client.id}
            clientDefaultCoverUrl={client.defaultCoverUrl}
            clientAvatarUrl={client.instagramProfilePictureUrl}
            projects={projects}
            unassignedVideos={unassignedVideos}
            commercialByProject={commercialByProject}
            unallocatedManualEvidence={commercialAttribution.unallocatedManualEvidence}
          />
        </div>
        <div className="order-2 lg:order-3">
          <ClientOperationalDossier
            status={client.status}
            lastInteractionAt={client.lastInteractionAt?.toISOString() ?? null}
            nextAction={client.nextAction}
            nextActionDate={client.nextActionDate}
            contract={activeContract}
            portalPasswordSetAt={client.portalPasswordSetAt ? client.portalPasswordSetAt.toISOString() : null}
            recentNote={recentNote}
          />
        </div>
      </div>

      {/* Client Metrics -- lower strip, 4 facts, no bare hours, no
          lifetime revenue (see mission constraints). */}
      <div className="mt-4">
        <ClientMetricStrip
          totalProjectsCount={clientIntelligence.totalProjectsCount}
          activeProjectsCount={clientIntelligence.activeProjectsCount}
          completedVideosCount={clientIntelligence.completedVideosCount}
          revisionCount={clientIntelligence.revisionCount}
        />
      </div>

      <div className="mt-6 space-y-6">
      <OpportunityPanel
        client={{
          id: client.id,
          name: client.name,
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
      </div>

      {/* Client Dashboard Manager -- Wave 4 §10: visual section-map
          replacing the two flat checkbox-wall PortalControl grids that
          used to live inside ClientTabs' Overview tab (now removed
          there). Same underlying actions/flags, just regrouped. Gated
          on client.status like the panel it replaces -- a lead has no
          production relationship yet, so a portal manager is clutter. */}
      {client.status !== "lead" && (
        <div className="mt-6">
          <ClientDashboardManager
            clientId={client.id}
            clientEmail={client.email}
            portalPasswordSetAt={client.portalPasswordSetAt ? client.portalPasswordSetAt.toISOString() : null}
            portalCanSeeFinancials={client.portalCanSeeFinancials}
            portalCanReview={client.portalCanReview}
            portalCanSetPriority={client.portalCanSetPriority}
            portalShowCurrentAccount={client.portalShowCurrentAccount}
            portalShowSearch={client.portalShowSearch}
            portalShowSummary={client.portalShowSummary}
            portalShowActiveWork={client.portalShowActiveWork}
            portalShowRecentDeliveries={client.portalShowRecentDeliveries}
            portalShowCompletedByType={client.portalShowCompletedByType}
            portalShowVideoLibrary={client.portalShowVideoLibrary}
          />
        </div>
      )}

      {/* Wave 3 Client Production Memory: the client OWNS its reusable
          formats; managed here, read contextually from Project and
          Production Order pages. Hidden for a lead with none recorded. */}
      {(client.status !== "lead" || productionMemories.length > 0) && (
        <ProductionMemoryPanel
          clientId={client.id}
          memories={productionMemories}
          videoOptions={referenceVideoOptions}
        />
      )}

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
