"use client";

import Link from "next/link";
import { PortalControl } from "@/components/client-portal/PortalControl";
import { setClientDashboardSection, setClientPortalCapability } from "@/modules/client-portal/admin-actions";
import { PortalAccessPanel } from "./PortalAccessPanel";

function SectionGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
      <h4 className="text-xs font-black uppercase tracking-wider text-violet-300">{title}</h4>
      <p className="mt-1 text-[11px] leading-5 text-zinc-500">{description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

export function ClientDashboardManager({
  clientId,
  clientEmail,
  portalPasswordSetAt,
  portalCanSeeFinancials,
  portalCanReview,
  portalCanSetPriority,
  portalShowCurrentAccount,
  portalShowSearch,
  portalShowSummary,
  portalShowActiveWork,
  portalShowRecentDeliveries,
  portalShowCompletedByType,
  portalShowVideoLibrary,
}: {
  clientId: number;
  clientEmail: string | null;
  portalPasswordSetAt: string | null;
  portalCanSeeFinancials: boolean;
  portalCanReview: boolean;
  portalCanSetPriority: boolean;
  portalShowCurrentAccount: boolean;
  portalShowSearch: boolean;
  portalShowSummary: boolean;
  portalShowActiveWork: boolean;
  portalShowRecentDeliveries: boolean;
  portalShowCompletedByType: boolean;
  portalShowVideoLibrary: boolean;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4 sm:p-5" data-testid="client-dashboard-manager">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Client dashboard manager</p>
          <h2 className="mt-1 font-black text-white">What the client sees</h2>
        </div>
        <Link
          href={`/crm/${clientId}/preview`}
          className="rounded-full border border-amber-700/40 bg-amber-950/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-900/40"
        >
          👁 Preview as client
        </Link>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-violet-300">Access</h4>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">Persistent login for the client portal.</p>
          <div className="mt-3">
            <PortalAccessPanel clientId={clientId} clientEmail={clientEmail} portalPasswordSetAt={portalPasswordSetAt} />
          </div>
        </div>

        <SectionGroup title="Capabilities" description="Explicit capabilities; internal records remain unchanged when access is hidden.">
          <PortalControl
            label="Financial summary"
            description="Recorded billing evidence and rates"
            enabled={portalCanSeeFinancials}
            onChange={(enabled) => setClientPortalCapability(clientId, "financials", enabled)}
          />
          <PortalControl
            label="Review actions"
            description="Approve or request changes"
            enabled={portalCanReview}
            onChange={(enabled) => setClientPortalCapability(clientId, "review", enabled)}
          />
          <PortalControl
            label="Priority request"
            description="Choose the current item within a project"
            enabled={portalCanSetPriority}
            onChange={(enabled) => setClientPortalCapability(clientId, "priority", enabled)}
          />
        </SectionGroup>

        <SectionGroup
          title="Dashboard sections"
          description="Layout only. Financial data stays gated by the capability above regardless of this toggle."
        >
          <PortalControl
            label="Current account"
            description="Open payment request card"
            enabled={portalShowCurrentAccount}
            onChange={(enabled) => setClientDashboardSection(clientId, "currentAccount", enabled)}
          />
          <PortalControl
            label="Search"
            description="Search this client's own videos"
            enabled={portalShowSearch}
            onChange={(enabled) => setClientDashboardSection(clientId, "search", enabled)}
          />
          <PortalControl
            label="Summary"
            description="Stat tiles and weekly/monthly counts"
            enabled={portalShowSummary}
            onChange={(enabled) => setClientDashboardSection(clientId, "summary", enabled)}
          />
          <PortalControl
            label="Active work"
            description="In-production batch, attention, current work"
            enabled={portalShowActiveWork}
            onChange={(enabled) => setClientDashboardSection(clientId, "activeWork", enabled)}
          />
          <PortalControl
            label="Recent deliveries"
            description="Most recently delivered videos"
            enabled={portalShowRecentDeliveries}
            onChange={(enabled) => setClientDashboardSection(clientId, "recentDeliveries", enabled)}
          />
          <PortalControl
            label="Completed by type"
            description="Breakdown chips by content type"
            enabled={portalShowCompletedByType}
            onChange={(enabled) => setClientDashboardSection(clientId, "completedByType", enabled)}
          />
          <PortalControl
            label="Video library"
            description="Full gallery + previous batches archive"
            enabled={portalShowVideoLibrary}
            onChange={(enabled) => setClientDashboardSection(clientId, "videoLibrary", enabled)}
          />
        </SectionGroup>
      </div>
    </section>
  );
}
