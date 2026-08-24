import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-server";
import { getClientDashboardView } from "@/modules/client-portal/data";
import { VideoCard } from "@/app/client/dashboard/VideoCard";

export const dynamic = "force-dynamic";

// Monday Real-Operation Pre-Freeze §6: "Emmanuel must be able to inspect
// exactly what a client would see BEFORE relying on it with Taryn." This
// route calls the SAME getClientDashboardView() the real /client/dashboard
// page calls (see modules/client-portal/data.ts) with the target clientId
// -- the exact client-safe projection, not a re-derived approximation of
// it. requireAuth() gates this page (getClientDashboardView itself trusts
// its clientId argument, by design, so the caller must verify admin auth
// first -- see that function's own comment).
export default async function ClientPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (isNaN(clientId)) notFound();

  const view = await getClientDashboardView(clientId);
  if (view.status !== "active") notFound();

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="sticky top-0 z-10 border-b border-amber-500/30 bg-amber-950/80 backdrop-blur px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-amber-300">
        ⚠ Internal preview — exactly what {view.clientName} would see. Never contains finance, margin, fees, or internal notes.
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:p-8">
        <Link href={`/crm/${clientId}`} className="text-zinc-500 text-xs hover:text-white">← Back to {view.clientName}</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{view.clientName}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {view.activeProjectsCount} active project{view.activeProjectsCount === 1 ? "" : "s"} · {view.totalVideos} video{view.totalVideos === 1 ? "" : "s"}
        </p>

        {view.readyForReview.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-violet-300 mb-3">Ready for review</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {view.readyForReview.map((v) => (
                <VideoCard key={v.id} video={v} showReviewActions={false} dateLabel="Ready" />
              ))}
            </div>
          </section>
        )}

        {view.currentWork.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300 mb-3">In production</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {view.currentWork.map((v) => (
                <VideoCard key={v.id} video={v} dateLabel="Updated" />
              ))}
            </div>
          </section>
        )}

        {view.recentDeliveries.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-3">Recent deliveries</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {view.recentDeliveries.map((v) => (
                <VideoCard key={v.id} video={v} dateLabel="Delivered" />
              ))}
            </div>
          </section>
        )}

        {view.totalVideos === 0 && (
          <p className="mt-8 text-sm text-zinc-500">This client would see an empty dashboard — no videos yet.</p>
        )}
      </div>
    </div>
  );
}
