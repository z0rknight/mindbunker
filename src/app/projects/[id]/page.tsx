import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { PlanVideoButton } from "@/components/ui/QuickActions";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";
import { getProjectWorkspace } from "@/modules/projects/actions";
import { resolveCurrentWorkVideo } from "@/modules/projects/core";
import { validateDeliveryUrl, countsTowardProduction, isDeliverableVideo } from "@/modules/productivity/core";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { formatDate } from "@/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectWorkspaceControls } from "./ProjectWorkspaceControls";
import { BulkAddVideosButton } from "./BulkAddVideosButton";
import { ProjectVideoWorkspace } from "./ProjectVideoWorkspace";
import { getCommercialTermsForVideo } from "@/modules/quotes/actions";
import { AssetsPanel } from "./AssetsPanel";
import { SourceMediaPanel } from "./SourceMediaPanel";
import { getAssetsForProject } from "@/modules/assets/actions";
import { getSourceMediaForProject } from "@/modules/assets/actions";
import { getClientCustody } from "@/modules/custody/data";
import { ChainOfCustodyPanel } from "@/components/custody/ChainOfCustodyPanel";
import { getOpenProductionOrdersForProject } from "@/modules/production-orders/data";

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

  const [assets, sourceMediaReferences, commercialTermsByVideoId, custody, openProductionOrders] = await Promise.all([
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
    // Sep 18 Morning Congruence Patch: this project's own OPEN batches, for
    // the "assign selected existing videos to a batch" picker below.
    getOpenProductionOrdersForProject(project.id),
  ]);

  const videosWithCommercialTerms = project.videos.map((video) => ({
    ...video,
    commercialTerms: commercialTermsByVideoId.get(video.id) ?? null,
  }));

  // Solo-Operator Health round: a LET'S COOK operational container or a
  // cancelled Production Order item is never a real deliverable -- see
  // isDeliverableVideo in modules/productivity/core.ts. Counts below (and
  // the "Videos N" header) are scoped to this list, matching the schema's
  // own locked invariant that isOperationalContainer controls
  // completion/output/delivery counts. The full, unfiltered project.videos
  // list is still what actually renders as cards below, unchanged --
  // an operator legitimately needs to see and open the container/a
  // cancelled item, just not have them inflate these tallies.
  const deliverableVideos = project.videos.filter(isDeliverableVideo);
  const doneVideos = deliverableVideos.filter(
    (video) => video.status === "DONE" && countsTowardProduction(video.videoKind),
  ).length;
  const inFlightVideos = deliverableVideos.filter((video) =>
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
    <div className={OPERATOR_WORKSPACE_CLASS}>
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
          <p className="mt-2 text-lg font-black text-emerald-300">{doneVideos} / {deliverableVideos.length}</p>
        </div>
      </section>

      {/* Tuesday Patch Priority 6: "um painel similar a esse dentro de
          cada projeto dos clientes... já temos as log sessions por video."
          Reuses the existing Work Session Ledger, scoped to every video in
          this project, instead of a second, smaller panel. */}
      <Link
        href={`/productivity/sessions?project=${project.id}`}
        className="mb-7 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm transition hover:border-zinc-600"
      >
        <span className="font-bold text-zinc-300">🗂️ Session log for this project</span>
        <span className="text-xs font-black text-cyan-400">Every tracked session, day by day →</span>
      </Link>

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

      {project.notes && (
        <section className="mb-7 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Project notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{project.notes}</p>
        </section>
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
          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            <BulkAddVideosButton projectId={project.id} />
            {/* House Cleaning Wave 2 §15: Plan Video means something
                different (future work, always PLANNED) from registering a
                video that already exists in some real state -- kept
                reachable here, but deliberately smaller than the one
                primary Add Video action, not an equally-weighted third
                door for the same canonical item. */}
            <PlanVideoButton
              initialProjectId={project.id}
              projectContext={{
                id: project.id,
                name: project.name,
                clientName: project.clientName,
              }}
              compact
            />
          </div>
        </div>

        <ProjectVideoWorkspace
          projectId={project.id}
          videos={videosWithCommercialTerms}
          projectCoverUrl={project.coverUrl}
          clientDefaultCoverUrl={project.clientDefaultCoverUrl}
          clientAvatarUrl={project.clientAvatarUrl}
          clientName={project.clientName}
          openProductionOrders={openProductionOrders}
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
