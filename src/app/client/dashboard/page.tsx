import type { Metadata } from "next";
import Link from "next/link";
import { CLIENT_PORTAL_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { requireClientAuth } from "@/lib/client-portal-session";
import { getClientBillingSummary, getClientDashboardView } from "@/modules/client-portal/data";
import { BillingSummary } from "./BillingSummary";
import { CurrentAccount } from "./CurrentAccount";
import { DashboardSearch } from "./DashboardSearch";
import { LogoutButton } from "./LogoutButton";
import { StatTile } from "./StatTile";
import { VideoCard } from "./VideoCard";
import { VideoGallery } from "./VideoGallery";
import { PixelEmptyState, PixelIcon } from "@/components/ui/PixelVisuals";
import { CLIENT_VIDEO_STATUS_LABELS } from "@/modules/client-portal/core";
import { formatCurrency } from "@/utils/date";

// Renders one authenticated client's private data. Next.js's automatic
// dynamic-rendering detection (triggered by cookies() inside
// requireClientAuth) should already cover this, but every other
// authenticated/personalized page in this codebase (admin CRM, the
// pre-existing token-based /client/[token]) sets this explicitly rather
// than relying on it being inferred through a chain of function calls --
// matching that convention here rather than being the one exception.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | RMEDIA",
  robots: { index: false, follow: false },
};

export default async function ClientDashboardPage() {
  const clientId = await requireClientAuth("/client/login");
  const [view, billing] = await Promise.all([
    getClientDashboardView(clientId),
    getClientBillingSummary(clientId),
  ]);

  if (view.status === "unavailable") {
    // The session verified a clientId that no longer resolves to an active
    // client record (e.g. deleted between requests) -- fail safely rather
    // than rendering a broken/empty dashboard as if it were real data.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 text-center text-zinc-400">
        <p>This portal link is no longer available. Please contact RMEDIA for a new invite.</p>
      </main>
    );
  }

  const hasAnyVideos = view.totalVideos > 0;
  const activeBatch = view.batches.find((batch) => batch.state === "OPEN") ?? null;
  const pastBatches = view.batches.filter((batch) => batch.id !== activeBatch?.id);

  return (
    <main className="min-h-dvh bg-zinc-950 pb-16 text-white">
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-5 backdrop-blur sm:px-6">
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
              <PixelIcon name="shield" className="h-3 w-3" /> RMEDIA · Client Portal
            </p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">
              Welcome back, {view.clientName}
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className={`space-y-8 py-6 ${CLIENT_PORTAL_WORKSPACE_CLASS}`}>
        {/* Operator Discovery + Portal Personalization patch (2026-09-14):
            each `dashboardSections.show*` check below is a LAYOUT
            preference only. The data underneath was already filtered
            server-side (paymentRequest is null when financials are off;
            batches/videos are already scoped to this client's
            visibleToClient=true records) -- hiding a section here never
            changes what data exists, only whether it's shown. Search
            (below) intentionally keeps searching view.allVideos even when
            Video Library itself is hidden -- see DashboardSearch's own
            data source, unchanged by this patch. */}
        {view.dashboardSections.showCurrentAccount && <CurrentAccount request={view.paymentRequest} />}

        {view.dashboardSections.showSearch && hasAnyVideos && (
          <DashboardSearch videos={view.allVideos} billing={billing} allowPriority={view.permissions.canSetPriority} />
        )}

        {view.dashboardSections.showActiveWork && activeBatch && (
          <section className="pixel-frame pixel-frame-client rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-4 sm:p-5" aria-labelledby="current-batch">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">In production now</p>
                <h2 id="current-batch" className="mt-1 text-xl font-black text-white">{activeBatch.label}</h2>
                <p className="mt-1 text-xs text-zinc-500">{activeBatch.projectName} · received {activeBatch.receivedAt}</p>
              </div>
              <span className="self-start rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                {activeBatch.phase.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {activeBatch.items.map((item) => (
                <Link key={item.id} href={`/client/dashboard/videos/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2 text-sm hover:border-violet-500/40">
                  <span className="truncate font-bold text-zinc-200">{item.title}</span>
                  <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">{CLIENT_VIDEO_STATUS_LABELS[item.status]}</span>
                </Link>
              ))}
            </div>
            {view.permissions.canSeeFinancials && (activeBatch.billed.length > 0 || activeBatch.expectedValue) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3 text-xs">
                {activeBatch.billed.map((row) => (
                  <span key={row.currency} className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 font-bold text-cyan-200">
                    Confirmed billed · {formatCurrency(row.amount, row.currency)}
                  </span>
                ))}
                {activeBatch.billed.length === 0 && activeBatch.expectedValue && (
                  <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-bold text-zinc-400">
                    Expected · {formatCurrency(activeBatch.expectedValue.amount, activeBatch.expectedValue.currency)} · not final billing
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        <BillingSummary billing={billing} />

        {!hasAnyVideos ? (
          <PixelEmptyState icon="video" title="No videos yet" className="rounded-2xl">
            <p>
              Once RMEDIA starts production on your account, you&apos;ll see progress here.
            </p>
          </PixelEmptyState>
        ) : (
          <>
            {view.dashboardSections.showSummary && (
              <>
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <StatTile label="Active projects" value={view.activeProjectsCount} />
                  <StatTile label="Total videos" value={view.totalVideos} />
                  <StatTile label="In production" value={view.totals.inProduction} />
                  <StatTile label="Ready for review" value={view.totals.readyForReview} />
                  <StatTile label="Completed" value={view.totals.completed} />
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <StatTile label="Videos this week" value={view.videosThisWeek} />
                  <StatTile label="Videos this month" value={view.videosThisMonth} />
                </section>

                {view.completedThisWeek > 0 && (
                  <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3.5">
                    <p className="text-sm font-bold text-emerald-200">
                      {view.completedThisWeek} video{view.completedThisWeek === 1 ? "" : "s"} completed this week
                    </p>
                  </section>
                )}
              </>
            )}

            {view.dashboardSections.showActiveWork && view.readyForReview.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-violet-300">
                  Needs your attention
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {view.readyForReview.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      showReviewActions={view.permissions.canReview}
                      allowPriority={view.permissions.canSetPriority}
                      dateLabel="Ready"
                    />
                  ))}
                </div>
              </section>
            )}

            {view.dashboardSections.showActiveWork && view.currentWork.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                  Current work
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {view.currentWork.map((video) => (
                    <VideoCard key={video.id} video={video} allowPriority={view.permissions.canSetPriority} dateLabel="Updated" />
                  ))}
                </div>
              </section>
            )}

            {view.dashboardSections.showRecentDeliveries && view.recentDeliveries.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                  Recent deliveries
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {view.recentDeliveries.map((video) => (
                    <VideoCard key={video.id} video={video} allowPriority={view.permissions.canSetPriority} dateLabel="Delivered" />
                  ))}
                </div>
              </section>
            )}

            {view.dashboardSections.showCompletedByType && view.contentBreakdown.length > 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  Completed by type
                </h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {view.contentBreakdown.map((entry) => (
                    <span
                      key={entry.contentType}
                      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300"
                    >
                      {entry.label} — {entry.completedCount}
                    </span>
                  ))}
                  {view.unclassifiedCompletedCount > 0 && (
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-semibold text-zinc-500">
                      Other — {view.unclassifiedCompletedCount}
                    </span>
                  )}
                </div>
              </section>
            )}

            {view.dashboardSections.showVideoLibrary && (
              <VideoGallery
                videos={view.allVideos}
                allowReview={view.permissions.canReview}
                allowPriority={view.permissions.canSetPriority}
              />
            )}

            {view.dashboardSections.showActiveWork && pastBatches.length > 0 && (
              <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-zinc-400">
                  <span><span className="mr-2 inline-block transition group-open:rotate-90">▸</span>Previous batches</span>
                  <span className="font-mono text-xs text-zinc-600">{pastBatches.length}</span>
                </summary>
                <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
                  {pastBatches.map((batch) => (
                    <div key={batch.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-200">{batch.label}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-600">{batch.projectName} · {batch.items.length} videos</p>
                        </div>
                        <span className="text-[10px] font-black uppercase text-zinc-500">{batch.phase.replaceAll("_", " ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </main>
  );
}
