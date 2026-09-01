import { notFound } from "next/navigation";
import { LOCAL_LAB_ENABLED } from "@/lib/local-features";
import { listOpenCommitments } from "@/modules/commitments/data";
import { getLabOwnerOptions, getQaAvoidableFailureStats, getFactoryState } from "./data";
import { getWorkSessionOverview, getVideoOptionsForCorrection } from "@/modules/work-sessions/data";
import { listRecentFrictionEvents } from "@/modules/friction/actions";
import { getLabCrmSummary } from "./crm-data";
import { getLabTimeline } from "./timeline-data";
import { listDecisionLog } from "@/modules/decision-log/actions";
import { listBlockers } from "@/modules/blockers/actions";
import { listRepairableSessions } from "@/modules/work-session-repair/actions";
import { WorkSessionRepairPanel } from "./WorkSessionRepairPanel";
import { getSystemCandidates, listSystemInterventions } from "@/modules/system-candidates/actions";
import { listClaims } from "@/modules/claims/actions";
import { getTodayState } from "@/modules/daily-state/actions";
import { getMorningBrief, getEndOfDayClose, getWeeklyFactoryReport, getCapacityPressure } from "./ops-data";
import { getPromiseAccuracySummary } from "./promise-accuracy-data";
import { getCurrentWorkContext } from "./current-work-data";
import { getCurrentProjectsBoard } from "./current-projects-data";
import { listObjectives } from "@/modules/objectives/actions";
import { getBusinessPressureFacts } from "./business-pressure-data";
import { listOpenActionItems } from "@/modules/action-items/actions";
import { listRecentIngestionEvents } from "@/modules/asset-readiness/ingestion-actions";
import { listVideoIdeas } from "@/modules/video-idea/actions";
import { StatCard } from "@/components/ui/StatCard";
import { CommitmentForm } from "./CommitmentForm";
import { CommitmentList } from "./CommitmentList";
import { WorkSessionGuardian } from "./WorkSessionGuardian";
import { RevisionClassifyForm } from "./RevisionClassifyForm";
import { LabWorkspace } from "./LabWorkspace";
import { FactoryStatePanel } from "./FactoryStatePanel";
import { FrictionOverview } from "./FrictionOverview";
import { CrmOperatorPanel } from "./CrmOperatorPanel";
import { TimelinePanel } from "./TimelinePanel";
import { DecisionLogPanel } from "./DecisionLogPanel";
import { BlockersPanel } from "./BlockersPanel";
import { SystemPanel } from "./SystemPanel";
import { ClaimsPanel } from "./ClaimsPanel";
import { WakeUpForm } from "./WakeUpForm";
import { MorningBriefPanel, EndOfDayPanel, WeeklyReportPanel, CapacityPanel, WhatChangedPanel } from "./OpsPanels";
import { GlobalQuickCapture } from "./GlobalQuickCapture";
import { CommandPalette } from "./CommandPalette";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { CurrentWorkPanel } from "./CurrentWorkPanel";
import { CurrentProjectsBoard } from "./CurrentProjectsBoard";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { BusinessPressurePanel } from "./BusinessPressurePanel";
import { FinanceContextPanel } from "./FinanceContextPanel";
import { ActionRadarPanel } from "./ActionRadarPanel";
import { IngestEventPanel } from "./IngestEventPanel";
import { EconomicsPanel } from "./EconomicsPanel";
import { VideoIdeaPanel } from "./VideoIdeaPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { OperatorSnapshotPanel } from "./OperatorSnapshotPanel";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  if (!LOCAL_LAB_ENABLED) notFound();

  const [
    commitments, ownerOptions, qaStats, sessionOverview, videoOptions, frictionEvents,
    factoryState, crmSummary, timeline, decisionLog, blockers, systemCandidates,
    systemInterventions, claims, todayState, morningBrief, endOfDay, weeklyReport,
    capacity, promiseAccuracy, repairableSessions,
    currentWork, projectsBoard, objectives, pressure, radarItems, ingestionEvents, videoIdeas,
  ] = await Promise.all([
    listOpenCommitments(), getLabOwnerOptions(), getQaAvoidableFailureStats(30), getWorkSessionOverview(),
    getVideoOptionsForCorrection(), listRecentFrictionEvents(50), getFactoryState(), getLabCrmSummary(),
    getLabTimeline(), listDecisionLog(), listBlockers(), getSystemCandidates(), listSystemInterventions(),
    listClaims(), getTodayState(), getMorningBrief(), getEndOfDayClose(), getWeeklyFactoryReport(),
    getCapacityPressure(), getPromiseAccuracySummary(), listRepairableSessions(),
    getCurrentWorkContext(), getCurrentProjectsBoard(), listObjectives(), getBusinessPressureFacts(),
    listOpenActionItems(100), listRecentIngestionEvents(20), listVideoIdeas(),
  ]);

  const overdueCommitments = commitments.filter((c) => c.dueAt && new Date(c.dueAt) < new Date());
  const nextCommitment = commitments[0] ?? null;
  const paletteItems = [
    ...ownerOptions.clients.map((c) => ({ id: c.id, name: c.name, kind: "client" as const })),
    ...ownerOptions.projects.map((p) => ({ id: p.id, name: p.name, kind: "project" as const })),
    ...ownerOptions.videos.map((v) => ({ id: v.id, title: v.title, kind: "video" as const })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:p-8">
      <CommandPalette items={paletteItems} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">🧪 Local Lab — Wave 4</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Operations / Evidence / CRM / Factory Intelligence · local-only · ⌘K for command palette
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Open commitments" value={String(commitments.length)} sub="All owners" accent="violet" icon="🤝" />
        <StatCard label="Overdue" value={String(overdueCommitments.length)} sub="Past due, still open" accent={overdueCommitments.length > 0 ? "red" : "green"} icon="⏰" />
        <StatCard
          label="Avoidable QA rate (30d)"
          value={qaStats.avoidableRate !== null ? `${Math.round(qaStats.avoidableRate * 100)}%` : "—"}
          sub={`${qaStats.classified} classified revision${qaStats.classified === 1 ? "" : "s"}`}
          accent="amber" icon="🔁"
        />
        <StatCard label="Capacity" value={capacity.level} sub={`${capacity.reasons.length} signal(s)`} accent={capacity.level === "HIGH" ? "red" : capacity.level === "MEDIUM" ? "amber" : "green"} icon="📊" />
      </div>

      <div className="mb-6">
        <WarRoomPanel
          currentWork={currentWork}
          radarTop={radarItems.slice(0, 5)}
          objectives={objectives}
          pressure={pressure}
          factory={factoryState}
        />
      </div>

      <div id="current-work" className="grid gap-6 md:grid-cols-2 mb-6">
        <CurrentWorkPanel context={currentWork} />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm font-semibold text-white mb-2">Current Projects</p>
          <div className="max-h-96 overflow-y-auto">
            <CurrentProjectsBoard board={projectsBoard} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div id="morning" className="space-y-4">
          <WakeUpForm today={todayState} />
          <MorningBriefPanel brief={morningBrief} />
        </div>
        <EndOfDayPanel close={endOfDay} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div id="factory">
          <FactoryStatePanel
            openSession={sessionOverview.openSession}
            nextCommitment={nextCommitment}
            overdueCommitments={overdueCommitments}
            stale={sessionOverview.openSessionStale}
            avoidableQaCount={qaStats.ourError}
            factory={factoryState}
          />
        </div>
        <div id="timeline" className="space-y-4">
          <TimelinePanel timeline={timeline} />
          <WhatChangedPanel today={timeline.today} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Commitments</h2>
          <CommitmentForm clients={ownerOptions.clients} projects={ownerOptions.projects} videos={ownerOptions.videos} />
          <CommitmentList commitments={commitments} />
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs text-zinc-300">Promise Accuracy: {promiseAccuracy.onTimeCount} on-time, {promiseAccuracy.lateCount} late (of {promiseAccuracy.sampleCount})</p>
            <EvidenceDrawer label="promise accuracy" sources={[`FACT: ${promiseAccuracy.sampleCount} delivery-commitment pair(s) with both a due date and a delivery`, "DERIVED: on-time = deliveredAt <= dueAt", "Never shown as a bare percentage below 5 samples"]} />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Work Session Guardian</h2>
          <WorkSessionGuardian openSession={sessionOverview.openSession} elapsedSeconds={sessionOverview.openSessionElapsedSeconds} videoOptions={videoOptions} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 pt-2">QA Provenance (quick log)</h2>
          <RevisionClassifyForm videos={ownerOptions.videos} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 pt-2">Work Session Repair</h2>
          <WorkSessionRepairPanel sessions={repairableSessions} />
        </div>
      </div>

      <div id="workbench" className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Video Workbench + Quick Capture</h2>
        <LabWorkspace videos={videoOptions} />
      </div>

      <div className="mb-6">
        <GlobalQuickCapture clients={ownerOptions.clients} projects={ownerOptions.projects} videos={ownerOptions.videos} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <FrictionOverview events={frictionEvents} />
        <BlockersPanel blockers={blockers} clients={ownerOptions.clients} projects={ownerOptions.projects} videos={ownerOptions.videos} />
      </div>

      <div id="action-radar" className="grid gap-6 md:grid-cols-2 mb-6">
        <ActionRadarPanel items={radarItems} clients={ownerOptions.clients} projects={ownerOptions.projects} videos={ownerOptions.videos} />
        <div id="objectives">
          <ObjectivesPanel objectives={objectives} />
        </div>
      </div>

      <div id="crm" className="grid gap-6 md:grid-cols-2 mb-6">
        <CrmOperatorPanel summary={crmSummary} />
        <SystemPanel candidates={systemCandidates} interventions={systemInterventions} />
      </div>

      <div id="weekly" className="grid gap-6 md:grid-cols-2 mb-6">
        <WeeklyReportPanel report={weeklyReport} />
        <CapacityPanel capacity={capacity} />
      </div>

      <div id="business-pressure" className="grid gap-6 md:grid-cols-2 mb-6">
        <BusinessPressurePanel facts={pressure} />
        <FinanceContextPanel videos={ownerOptions.videos} />
      </div>

      <div id="economics" className="grid gap-6 md:grid-cols-2 mb-6">
        <EconomicsPanel clients={ownerOptions.clients} projects={ownerOptions.projects} />
        <VideoIdeaPanel clients={ownerOptions.clients} ideas={videoIdeas} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <IngestEventPanel videos={ownerOptions.videos} events={ingestionEvents} />
        <OperatorSnapshotPanel videos={ownerOptions.videos} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <ClaimsPanel claims={claims} />
        <DecisionLogPanel log={decisionLog} />
      </div>
    </div>
  );
}
