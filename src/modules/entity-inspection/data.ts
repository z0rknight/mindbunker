import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  blockers,
  clients,
  commitments,
  crmEvents,
  projects,
  sensorDevices,
  transactions,
  videoLogs,
  workSessions,
} from "@/db/schema";
import {
  canonicalClientId,
  clientWorkMode,
  isOperationalAliasClientId,
} from "@/lib/client-identity";
import {
  entityFullPageHref,
  isInspectableEntity,
  type InspectableEntity,
} from "@/lib/entity-navigation";
import { getRelationshipIntegrity } from "@/modules/crm/integrity-data";
import { getExecutionSnapshot } from "@/modules/execution/data";
import { getProjectNextAction, getProjectProgress } from "@/modules/projects/core";
import { getProjectsOverview } from "@/modules/projects/actions";
import { getVideoNextAction } from "@/modules/productivity/core";
import { videoClosedSeconds } from "@/modules/work-sessions/data";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type {
  ClientInspection,
  EntityInspectionResult,
  InspectionAction,
  InspectionClientIdentity,
  ProjectInspection,
  SessionInspection,
  VideoInspection,
} from "./core";

async function resolveClientIdentity(operationalId: number): Promise<{
  identity: InspectionClientIdentity | null;
  archivalState: "ACTIVE_SURFACE" | "GELADEIRA" | null;
  issue: string | null;
}> {
  const db = await getAuthenticatedDb();
  const canonicalId = canonicalClientId(operationalId);
  const ids = canonicalId === operationalId ? [canonicalId] : [operationalId, canonicalId];
  const rows = await db
    .select({ id: clients.id, name: clients.name, archivalState: clients.archivalState })
    .from(clients)
    .where(inArray(clients.id, ids));
  const canonical = rows.find((row) => row.id === canonicalId) ?? null;
  const operational = rows.find((row) => row.id === operationalId) ?? null;
  if (!canonical) {
    return {
      identity: null,
      archivalState: null,
      issue: `Operational client #${operationalId} points to missing canonical client #${canonicalId}.`,
    };
  }
  if (!operational) {
    return {
      identity: null,
      archivalState: canonical.archivalState,
      issue: `Referenced operational client #${operationalId} is missing.`,
    };
  }
  return {
    identity: {
      id: canonical.id,
      name: canonical.name,
      operationalId: operational.id,
      operationalName: operational.name,
      workMode: clientWorkMode(operational.id),
      aliasContext:
        operational.id === canonical.id ? null : `Operational context: ${operational.name}`,
    },
    archivalState: canonical.archivalState,
    issue: null,
  };
}

function issuesFor(
  integrity: Awaited<ReturnType<typeof getRelationshipIntegrity>>,
  ids: { clients?: number[]; projects?: number[]; videos?: number[] },
): string[] {
  const clientIds = new Set(ids.clients ?? []);
  const projectIds = new Set(ids.projects ?? []);
  const videoIds = new Set(ids.videos ?? []);
  return integrity.issues
    .filter((issue) =>
      (issue.entityType === "client" && clientIds.has(issue.entityId)) ||
      (issue.entityType === "project" && projectIds.has(issue.entityId)) ||
      (issue.entityType === "video" && videoIds.has(issue.entityId)),
    )
    .map((issue) => issue.message);
}

async function clientInspection(ref: InspectableEntity): Promise<EntityInspectionResult> {
  const db = await getAuthenticatedDb();
  const canonicalId = canonicalClientId(ref.id);
  const [allClients, integrity] = await Promise.all([
    db.select({
      id: clients.id,
      name: clients.name,
      status: clients.status,
      archivalState: clients.archivalState,
      nextAction: clients.nextAction,
      nextActionDate: clients.nextActionDate,
    }).from(clients),
    getRelationshipIntegrity(),
  ]);
  const canonical = allClients.find((row) => row.id === canonicalId) ?? null;
  if (!canonical) {
    return { status: "not_found", ref, message: `Canonical Client #${canonicalId} was not found.` };
  }

  const relationshipRows = allClients.filter((row) => canonicalClientId(row.id) === canonicalId);
  const relationshipIds = relationshipRows.map((row) => row.id);
  const [projectRows, videoRows, eventRows, revenueRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(inArray(projects.clientId, relationshipIds))
      .orderBy(desc(projects.updatedAt), desc(projects.id)),
    db.select({ id: videoLogs.id, title: videoLogs.title, date: videoLogs.date, status: videoLogs.status })
      .from(videoLogs)
      .where(and(
        inArray(videoLogs.clientId, relationshipIds),
        isNull(videoLogs.cancelledAt),
        ne(videoLogs.status, "DONE"),
      ))
      .orderBy(desc(videoLogs.updatedAt), desc(videoLogs.id))
      .limit(8),
    db.select({
      type: crmEvents.type,
      description: crmEvents.description,
      createdAt: crmEvents.createdAt,
    })
      .from(crmEvents)
      .where(inArray(crmEvents.clientId, relationshipIds))
      .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id))
      .limit(20),
    db.select({
      currency: transactions.currency,
      amount: sql<number>`sum(${transactions.amount})`,
    })
      .from(transactions)
      .where(and(inArray(transactions.clientId, relationshipIds), eq(transactions.type, "income")))
      .groupBy(transactions.currency),
  ]);
  const activeProjects = projectRows.filter((project) =>
    project.status === "planned" || project.status === "active" || project.status === "review",
  );
  const lastRelationshipEvent = eventRows.find((event) => !event.type.startsWith("work_session.")) ?? null;
  const aliases = relationshipRows
    .filter((row) => isOperationalAliasClientId(row.id))
    .map((row) => ({ id: row.id, name: row.name, workMode: clientWorkMode(row.id) }));
  const integrityIssues = issuesFor(integrity, {
    clients: relationshipIds,
    projects: projectRows.map((row) => row.id),
    videos: videoRows.map((row) => row.id),
  });

  const inspection: ClientInspection = {
    kind: "client",
    ref: { type: "client", id: canonical.id },
    entityType: "client",
    title: canonical.name,
    subtitle: aliases.length > 0 ? `Includes ${aliases.map((alias) => alias.name).join(", ")}` : null,
    primaryState: canonical.archivalState === "GELADEIRA" ? "Archived relationship" : `${canonical.status} relationship`,
    tone: canonical.archivalState === "GELADEIRA" ? "neutral" : canonical.status === "active" ? "live" : "neutral",
    fullPageHref: entityFullPageHref({ type: "client", id: canonical.id }),
    integrityIssues,
    inactive: canonical.archivalState === "GELADEIRA" || canonical.status === "inactive",
    relationshipStatus: canonical.status,
    aliases,
    activeProjectCount: activeProjects.length,
    activeProjects: activeProjects.slice(0, 6),
    openWork: videoRows.map((video) => ({
      id: video.id,
      title: video.title ?? `Video ${video.date}`,
      status: video.status,
    })),
    nextAction: canonical.nextAction
      ? { label: canonical.nextAction, dueDate: canonical.nextActionDate }
      : null,
    lastRelationshipEvent: lastRelationshipEvent?.createdAt
      ? {
          type: lastRelationshipEvent.type,
          description: lastRelationshipEvent.description,
          occurredAt: lastRelationshipEvent.createdAt.toISOString(),
        }
      : null,
    receivedByCurrency: revenueRows.map((row) => ({
      currency: row.currency,
      amount: Number(row.amount ?? 0),
    })),
  };
  return { status: "ready", inspection };
}

async function projectInspection(ref: InspectableEntity): Promise<EntityInspectionResult> {
  const db = await getAuthenticatedDb();
  const [projectsOverview, integrity, execution] = await Promise.all([
    getProjectsOverview(),
    getRelationshipIntegrity(),
    getExecutionSnapshot(),
  ]);
  const project = projectsOverview.find((row) => row.id === ref.id) ?? null;
  if (!project) return { status: "not_found", ref, message: `Project #${ref.id} was not found.` };
  const client = await resolveClientIdentity(project.clientId);
  if (!client.identity) {
    return { status: "unavailable", ref, message: client.issue ?? "Project Client relationship is unavailable." };
  }

  const [deliverables, blockersForProject, recorded] = await Promise.all([
    db.select({ id: videoLogs.id, title: videoLogs.title, date: videoLogs.date, status: videoLogs.status })
      .from(videoLogs)
      .where(and(eq(videoLogs.projectId, project.id), isNull(videoLogs.cancelledAt), ne(videoLogs.status, "DONE")))
      .orderBy(desc(videoLogs.isPriority), asc(videoLogs.queuePosition), desc(videoLogs.updatedAt))
      .limit(8),
    db.select({ category: blockers.category })
      .from(blockers)
      .innerJoin(videoLogs, eq(blockers.videoId, videoLogs.id))
      .where(and(eq(videoLogs.projectId, project.id), isNull(blockers.resolvedAt)))
      .orderBy(asc(blockers.startedAt))
      .limit(1),
    db.select({
      seconds: sql<number>`coalesce(sum(${workSessions.endedAt} - ${workSessions.startedAt}), 0)`,
    })
      .from(workSessions)
      .innerJoin(videoLogs, eq(workSessions.videoId, videoLogs.id))
      .where(and(eq(videoLogs.projectId, project.id), sql`${workSessions.endedAt} is not null`)),
  ]);
  const progress = getProjectProgress(project);
  const integrityIssues = [
    ...(client.issue ? [client.issue] : []),
    ...issuesFor(integrity, {
      clients: [project.clientId, client.identity.id],
      projects: [project.id],
      videos: deliverables.map((video) => video.id),
    }),
  ];
  const recommended = execution.recommendation?.project?.id === project.id
    ? { id: execution.recommendation.videoId, title: execution.recommendation.title }
    : null;
  const inspection: ProjectInspection = {
    kind: "project",
    ref,
    entityType: "project",
    title: project.name,
    subtitle: client.identity.name,
    primaryState: `${project.status} · ${progress}% complete`,
    tone: project.openBlockerCount > 0 ? "attention" : project.status === "delivered" ? "complete" : "neutral",
    fullPageHref: entityFullPageHref(ref),
    integrityIssues,
    inactive: project.status === "archived" || client.archivalState === "GELADEIRA",
    client: client.identity,
    status: project.status,
    deadline: project.deadline,
    progress: { done: project.doneVideos, total: project.totalVideos, percent: progress },
    activeDeliverables: deliverables.map((video) => ({
      id: video.id,
      title: video.title ?? `Video ${video.date}`,
      status: video.status,
    })),
    nextMilestone: getProjectNextAction(project),
    blocker: blockersForProject[0]?.category ?? null,
    recordedSeconds: Number(recorded[0]?.seconds ?? 0),
    recommendedVideo: recommended,
  };
  return { status: "ready", inspection };
}

async function videoInspection(ref: InspectableEntity): Promise<EntityInspectionResult> {
  const db = await getAuthenticatedDb();
  const video = (
    await db.select({
      id: videoLogs.id,
      title: videoLogs.title,
      date: videoLogs.date,
      status: videoLogs.status,
      videoKind: videoLogs.videoKind,
      contentType: videoLogs.contentType,
      clientId: videoLogs.clientId,
      projectId: videoLogs.projectId,
      projectName: projects.name,
      projectStatus: projects.status,
      projectClientId: projects.clientId,
      queuePosition: videoLogs.queuePosition,
      notes: videoLogs.notes,
      reviewUrl: videoLogs.reviewUrl,
      deliveryUrl: videoLogs.deliveryUrl,
      publishedUrl: videoLogs.publishedUrl,
      cancelledAt: videoLogs.cancelledAt,
    })
      .from(videoLogs)
      .leftJoin(projects, eq(videoLogs.projectId, projects.id))
      .where(eq(videoLogs.id, ref.id))
      .limit(1)
  )[0] ?? null;
  if (!video) return { status: "not_found", ref, message: `Video #${ref.id} was not found.` };

  const operationalClientId = video.clientId ?? video.projectClientId ?? null;
  const [client, recordedSeconds, blockerRows, commitmentRows, execution, integrity] = await Promise.all([
    operationalClientId === null
      ? Promise.resolve({ identity: null, archivalState: null, issue: null })
      : resolveClientIdentity(operationalClientId),
    videoClosedSeconds(video.id),
    db.select({ category: blockers.category })
      .from(blockers)
      .where(and(eq(blockers.videoId, video.id), isNull(blockers.resolvedAt)))
      .orderBy(asc(blockers.startedAt))
      .limit(1),
    db.select({ dueAt: commitments.dueAt })
      .from(commitments)
      .where(and(eq(commitments.videoId, video.id), eq(commitments.status, "OPEN")))
      .orderBy(asc(commitments.dueAt))
      .limit(1),
    getExecutionSnapshot(),
    getRelationshipIntegrity(),
  ]);
  const current = execution.current;
  const isCurrent = current?.video.id === video.id;
  const isRecommended = execution.recommendation?.videoId === video.id;
  let action: InspectionAction;
  if (video.cancelledAt || video.status === "DONE") {
    action = { kind: "NONE", label: null };
  } else if (isCurrent) {
    action = { kind: "END_SESSION", videoId: video.id, label: "End Session" };
  } else if (current) {
    action = {
      kind: "BLOCKED",
      label: "Another session is active",
      reason: `${current.video.title} is the current execution. End it before starting another Video.`,
    };
  } else {
    action = {
      kind: "START_WORK",
      videoId: video.id,
      label: recordedSeconds > 0 ? "Resume Work" : "Start Work",
    };
  }
  const integrityIssues = [
    ...(client.issue ? [client.issue] : []),
    ...(video.projectId !== null && video.projectName === null ? ["Assigned Project is missing."] : []),
    ...(video.clientId !== null && video.projectClientId !== null && video.clientId !== video.projectClientId
      ? ["Video Client does not match Project Client."]
      : []),
    ...issuesFor(integrity, {
      clients: operationalClientId === null ? [] : [operationalClientId, canonicalClientId(operationalClientId)],
      projects: video.projectId === null ? [] : [video.projectId],
      videos: [video.id],
    }),
  ];
  const links = [
    video.reviewUrl ? { label: "Review", href: video.reviewUrl } : null,
    video.deliveryUrl ? { label: "Delivery", href: video.deliveryUrl } : null,
    video.publishedUrl ? { label: "Published", href: video.publishedUrl } : null,
  ].filter((link): link is { label: string; href: string } => link !== null);
  const inspection: VideoInspection = {
    kind: "video",
    ref,
    entityType: "video",
    title: video.title ?? `Video ${video.date}`,
    subtitle: [client.identity?.name, video.projectName].filter(Boolean).join(" · ") || null,
    primaryState: video.cancelledAt ? "Cancelled" : video.status,
    tone: isCurrent ? "live" : video.status === "CHANGES_REQUESTED" || blockerRows.length > 0 ? "attention" : video.status === "DONE" ? "complete" : "neutral",
    fullPageHref: entityFullPageHref(ref),
    integrityIssues,
    inactive: Boolean(video.cancelledAt) || client.archivalState === "GELADEIRA",
    client: client.identity,
    project: video.projectId === null || video.projectName === null
      ? null
      : { id: video.projectId, name: video.projectName, status: video.projectStatus ?? "unknown" },
    status: video.status,
    contentType: video.contentType,
    videoKind: video.videoKind,
    deadline: commitmentRows[0]?.dueAt?.toISOString() ?? null,
    blocker: blockerRows[0]?.category ?? null,
    queuePosition: video.queuePosition,
    recordedSeconds,
    currentSession: isCurrent && current
      ? { id: current.sessionId, startedAt: current.startedAt, elapsedSeconds: current.elapsedSeconds }
      : null,
    nextAction: getVideoNextAction(video.status),
    recommendationRelationship: isCurrent ? "CURRENT" : isRecommended ? "RECOMMENDED" : "OTHER",
    notes: video.notes,
    links,
    action,
  };
  return { status: "ready", inspection };
}

async function sessionInspection(ref: InspectableEntity): Promise<EntityInspectionResult> {
  const db = await getAuthenticatedDb();
  const session = (
    await db.select({
      id: workSessions.id,
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
      activityType: workSessions.activityType,
      source: workSessions.source,
      note: workSessions.note,
      videoId: videoLogs.id,
      videoTitle: videoLogs.title,
      videoDate: videoLogs.date,
      videoStatus: videoLogs.status,
      videoClientId: videoLogs.clientId,
      videoProjectId: videoLogs.projectId,
      projectId: projects.id,
      projectName: projects.name,
      projectClientId: projects.clientId,
      sensorDeviceName: sensorDevices.name,
    })
      .from(workSessions)
      .innerJoin(videoLogs, eq(workSessions.videoId, videoLogs.id))
      .leftJoin(projects, eq(videoLogs.projectId, projects.id))
      .leftJoin(sensorDevices, eq(workSessions.sensorDeviceId, sensorDevices.id))
      .where(eq(workSessions.id, ref.id))
      .limit(1)
  )[0] ?? null;
  if (!session) return { status: "not_found", ref, message: `Work Session #${ref.id} was not found.` };

  const operationalClientId = session.videoClientId ?? session.projectClientId ?? null;
  const [client, integrity] = await Promise.all([
    operationalClientId === null
      ? Promise.resolve({ identity: null, archivalState: null, issue: null })
      : resolveClientIdentity(operationalClientId),
    getRelationshipIntegrity(),
  ]);
  const endedAt = session.endedAt?.toISOString() ?? null;
  const durationSeconds = Math.max(
    0,
    Math.floor(((session.endedAt?.getTime() ?? Date.now()) - session.startedAt.getTime()) / 1_000),
  );
  const integrityIssues = [
    ...(client.issue ? [client.issue] : []),
    ...(session.videoProjectId !== null && session.projectId === null ? ["Session Video references a missing Project."] : []),
    ...(session.videoClientId !== null && session.projectClientId !== null && session.videoClientId !== session.projectClientId
      ? ["Session Video and Project reference different Clients."]
      : []),
    ...issuesFor(integrity, {
      clients: operationalClientId === null ? [] : [operationalClientId, canonicalClientId(operationalClientId)],
      projects: session.projectId === null ? [] : [session.projectId],
      videos: [session.videoId],
    }),
  ];
  const inspection: SessionInspection = {
    kind: "session",
    ref,
    entityType: "session",
    title: `Session #${session.id}`,
    subtitle: session.videoTitle ?? `Video ${session.videoDate}`,
    primaryState: session.endedAt ? "Closed" : "Running",
    tone: session.endedAt ? "neutral" : "live",
    fullPageHref: entityFullPageHref(ref),
    integrityIssues,
    inactive: false,
    startedAt: session.startedAt.toISOString(),
    endedAt,
    durationSeconds,
    status: session.endedAt ? "CLOSED" : "OPEN",
    activityType: session.activityType,
    source: session.source,
    note: session.note,
    video: {
      id: session.videoId,
      title: session.videoTitle ?? `Video ${session.videoDate}`,
      status: session.videoStatus,
    },
    project: session.projectId === null || session.projectName === null
      ? null
      : { id: session.projectId, name: session.projectName },
    client: client.identity,
    sensorEvidence: session.sensorDeviceName ? { deviceName: session.sensorDeviceName } : null,
    action: session.endedAt
      ? { kind: "NONE", label: null }
      : { kind: "END_SESSION", videoId: session.videoId, label: "End Session" },
  };
  return { status: "ready", inspection };
}

export async function getEntityInspection(ref: InspectableEntity): Promise<EntityInspectionResult> {
  if (!isInspectableEntity(ref)) return { status: "invalid", message: "Invalid entity reference." };
  if (ref.type === "client") return clientInspection(ref);
  if (ref.type === "project") return projectInspection(ref);
  if (ref.type === "video") return videoInspection(ref);
  return sessionInspection(ref);
}
