import type { Metadata } from "next";
import { getClientPortalView } from "@/modules/client-portal/data";
import { CoverImage } from "./CoverImage";
import { PixelEmptyState, PixelIcon } from "@/components/ui/PixelVisuals";
import { CLIENT_VIDEO_STATUS_LABELS } from "@/modules/client-portal/core";
import { formatCurrency } from "@/utils/date";

// Monday Real-Operation Pre-Freeze §6: same reviewUrl/publishedUrl/deliveryUrl
// precedence as the dashboard VideoCard (client/dashboard/VideoCard.tsx) --
// "Review" is this legacy token flow's label for READY_FOR_REVIEW (see
// CLIENT_VIDEO_STATUS_LABELS).
function primaryPortalLink(video: {
  status: string;
  reviewUrl: string | null;
  publishedUrl: string | null;
  deliveryUrl: string | null;
}): { href: string; label: string } | null {
  if (video.status === "Review" && video.reviewUrl) {
    return { href: video.reviewUrl, label: "Review video ↗" };
  }
  if (video.publishedUrl) {
    return { href: video.publishedUrl, label: "View published ↗" };
  }
  if (video.deliveryUrl) {
    return { href: video.deliveryUrl, label: "Watch delivery ↗" };
  }
  return null;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Vault | RMedia",
  description: "Your private RMedia project space.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const projectStatusClass: Record<string, string> = {
  Active: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  Review: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  Upcoming: "border-zinc-700 bg-zinc-900 text-zinc-400",
  Completed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};

const videoStatusClass: Record<string, string> = {
  Planned: "bg-zinc-800 text-zinc-400",
  "In production": "bg-violet-400/10 text-violet-200",
  Review: "bg-amber-400/10 text-amber-200",
  "Updates in progress": "bg-fuchsia-400/10 text-fuchsia-200",
  Delivered: "bg-emerald-400/10 text-emerald-200",
  // Client Portal Reality round §K: clientVideoStatusLabel now emits
  // "Completed" for a DONE video with no deliveryUrl yet -- needs its own
  // style or it silently falls through to the Planned style below.
  Completed: "bg-emerald-400/10 text-emerald-200",
};

function formatPortalDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPortalTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function VaultFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#08090c] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="mb-pixel-logo flex h-11 w-11 items-center justify-center border border-violet-400/30 bg-violet-400/10 text-sm font-black text-violet-200 shadow-lg shadow-violet-950/30">
              RM
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.16em] text-white">RMEDIA</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">
                The Vault
              </p>
            </div>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Private
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await getClientPortalView(token);

  if (portal.status === "unavailable") {
    return (
      <VaultFrame>
        <section className="pixel-frame pixel-frame-client rounded-3xl border border-zinc-800 bg-zinc-900/75 p-6 shadow-2xl shadow-black/30 sm:p-9">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-xl text-zinc-400">
            ◈
          </div>
          <h1 className="text-2xl font-black text-white">Vault unavailable</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
            This private link is invalid, expired, or has been replaced. Ask
            Emmanuel for a new link.
          </p>
        </section>
      </VaultFrame>
    );
  }

  const activeBatch = portal.batches.find((batch) => batch.state === "OPEN") ?? null;

  return (
    <VaultFrame>
      <section className="pixel-frame pixel-frame-client mb-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/75 shadow-2xl shadow-black/30">
        <div className="bg-gradient-to-br from-violet-400/15 via-transparent to-cyan-400/10 p-5 sm:p-8">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-violet-200">
            <PixelIcon name="shield" className="h-3 w-3" /> Welcome to your vault
          </p>
          <h1 className="mt-3 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
            {portal.clientName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Your active projects, production status, and delivery links in one
            private place.
          </p>
        </div>
      </section>

      {activeBatch && (
        <section className="pixel-frame pixel-frame-client mb-6 rounded-3xl border border-emerald-400/25 bg-emerald-950/10 p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Current batch</p>
              <h2 className="mt-1 text-xl font-black text-white">{activeBatch.label}</h2>
              <p className="mt-1 text-xs text-zinc-500">{activeBatch.projectName} · received {formatPortalDate(activeBatch.receivedAt)}</p>
            </div>
            <span className="self-start rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
              {activeBatch.phase.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {activeBatch.items.map((item) => (
              <div key={item.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2">
                <span className="truncate text-sm font-bold text-zinc-200">{item.title}</span>
                <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">{CLIENT_VIDEO_STATUS_LABELS[item.status]}</span>
              </div>
            ))}
          </div>
          {(activeBatch.billed.length > 0 || activeBatch.expectedValue) && (
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

      {portal.projects.length === 0 ? (
        <PixelEmptyState icon="project" title="No projects to show yet" className="rounded-3xl sm:p-10">
          <p>
            Your project will appear here as soon as it is ready.
          </p>
        </PixelEmptyState>
      ) : (
        <div className="space-y-5">
          {portal.projects.map((project, projectIndex) => (
            <section
              key={`${project.name}-${projectIndex}`}
              className="pixel-frame pixel-frame-client overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70"
            >
              <header className="border-b border-zinc-800 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      <PixelIcon name="project" className="h-3 w-3" /> Project
                    </p>
                    <h2 className="mt-1 break-words text-xl font-black text-white sm:text-2xl">
                      {project.name}
                    </h2>
                    <p className="mt-2 text-xs font-semibold text-zinc-500">
                      {project.deadline
                        ? `Deadline ${formatPortalDate(project.deadline)}`
                        : "Timeline coordinated directly with RMedia"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${projectStatusClass[project.status] ?? projectStatusClass.Upcoming}`}
                  >
                    {project.status}
                  </span>
                </div>
              </header>

              <div className="p-4 sm:p-6">
                {project.videos.length === 0 ? (
                  <p className="rounded-2xl bg-zinc-950/45 px-4 py-6 text-center text-sm text-zinc-500">
                    Production details will appear here soon.
                  </p>
                ) : (
                  // Strategic Reality Cleanup II §4 / Lunch Reality Patch §4:
                  // the Vault used to render each video as a 56px inline
                  // thumbnail next to a text row -- for a video editor's own
                  // delivery surface, that throws away the most useful
                  // recognition signal in the system. Same canonical cover
                  // (CoverImage, same fallback chain already resolved
                  // server-side in buildClientPortalProjects: video cover ->
                  // project cover -> placeholder), just presented as an
                  // actual ~16:9 card instead of a postage stamp.
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {project.videos.map((video) => (
                      <article
                        key={video.id}
                        className="pixel-frame pixel-frame-client overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/45"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                          {video.coverUrl ? (
                            <CoverImage src={video.coverUrl} />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-zinc-700">
                              <PixelIcon name="video" className="h-6 w-6" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">No preview yet</span>
                            </div>
                          )}
                          <span
                            className={`pixel-badge absolute left-2.5 top-2.5 px-2.5 py-1 text-[10px] font-black backdrop-blur ${videoStatusClass[video.status] ?? videoStatusClass.Planned}`}
                          >
                            {video.status}
                          </span>
                        </div>
                        <div className="space-y-2 p-4">
                          <h3 className="break-words font-black text-zinc-100">
                            {video.title}
                          </h3>
                          {video.batchLabel && (
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                              Batch · {video.batchLabel}
                            </p>
                          )}
                          {video.lastUpdated && (
                            <p className="text-[11px] text-zinc-600">
                              Updated {formatPortalTimestamp(video.lastUpdated)}
                            </p>
                          )}
                          {primaryPortalLink(video) && (
                            <a
                              href={primaryPortalLink(video)!.href}
                              target="_blank"
                              rel="noreferrer noopener"
                              referrerPolicy="no-referrer"
                              className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
                            >
                              {primaryPortalLink(video)!.label}
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-8 border-t border-zinc-900 pt-5 text-center text-[11px] leading-5 text-zinc-700">
        This private link belongs to {portal.clientName}. Please do not forward it.
      </footer>
    </VaultFrame>
  );
}
