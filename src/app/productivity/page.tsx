import {
  FinishedVideoButton,
  PlanVideoButton,
} from "@/components/ui/QuickActions";
import { StatCard } from "@/components/ui/StatCard";
import {
  getAllVideoLogs,
  getOpenBlockersByVideo,
  getProductivityQuickOptions,
  getSoonestOpenCommitmentByVideo,
  getVideoStats,
} from "@/modules/productivity/actions";
import {
  getVideoNextAction,
  groupOperationalVideos,
  type ProductivityGroup,
} from "@/modules/productivity/core";
import { selectExecutionQueue, selectNextExecutable } from "@/modules/productivity/queue";
import { ExecutionQueueSection } from "./ExecutionQueueSection";
import { getWorkSessionHistory, getWorkSessionOverview } from "@/modules/work-sessions/data";
import {
  formatClosedDuration,
  groupWorkSessionDaysByWeek,
  groupWorkSessionsByDay,
  mondayOfWeek,
} from "@/modules/work-sessions/core";
import { currentMonthName, todayISO } from "@/utils/date";
import Link from "next/link";
import { VideoOperationsCard } from "./VideoOperationsCard";
import { isSafeInternalPath } from "@/utils/navigation";
import { NowFocusPanel, type RecommendedNextItem } from "@/components/work-sessions/NowFocusPanel";
import { QuickBlock, QuickNote } from "@/components/work-sessions/QuickVideoActions";
import { NeedsAttentionSection } from "./NeedsAttentionSection";
import { selectProductivityAttention } from "@/modules/productivity/attention";
import { getActiveSignals } from "@/modules/signals/data";

export const dynamic = "force-dynamic";

const sectionDetails: Record<
  ProductivityGroup,
  { eyebrow: string; title: string; description: string; empty: string }
> = {
  current: {
    eyebrow: "Make",
    title: "Current Work",
    description: "Production already in motion. Open the workspace and keep the next step obvious.",
    empty: "No videos are in production. Start a planned video when you are ready.",
  },
  attention: {
    eyebrow: "Decide",
    title: "Attention",
    description: "Review, requested changes, or a planned project whose deadline has passed.",
    empty: "Nothing needs an operational decision right now.",
  },
  planned: {
    eyebrow: "Prepare",
    title: "Planned Queue",
    description: "Committed videos that have not entered production yet.",
    empty: "No planned videos waiting in the queue.",
  },
  completed: {
    eyebrow: "Result",
    title: "Recent / Completed",
    description: "Delivered work remains reachable without crowding the production floor.",
    empty: "No completed videos yet.",
  },
};

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    video?: string | string[];
    planVideo?: string | string[];
    projectId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const requestedVideo = query.video;
  const initialVideoId =
    typeof requestedVideo === "string" && /^\d+$/u.test(requestedVideo)
      ? Number(requestedVideo)
      : null;
  const initialProjectId =
    typeof query.projectId === "string" && /^\d+$/u.test(query.projectId)
      ? Number(query.projectId)
      : null;
  // Brief C §8: Project -> Video -> save/close must return to that
  // Project; Productivity -> Video -> close keeps returning to Productivity
  // (no returnTo present in that link). isSafeInternalPath is the single
  // open-redirect gate -- an unsafe or absent value is simply never
  // forwarded, and VideoEditor's own fallback is "/productivity".
  const rawReturnTo = query.returnTo;
  const safeReturnTo =
    typeof rawReturnTo === "string" && isSafeInternalPath(rawReturnTo)
      ? rawReturnTo
      : undefined;
  const [stats, logs, options, workSessionOverview, sessionHistory, activeSignals, openBlockersByVideo, soonestCommitmentByVideo] =
    await Promise.all([
      getVideoStats(),
      getAllVideoLogs(),
      getProductivityQuickOptions(),
      getWorkSessionOverview(),
      // Local dogfooding consolidation (§6): read-only Today/This Week
      // tracked-time visibility, reusing the exact same grouping the Session
      // Ledger already uses — no new aggregation logic, no schema change.
      // This is INPUT evidence (time spent), never a score, and is never
      // compared against video output counts on this page.
      getWorkSessionHistory(),
      // P0.2 Needs Attention: the exact same canonical read model War Room's
      // Active Signals uses (modules/signals) — see
      // modules/productivity/attention.ts for the execution-relevant subset
      // this page actually shows.
      getActiveSignals(),
      // P0.4 execution queue context.
      getOpenBlockersByVideo(),
      getSoonestOpenCommitmentByVideo(),
    ]);
  const attentionGroups = selectProductivityAttention(activeSignals);
  const recentLogs = logs.slice(0, 50);
  const groups = groupOperationalVideos(recentLogs, {
    today: todayISO(),
    openSessionVideoId: workSessionOverview.openSession?.videoId,
  });
  const sessionSummaryByVideo = new Map(
    workSessionOverview.summaries.map((summary) => [summary.videoId, summary]),
  );
  const { openSessionElapsedSeconds } = workSessionOverview;
  // P0.4: the execution queue is built from the FULL video list (not the
  // 50-row recentLogs slice the grouped sections below use), so an older
  // eligible video is never silently dropped from the queue projection.
  const executionQueue = selectExecutionQueue(logs, {
    blockedVideoIds: new Set(openBlockersByVideo.keys()),
    blockerCategoryByVideoId: openBlockersByVideo,
    soonestCommitmentDueAtByVideoId: soonestCommitmentByVideo,
  });
  // ONE SOURCE FOR NEXT (Tuesday Patch instruction): NOW/FOCUS's
  // recommendation, when no session is open, is exactly the execution
  // queue's first non-blocked, non-awaiting-review item -- no separate
  // ranking is maintained after the queue exists.
  const nextExecutable = selectNextExecutable(executionQueue);
  const recommended: RecommendedNextItem | null = nextExecutable
    ? {
        id: nextExecutable.id,
        title: nextExecutable.title ?? `Video ${nextExecutable.date}`,
        clientName: nextExecutable.clientName,
        projectName: nextExecutable.projectName,
        nextAction: getVideoNextAction(nextExecutable.status),
      }
    : null;
  const sessionDays = groupWorkSessionsByDay(sessionHistory);
  const sessionWeeks = groupWorkSessionDaysByWeek(sessionDays);
  const today = todayISO();
  const todayTrackedSeconds = sessionDays[0]?.dayKey === today ? sessionDays[0].totalClosedSeconds : 0;
  const thisWeekTrackedSeconds =
    sessionWeeks[0]?.weekKey === mondayOfWeek(today) ? sessionWeeks[0].totalClosedSeconds : 0;

  function workSessionStateFor(videoId: number) {
    return {
      summary: sessionSummaryByVideo.get(videoId) ?? {
        videoId,
        closedSeconds: 0,
        sessionCount: 0,
      },
      openSession: workSessionOverview.openSession,
    };
  }

  function renderSection(group: ProductivityGroup, compact = false) {
    const details = sectionDetails[group];
    const videos = groups[group];
    return (
      <section key={group} aria-labelledby={`${group}-videos`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              {details.eyebrow}
            </p>
            <h2 id={`${group}-videos`} className="mt-1 text-lg font-black text-white sm:text-xl">
              {details.title} <span className="font-mono text-sm text-zinc-600">{videos.length}</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">{details.description}</p>
          </div>
          {group === "planned" && (
            <Link href="/projects" className="text-xs font-bold text-cyan-400 hover:text-cyan-300">
              Review projects →
            </Link>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/35 px-4 py-6 text-sm text-zinc-600">
            {details.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => (
              <VideoOperationsCard
                key={video.id}
                video={video}
                clients={options.clients}
                projects={options.projects}
                workSessionState={workSessionStateFor(video.id)}
                initiallyOpen={initialVideoId === video.id}
                returnTo={initialVideoId === video.id ? safeReturnTo : undefined}
                compact={compact}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
            Client → project → video → work → review → result
          </p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">🎬 Productivity</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            The RMEDIA production floor: what is moving, what needs a decision, and what comes next.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Productivity relationships">
          <Link href="/projects" className="min-h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-cyan-300 hover:border-cyan-500/40">
            Projects
          </Link>
          <Link href="/crm" className="min-h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-300 hover:border-zinc-600">
            CRM
          </Link>
        </nav>
      </header>

      <NeedsAttentionSection groups={attentionGroups} />

      <NowFocusPanel
        openSession={workSessionOverview.openSession}
        openSessionElapsedSeconds={openSessionElapsedSeconds}
        recommended={recommended}
        variant="dominant"
      >
        {workSessionOverview.openSession && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <QuickNote videoId={workSessionOverview.openSession.videoId} />
            <QuickBlock videoId={workSessionOverview.openSession.videoId} />
          </div>
        )}
      </NowFocusPanel>

      <ExecutionQueueSection
        queue={executionQueue}
        activeVideoId={workSessionOverview.openSession?.videoId ?? null}
      />

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Capture</p>
            <h2 className="mt-1 text-base font-black text-white">Quick actions</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Plan work first. Finished Video remains available as a utility — register a correction from inside a video&apos;s own workspace instead.
              Press <kbd className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">⌘K</kbd> anywhere to capture a deadline, blocker, correction, follow-up, note, or backfilled work time without leaving this page.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[720px] lg:grid-cols-4">
            <PlanVideoButton
              initialProjectId={initialProjectId}
              initiallyOpen={query.planVideo === "1"}
            />
            <FinishedVideoButton />
            <Link
              href="/productivity/backfill"
              className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-300 transition hover:border-violet-500/60 hover:text-white"
            >
              Backfill a day →
            </Link>
            <Link
              href="/productivity/captures"
              className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-300 transition hover:border-violet-500/60 hover:text-white"
            >
              Capture Inbox →
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Today" value={stats.today} accent="violet" icon="🎬" />
        <StatCard label="This Week" value={stats.week} accent="violet" icon="📅" />
        <StatCard label="This Month" value={stats.month} sub={currentMonthName()} accent="violet" icon="🗓️" />
        <StatCard label="Revisions" value={stats.totalRevisions} accent="zinc" icon="🔄" />
        <StatCard label="All Videos" value={stats.total} accent="zinc" icon="🏆" />
      </div>

      <div className="space-y-10">
        {renderSection("current")}
        {renderSection("attention")}
        {renderSection("planned")}
        {renderSection("completed", true)}
      </div>

      <footer className="mt-10 border-t border-zinc-800 pt-5 text-xs text-zinc-600">
        Closed work is aggregated from raw Work Sessions. Open sessions never inflate tracked totals.
        {workSessionOverview.summaries.length > 0 && (
          <> Current tracked archive: {formatClosedDuration(workSessionOverview.summaries.reduce((sum, item) => sum + item.closedSeconds, 0))}.</>
        )}
        {/* Local dogfooding consolidation (§6): input evidence only — how
            much time was tracked, not a judgment of output or performance.
            Omitted entirely (not shown as "0m") when nothing has been
            tracked yet today/this week, matching the ledger's own
            evidence-only-when-it-exists convention. */}
        {todayTrackedSeconds > 0 && <> Today: {formatClosedDuration(todayTrackedSeconds)}.</>}
        {thisWeekTrackedSeconds > 0 && <> This week: {formatClosedDuration(thisWeekTrackedSeconds)}.</>}{" "}
        <Link href="/productivity/sessions" className="font-semibold text-cyan-500 hover:text-cyan-400">
          Session history →
        </Link>
      </footer>
    </div>
  );
}
