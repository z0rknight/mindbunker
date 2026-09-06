import type { Metadata } from "next";
import { requireClientAuth } from "@/lib/client-portal-session";
import { getClientBillingSummary, getClientDashboardView } from "@/modules/client-portal/data";
import { BillingSummary } from "./BillingSummary";
import { LogoutButton } from "./LogoutButton";
import { StatTile } from "./StatTile";
import { VideoCard } from "./VideoCard";
import { VideoGallery } from "./VideoGallery";

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

  return (
    <main className="min-h-dvh bg-zinc-950 pb-16 text-white">
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">RMEDIA · Client Portal</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">
              Welcome back, {view.clientName}
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        <BillingSummary billing={billing} />

        {!hasAnyVideos ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 text-center">
            <p className="text-2xl" aria-hidden="true">🎬</p>
            <p className="mt-3 text-sm font-bold text-zinc-300">No videos yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Once RMEDIA starts production on your account, you&apos;ll see progress here.
            </p>
          </section>
        ) : (
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

            {view.readyForReview.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-violet-300">
                  Needs your attention
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {view.readyForReview.map((video) => (
                    <VideoCard key={video.id} video={video} showReviewActions dateLabel="Ready" />
                  ))}
                </div>
              </section>
            )}

            {view.currentWork.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                  Current work
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {view.currentWork.map((video) => (
                    <VideoCard key={video.id} video={video} dateLabel="Updated" />
                  ))}
                </div>
              </section>
            )}

            {view.recentDeliveries.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                  Recent deliveries
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {view.recentDeliveries.map((video) => (
                    <VideoCard key={video.id} video={video} dateLabel="Delivered" />
                  ))}
                </div>
              </section>
            )}

            {view.contentBreakdown.length > 0 && (
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

            <VideoGallery videos={view.allVideos} />
          </>
        )}
      </div>
    </main>
  );
}
