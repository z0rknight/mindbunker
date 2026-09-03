import { PlanVideoButton } from "@/components/ui/QuickActions";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { getProjectWorkspace } from "@/modules/projects/actions";
import { resolveCurrentWorkVideo } from "@/modules/projects/core";
import { validateDeliveryUrl } from "@/modules/productivity/core";
import { countsTowardProduction } from "@/modules/video-classification/core";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { formatDate } from "@/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectWorkspaceControls } from "./ProjectWorkspaceControls";
import { AddVideoButton } from "./AddVideoButton";
import { BulkAddVideosButton } from "./BulkAddVideosButton";
import { ProjectVideoWorkspace } from "./ProjectVideoWorkspace";
import { getCommercialTermsForVideo } from "@/modules/quotes/actions";
import { aggregateProjectCommercialSummary } from "@/modules/quotes/core";
import { AssetsPanel } from "./AssetsPanel";
import { SourceMediaPanel } from "./SourceMediaPanel";
import { getAssetsForProject } from "@/modules/assets/actions";
import { getSourceMediaForProject } from "@/modules/assets/actions";
import { getClientCustody } from "@/modules/custody/data";
import { ChainOfCustodyPanel } from "@/components/custody/ChainOfCustodyPanel";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();

  const project = await getProjectWorkspace(Number(id));
  if (!project) notFound();

  const [assets, sourceMediaReferences, commercialTermsByVideoId, custody] = await Promise.all([
    getAssetsForProject(project.id),
    getSourceMediaForProject(project.id),
    // Quick Morning Reality Patch §7/§9: reuse the exact same commercial-
    // terms resolution the Video workspace panel already uses (quotes
    // FIXED, hourly contract, or NONE) plus its tracked-time figure --
    // one canonical source, no second derivation, no guessing at a
    // received amount (see ProjectVideoCards' CommercialValueLine).
    Promise.all(
      project.videos.map(async (video) => [video.id, await getCommercialTermsForVideo(video.id)] as const),
    ).then((entries) => new Map(entries)),
    getClientCustody(project.clientId),
  ]);

  const videosWithCommercialTerms = project.videos.map((video) => ({
    ...video,
    commercialTerms: commercialTermsByVideoId.get(video.id) ?? null,
  }));

  // Post-Job Commercial + Delivery Sniper §5: one aggregation of the same
  // per-video CommercialTerms already fetched above -- no second query,
  // no independent recompute.
  const commercialSummary = aggregateProjectCommercialSummary(
    Array.from(commercialTermsByVideoId.values()),
  );

  // Promotion Prep Patch P0: a Sample Video or Internal video must not
  // count as completed client production output on the project header.
  const doneVideos = project.videos.filter(
    (video) => video.status === "DONE" && countsTowardProduction(video.videoKind),
  ).length;
  const inFlightVideos = project.videos.filter((video) =>
    ["IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED"].includes(video.status),
  ).length;

  // NIGHT SHIFT REALITY PATCH §7: derived from the same video list already
  // fetched above -- no new query, no new field. See
  // resolveCurrentWorkVideo for the preference order.
  const currentWorkVideo = resolveCurrentWorkVideo(project.videos);
  const currentWorkReviewUrl = currentWorkVideo
    ? (() => {
        const validated = validateDeliveryUrl(currentWorkVideo.reviewUrl);
        return validated.success ? validated.value : null;
      })()
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-7">
        <Link href="/projects" className="inline-flex min-h-10 items-center text-sm font-bold text-zinc-500 transition hover:text-zinc-300">
          ← All projects
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Project workspace
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-white sm:text-3xl">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <nav aria-label="Project relationship" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/crm/${project.clientId}`} className="font-black text-cyan-400 hover:text-cyan-300">
                {project.clientName}
              </Link>
              <span className="text-zinc-700">→</span>
              <span className="font-bold text-zinc-300">{project.name}</span>
            </nav>
          </div>
          <ProjectWorkspaceControls project={project} />
        </div>
      </header>

      <section className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Deadline</p>
          <p className="mt-2 text-lg font-black text-white">{project.deadline ? formatDate(project.deadline) : "Not set"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">In flight</p>
          <p className="mt-2 text-lg font-black text-cyan-300">{inFlightVideos}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Completed</p>
          <p className="mt-2 text-lg font-black text-emerald-300">{doneVideos} / {project.videos.length}</p>
        </div>
      </section>

      {currentWorkVideo && (
        <section className="mb-7 rounded-2xl border border-cyan-900/50 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Current work</p>
          <h2 className="mt-2 text-lg font-black text-white">
            {currentWorkVideo.title?.trim() || `Video ${currentWorkVideo.date}`}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{currentWorkVideo.status.replaceAll("_", " ")}</p>
          {currentWorkReviewUrl && (
            <div className="mt-3 flex items-center gap-3">
              <a
                href={currentWorkReviewUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-10 items-center rounded-xl bg-cyan-500 px-4 text-sm font-black text-zinc-950 hover:bg-cyan-400"
              >
                Open review link ↗
              </a>
              <CopyLinkButton url={currentWorkReviewUrl} className="text-xs text-zinc-500 hover:text-cyan-300 transition" />
            </div>
          )}
        </section>
      )}

      {commercialSummary.videoCount > 0 &&
        (commercialSummary.byCurrency.length > 0 || commercialSummary.trackedSecondsTotal > 0) && (
          <section className="mb-7 rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              Commercial summary
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="text-xs text-zinc-500">
                Tracked work{" "}
                <span className="font-black text-white">
                  {Math.floor(commercialSummary.trackedSecondsTotal / 3600)}h{" "}
                  {Math.round((commercialSummary.trackedSecondsTotal % 3600) / 60)}m
                </span>
              </p>
              {commercialSummary.byCurrency.map((bucket) => (
                <div key={bucket.currency} className="flex items-baseline gap-3 text-xs text-zinc-500">
                  {bucket.agreedTotalCents !== null && (
                    <span>
                      Agreed{" "}
                      <span className="font-black text-emerald-300">
                        {bucket.currency} {(bucket.agreedTotalCents / 100).toFixed(2)}
                      </span>
                    </span>
                  )}
                  {bucket.estimatedAccruedTotal !== null && (
                    <span>
                      Estimated accrued{" "}
                      <span className="font-black text-cyan-300">
                        {bucket.currency} {bucket.estimatedAccruedTotal.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
              ))}
              {commercialSummary.unattributedCount > 0 && (
                <p className="text-[11px] text-zinc-600">
                  {commercialSummary.unattributedCount} of {commercialSummary.videoCount} video
                  {commercialSummary.videoCount === 1 ? "" : "s"} with no commercial terms yet
                </p>
              )}
            </div>
          </section>
        )}

      {project.notes && (
        <details className="mb-7 rounded-2xl border border-zinc-800 bg-zinc-950/35">
          <summary className="cursor-pointer select-none px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 sm:px-5">
            Project notes
          </summary>
          <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6 text-zinc-400 sm:px-5">{project.notes}</p>
        </details>
      )}

      {custody && <ChainOfCustodyPanel custody={custody} focusProjectId={project.id} />}

      <section aria-labelledby="project-videos">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Production units</p>
            <h2 id="project-videos" className="mt-1 text-xl font-black text-white">
              Videos <span className="font-mono text-sm text-zinc-600">{project.videos.length}</span>
            </h2>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <AddVideoButton projectId={project.id} />
            <BulkAddVideosButton projectId={project.id} />
            <div className="w-full sm:w-[180px]">
              <PlanVideoButton
                initialProjectId={project.id}
                projectContext={{
                  id: project.id,
                  name: project.name,
                  clientName: project.clientName,
                }}
              />
            </div>
          </div>
        </div>

        <ProjectVideoWorkspace
          projectId={project.id}
          videos={videosWithCommercialTerms}
          projectCoverUrl={project.coverUrl}
          clientAvatarUrl={project.clientAvatarUrl}
          clientName={project.clientName}
        />
      </section>

      <AssetsPanel
        projectId={project.id}
        videos={project.videos.map((v) => ({ id: v.id, title: v.title }))}
        assets={assets}
      />

      <SourceMediaPanel projectId={project.id} references={sourceMediaReferences} />
    </div>
  );
}
