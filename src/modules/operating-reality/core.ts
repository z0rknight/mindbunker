import type { CurrentExecution, ExecutionRecommendation } from "../execution/core.ts";
import type { ProjectOverviewItem } from "../projects/core.ts";
import { getProjectProgress, isProjectCurrent } from "../projects/core.ts";
import type { MonthlyFinanceRow } from "../reality/core.ts";
import type { Signal } from "../signals/core.ts";

export type CoverageState = "COMPLETE" | "PARTIAL" | "NO_EVIDENCE";

export type RealityProvenance = {
  owner: string;
  source: string;
  coverage: CoverageState;
  note: string;
};

export type OperatingMoneyRow = {
  currency: string;
  received: number;
  receivable: number;
  expectedRegistered: number;
};

export function buildMoneyReality(
  finance: readonly MonthlyFinanceRow[],
  openCommercial: readonly { currency: string; amount: number }[],
): OperatingMoneyRow[] {
  const currencies = new Set([
    ...finance.map((row) => row.currency),
    ...openCommercial.map((row) => row.currency),
  ]);
  return [...currencies].sort().map((currency) => ({
    currency,
    received: finance.find((row) => row.currency === currency)?.cashReceived ?? 0,
    receivable: openCommercial
      .filter((row) => row.currency === currency)
      .reduce((sum, row) => sum + row.amount, 0),
    expectedRegistered: finance.find((row) => row.currency === currency)?.registeredBilling ?? 0,
  }));
}

export type ProjectRealityRow = {
  id: number;
  name: string;
  canonicalClientId: number;
  canonicalClientName: string;
  workClass: "CLIENT" | "INTERNAL";
  status: ProjectOverviewItem["status"];
  progress: number;
  doneDeliverables: number;
  totalDeliverables: number;
  openDeliverables: number;
  blockerCount: number;
};

export type ClientLoadRow = {
  clientId: number;
  clientName: string;
  projectCount: number;
  openDeliverables: number;
};

export type DeliveryReality = {
  currentProjects: ProjectRealityRow[];
  currentProjectCount: number;
  openDeliverables: number;
  waitingCount: number;
  blockedProjectCount: number;
  structuralIssueCount: number;
  clientLoad: ClientLoadRow[];
  internalProjectCount: number;
};

export function buildDeliveryReality(
  projects: readonly ProjectOverviewItem[],
  structuralIssueCount: number,
): DeliveryReality {
  const current = projects.filter(isProjectCurrent);
  const currentProjects = current.map((project) => ({
    id: project.id,
    name: project.name,
    canonicalClientId: project.canonicalClientId,
    canonicalClientName: project.canonicalClientName,
    workClass: project.workClass,
    status: project.status,
    progress: getProjectProgress(project),
    doneDeliverables: project.doneVideos,
    totalDeliverables: project.totalVideos,
    openDeliverables: Math.max(0, project.totalVideos - project.doneVideos),
    blockerCount: project.openBlockerCount,
  }));
  const byClient = new Map<number, ClientLoadRow>();
  for (const project of currentProjects.filter((row) => row.workClass === "CLIENT")) {
    const existing = byClient.get(project.canonicalClientId);
    if (existing) {
      existing.projectCount += 1;
      existing.openDeliverables += project.openDeliverables;
    } else {
      byClient.set(project.canonicalClientId, {
        clientId: project.canonicalClientId,
        clientName: project.canonicalClientName,
        projectCount: 1,
        openDeliverables: project.openDeliverables,
      });
    }
  }
  return {
    currentProjects,
    currentProjectCount: currentProjects.length,
    openDeliverables: currentProjects.reduce((sum, row) => sum + row.openDeliverables, 0),
    waitingCount: projects.filter((project) => project.status === "review").length,
    blockedProjectCount: currentProjects.filter((project) => project.blockerCount > 0).length,
    structuralIssueCount,
    clientLoad: [...byClient.values()].sort(
      (a, b) => b.openDeliverables - a.openDeliverables || a.clientName.localeCompare(b.clientName),
    ),
    internalProjectCount: currentProjects.filter((row) => row.workClass === "INTERNAL").length,
  };
}

export type RecordedSessionFact = {
  startedAt: number;
  endedAt: number | null;
  activityType: string;
  clientName: string | null;
  clientStatus: string | null;
  clientSource: string | null;
};

export type RecordedWorkReality = {
  recordedSeconds: number;
  clientSeconds: number;
  internalSeconds: number;
  adminSeconds: number;
  leadSeconds: number;
  unclassifiedSeconds: number;
  sessionCount: number;
  excludedSeconds: number;
  excludedCount: number;
};

export function computeRecordedWorkReality(
  rows: readonly RecordedSessionFact[],
): RecordedWorkReality {
  return rows.reduce<RecordedWorkReality>((total, row) => {
    if (row.endedAt === null) return total;
    const seconds = Math.max(0, row.endedAt - row.startedAt);
    if (seconds > 43_200 || row.clientSource === "RELEASE_TEST") {
      total.excludedSeconds += seconds;
      total.excludedCount += 1;
      return total;
    }
    total.recordedSeconds += seconds;
    total.sessionCount += 1;
    if (!row.clientName || !row.clientStatus) total.unclassifiedSeconds += seconds;
    else if (row.clientStatus === "lead") total.leadSeconds += seconds;
    else if (row.clientName === "RMEDIA" && row.activityType === "ADMIN") total.adminSeconds += seconds;
    else if (row.clientName === "RMEDIA") total.internalSeconds += seconds;
    else total.clientSeconds += seconds;
    return total;
  }, {
    recordedSeconds: 0,
    clientSeconds: 0,
    internalSeconds: 0,
    adminSeconds: 0,
    leadSeconds: 0,
    unclassifiedSeconds: 0,
    sessionCount: 0,
    excludedSeconds: 0,
    excludedCount: 0,
  });
}

export type OutputEvent = {
  id: number;
  videoId: number | null;
  title: string;
  occurredAt: string;
  eventType: "video.finished";
};

export type OperatingReality = {
  generatedAt: string;
  currentOperation: {
    state: "ACTIVE" | "IDLE";
    current: CurrentExecution | null;
    recommendation: ExecutionRecommendation | null;
    provenance: RealityProvenance;
  };
  money: {
    monthKey: string;
    rows: OperatingMoneyRow[];
    provenance: RealityProvenance;
  };
  delivery: DeliveryReality & {
    mostUrgentCommitment: {
      id: number;
      title: string;
      dueAt: string;
      videoId: number;
      videoTitle: string | null;
      clientName: string | null;
      projectName: string | null;
    } | null;
    provenance: RealityProvenance;
  };
  work: RecordedWorkReality & {
    windowLabel: string;
    windowStart: string;
    windowEnd: string;
    observedActiveSeconds: number;
    observedCoverageSeconds: number;
    sensorIntentionalSeconds: number;
    sensorTelemetrySeconds: number;
    sensorUncoveredSeconds: number;
    provenance: RealityProvenance;
  };
  output: {
    events: OutputEvent[];
    provenance: RealityProvenance;
  };
  load: {
    openProjects: number;
    openDeliverables: number;
    waitingExternal: number;
    blockedProjects: number;
    availabilityEvidence: null;
    provenance: RealityProvenance;
  };
  signals: {
    items: Signal[];
    total: number;
    provenance: RealityProvenance;
  };
};
