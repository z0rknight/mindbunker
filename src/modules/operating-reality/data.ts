import "server-only";

import { getAuthenticatedDb } from "@/db";
import { getRelationshipIntegrity } from "@/modules/crm/integrity-data";
import { getExecutionSnapshot } from "@/modules/execution/data";
import { getProjectsOverview, getUnassignedClientVideos } from "@/modules/projects/actions";
import { getMonthlyReality } from "@/modules/reality/data";
import { getApplicationUsage } from "@/modules/sensor/data";
import { classifyWindowSurface, normalizeApplication, resolveTimeWindow } from "@/modules/sensor/app-intelligence";
import { dayKeyFor } from "@/modules/work-sessions/core";
import { getActiveSignals, getOpenCommitmentsWithContext } from "@/modules/signals";
import { rankOpenCommitments } from "@/modules/signals/core";
import { currentMonthKey } from "@/utils/date";
import {
  buildDeliveryReality,
  buildMoneyReality,
  computeDailyOperatingReality,
  computeRecordedWorkReality,
  getDailyRealityCoverage,
  type OperatingReality,
  type OutputEvent,
  type RecordedSessionFact,
  type RealityProvenance,
} from "./core";

type D1Result<T> = { results: T[] };

async function all<T>(statement: Promise<D1Result<T>>): Promise<T[]> {
  return (await statement).results ?? [];
}

async function getSevenDayFacts(nowIso: string) {
  const db = await getAuthenticatedDb();
  const window = resolveTimeWindow("LAST_7_DAYS", nowIso);
  const [sessionRows, outputRows] = await Promise.all([
    all(db.$client.prepare(`
      SELECT ws.started_at, ws.ended_at, ws.activity_type,
        c.name AS client_name, c.status AS client_status, c.source AS client_source
      FROM work_sessions ws
      JOIN video_logs v ON v.id = ws.video_id
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE ws.started_at >= ?1 AND ws.started_at < ?2
      ORDER BY ws.started_at DESC
    `).bind(window.startSeconds, window.endSeconds).all<{
      started_at: number;
      ended_at: number | null;
      activity_type: string;
      client_name: string | null;
      client_status: string | null;
      client_source: string | null;
    }>()),
    all(db.$client.prepare(`
      SELECT e.id, e.video_id, e.type, e.description, e.created_at,
        COALESCE(v.title, 'Video ' || v.date) AS video_title
      FROM crm_events e
      LEFT JOIN video_logs v ON v.id = e.video_id
      WHERE e.type = 'video.finished'
        AND e.created_at >= ?1 AND e.created_at < ?2
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 8
    `).bind(window.startSeconds, window.endSeconds).all<{
      id: number;
      video_id: number | null;
      type: "video.finished";
      description: string;
      created_at: number;
      video_title: string | null;
    }>()),
  ]);

  const sessions: RecordedSessionFact[] = sessionRows.map((row) => ({
    startedAt: Number(row.started_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    activityType: row.activity_type,
    clientName: row.client_name,
    clientStatus: row.client_status,
    clientSource: row.client_source,
  }));
  const outputs: OutputEvent[] = outputRows.map((row) => ({
    id: Number(row.id),
    videoId: row.video_id === null ? null : Number(row.video_id),
    title: row.video_title ?? row.description,
    occurredAt: new Date(Number(row.created_at) * 1_000).toISOString(),
    eventType: "video.finished",
  }));
  return { window, sessions, outputs };
}

async function getDailyFacts(nowIso: string) {
  const db = await getAuthenticatedDb();
  const window = resolveTimeWindow("TODAY", nowIso);
  const [sessionRows, observationRows] = await Promise.all([
    all(db.$client.prepare(`
      SELECT ws.started_at, ws.ended_at, ws.activity_type,
        c.name AS client_name, c.status AS client_status, c.source AS client_source
      FROM work_sessions ws
      JOIN video_logs v ON v.id = ws.video_id
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE ws.started_at < ?2 AND COALESCE(ws.ended_at, ?2) > ?1
      ORDER BY ws.started_at ASC
    `).bind(window.startSeconds, window.endSeconds).all<{
      started_at: number;
      ended_at: number | null;
      activity_type: string;
      client_name: string | null;
      client_status: string | null;
      client_source: string | null;
    }>()),
    all(db.$client.prepare(`
      SELECT app_name, bundle_id, window_title, started_at, ended_at, idle,
        keystroke_count, mouse_movement_count
      FROM device_activity_observations
      WHERE started_at < ?2 AND ended_at > ?1
      ORDER BY started_at ASC
    `).bind(window.startSeconds, window.endSeconds).all<{
      app_name: string;
      bundle_id: string | null;
      window_title: string | null;
      started_at: number;
      ended_at: number;
      idle: number;
      keystroke_count: number | null;
      mouse_movement_count: number | null;
    }>()),
  ]);
  return computeDailyOperatingReality({
    dateKey: dayKeyFor(nowIso),
    windowStart: window.startSeconds,
    windowEnd: window.endSeconds,
    sessions: sessionRows.map((row) => ({
      startedAt: Number(row.started_at),
      endedAt: row.ended_at === null ? null : Number(row.ended_at),
      activityType: row.activity_type,
      clientName: row.client_name,
      clientStatus: row.client_status,
      clientSource: row.client_source,
    })),
    observations: observationRows.map((row) => {
      const appKey = normalizeApplication(row.bundle_id, row.app_name);
      return {
        appKey,
        surface: classifyWindowSurface(appKey, row.window_title),
        startedAt: Number(row.started_at),
        endedAt: Number(row.ended_at),
        idle: Boolean(row.idle),
        keystrokeCount: row.keystroke_count === null ? null : Number(row.keystroke_count),
        mouseMovementCount: row.mouse_movement_count === null ? null : Number(row.mouse_movement_count),
      };
    }),
  });
}

function provenance(
  owner: string,
  source: string,
  coverage: RealityProvenance["coverage"],
  note: string,
): RealityProvenance {
  return { owner, source, coverage, note };
}

export async function getOperatingReality(): Promise<OperatingReality> {
  const generatedAt = new Date().toISOString();
  const monthKey = currentMonthKey(new Date(generatedAt));
  const [
    execution,
    monthly,
    projects,
    unassignedVideos,
    integrity,
    commitments,
    sevenDay,
    daily,
    sensorUsage,
  ] = await Promise.all([
    getExecutionSnapshot("/"),
    getMonthlyReality(monthKey),
    getProjectsOverview(),
    getUnassignedClientVideos(),
    getRelationshipIntegrity(),
    getOpenCommitmentsWithContext(),
    getSevenDayFacts(generatedAt),
    getDailyFacts(generatedAt),
    getApplicationUsage("LAST_7_DAYS"),
  ]);
  const signals = await getActiveSignals(commitments);
  const structuralIssues = integrity.issues.filter((issue) =>
    ["client", "project", "video"].includes(issue.entityType),
  );
  const delivery = buildDeliveryReality(
    projects,
    structuralIssues.length + unassignedVideos.length,
  );
  const work = computeRecordedWorkReality(sevenDay.sessions);
  const observedActiveSeconds = sensorUsage.observed.reduce((sum, row) => sum + row.seconds, 0);
  const rankedCommitments = rankOpenCommitments(commitments, new Date(generatedAt));
  const mostUrgent = rankedCommitments[0] ?? null;
  const moneyRows = buildMoneyReality(monthly.finance, monthly.operations.openCommercial);
  const financePartial = monthly.coverage.some((row) =>
    ["FINANCE", "CLIENT_ATTRIBUTION", "SOURCE_AUTHORITY"].includes(row.key) && row.status !== "GREEN",
  );
  const workPartial = work.excludedCount > 0 || work.unclassifiedSeconds > 0;

  return {
    generatedAt,
    currentOperation: {
      state: execution.current ? "ACTIVE" : "IDLE",
      current: execution.current,
      recommendation: execution.recommendation,
      provenance: provenance(
        "Execution / War Room",
        "Open Work Session + execution-policy-v1",
        execution.current || execution.recommendation ? "COMPLETE" : "NO_EVIDENCE",
        "The Dashboard observes this projection. Start, stop, queue and notes remain in War Room.",
      ),
    },
    daily: {
      ...daily,
      provenance: provenance(
        "Work Sessions + Sensor",
        "canonical work_sessions / device_activity_observations",
        getDailyRealityCoverage(daily),
        "Intentional categories come only from canonical Work Sessions. Apps, idle and input counts are descriptive Sensor telemetry. Observed activity outside a Session stays unclassified.",
      ),
    },
    money: {
      monthKey,
      rows: moneyRows,
      provenance: provenance(
        "Finance",
        "transactions / OPEN payment_requests / billing_evidence",
        moneyRows.length === 0 ? "NO_EVIDENCE" : financePartial ? "PARTIAL" : "COMPLETE",
        "Received is cash evidence; receivable is an open request; expected is registered billing evidence. They are not interchangeable.",
      ),
    },
    delivery: {
      ...delivery,
      mostUrgentCommitment: mostUrgent ? {
        id: mostUrgent.id,
        title: mostUrgent.title,
        dueAt: mostUrgent.dueAt.toISOString(),
        videoId: mostUrgent.videoId,
        videoTitle: mostUrgent.videoTitle,
        clientName: mostUrgent.clientName,
        projectName: mostUrgent.projectName,
      } : null,
      provenance: provenance(
        "Projects + Commitments",
        "Wave 4 Project overview + OPEN commitments",
        delivery.structuralIssueCount > 0 ? "PARTIAL" : "COMPLETE",
        "Project membership and progress are consumed from the structural owner; no Dashboard formula owns them.",
      ),
    },
    work: {
      ...work,
      windowLabel: sevenDay.window.label,
      windowStart: new Date(sevenDay.window.startSeconds * 1_000).toISOString(),
      windowEnd: new Date(sevenDay.window.endSeconds * 1_000).toISOString(),
      observedActiveSeconds,
      observedCoverageSeconds: sensorUsage.coverageSeconds,
      sensorIntentionalSeconds: sensorUsage.sessionCoverage.sessionSeconds,
      sensorTelemetrySeconds: sensorUsage.sessionCoverage.telemetrySeconds,
      sensorUncoveredSeconds: sensorUsage.sessionCoverage.uncoveredSeconds,
      provenance: provenance(
        "Sessions + Sensor",
        "work_sessions / device_activity_observations / sensor_sessions",
        work.recordedSeconds === 0 && observedActiveSeconds === 0
          ? "NO_EVIDENCE"
          : workPartial ? "PARTIAL" : "COMPLETE",
        "Recorded work and observed computer activity are parallel evidence, never added together.",
      ),
    },
    output: {
      events: sevenDay.outputs,
      provenance: provenance(
        "Video lifecycle",
        "Timestamped crm_events.type = video.finished",
        sevenDay.outputs.length > 0 ? "COMPLETE" : "NO_EVIDENCE",
        "Only historical completion transitions are output. Current DONE rows are not counted as events.",
      ),
    },
    load: {
      openProjects: delivery.currentProjectCount,
      openDeliverables: delivery.openDeliverables,
      waitingExternal: delivery.waitingCount,
      blockedProjects: delivery.blockedProjectCount,
      availabilityEvidence: null,
      provenance: provenance(
        "Projects",
        "Wave 4 current Project projection",
        delivery.currentProjectCount > 0 ? "COMPLETE" : "NO_EVIDENCE",
        "No availability calendar exists, so this is open workload — not a capacity score.",
      ),
    },
    signals: {
      items: signals.slice(0, 5),
      total: signals.length,
      provenance: provenance(
        "Signals",
        "Canonical Active Signals read model",
        signals.length > 0 ? "COMPLETE" : "NO_EVIDENCE",
        "Compact exceptions only; detailed resolution remains in the owning surface.",
      ),
    },
  };
}
