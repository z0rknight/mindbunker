import {
  canonicalClientId,
  isInternalClientName,
  isOperationalAliasClientId,
} from "../../lib/client-identity.ts";

// Same explicit provenance marker owned by modules/projects/core.ts. Kept as
// a local literal in this pure Node-testable module so the integrity scanner
// does not import the broader Projects module graph.
const SYNTHETIC_OPERATIONAL_CLIENT_SOURCE = "RELEASE_TEST";

export type RelationshipIntegritySeverity = "ERROR" | "WARNING";

export type RelationshipIntegrityIssue = {
  code:
    | "ALIAS_CANONICAL_MISSING"
    | "DUPLICATE_CLIENT_EMAIL"
    | "DUPLICATE_CLIENT_NAME"
    | "PROJECT_CLIENT_MISSING"
    | "ARCHIVED_CLIENT_ACTIVE_PROJECT"
    | "VIDEO_CLIENT_MISSING"
    | "VIDEO_PROJECT_MISSING"
    | "VIDEO_PROJECT_CLIENT_MISMATCH"
    | "CONTRACT_CLIENT_MISSING"
    | "ARCHIVED_CLIENT_ACTIVE_CONTRACT"
    | "PAYMENT_REQUEST_CLIENT_MISSING"
    | "ARCHIVED_CLIENT_OPEN_PAYMENT_REQUEST"
    | "TRANSACTION_CLIENT_MISSING";
  severity: RelationshipIntegritySeverity;
  entityType: "client" | "project" | "video" | "contract" | "payment_request" | "transaction";
  entityId: number;
  message: string;
};

export type RelationshipIntegrityInput = {
  clients: Array<{
    id: number;
    name: string;
    email: string | null;
    archivalState: "ACTIVE_SURFACE" | "GELADEIRA";
    source: string | null;
  }>;
  projects: Array<{ id: number; clientId: number; name: string; status: string }>;
  videos: Array<{
    id: number;
    clientId: number | null;
    projectId: number | null;
    title: string | null;
    status: string;
    videoKind: string;
    cancelledAt: Date | null;
  }>;
  contracts: Array<{ id: number; clientId: number; status: string }>;
  paymentRequests: Array<{ id: number; clientId: number; status: string }>;
  transactions: Array<{ id: number; clientId: number | null; type: string; category: string }>;
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

function duplicateGroups<T>(rows: readonly T[], key: (row: T) => string | null): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

/**
 * Pure relationship-integrity projection. It never repairs or mutates data:
 * an inconsistency becomes operator-visible evidence instead of a silent
 * omission from one UI. Database FKs remain the storage guard; this layer
 * catches semantic drift that valid FKs alone cannot express.
 */
export function scanRelationshipIntegrity(
  input: RelationshipIntegrityInput,
): RelationshipIntegrityIssue[] {
  const issues: RelationshipIntegrityIssue[] = [];
  const operationalClients = input.clients.filter(
    (client) =>
      client.source !== SYNTHETIC_OPERATIONAL_CLIENT_SOURCE &&
      !isInternalClientName(client.name),
  );
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const projectById = new Map(input.projects.map((project) => [project.id, project]));

  for (const client of operationalClients) {
    if (!isOperationalAliasClientId(client.id)) continue;
    const canonicalId = canonicalClientId(client.id);
    if (!clientById.has(canonicalId)) {
      issues.push({
        code: "ALIAS_CANONICAL_MISSING",
        severity: "ERROR",
        entityType: "client",
        entityId: client.id,
        message: `${client.name} points to missing canonical client #${canonicalId}.`,
      });
    }
  }

  for (const group of duplicateGroups(operationalClients, (client) =>
    client.email ? normalized(client.email) : null,
  )) {
    const ids = group.map((client) => `#${client.id}`).join(", ");
    issues.push({
      code: "DUPLICATE_CLIENT_EMAIL",
      severity: "WARNING",
      entityType: "client",
      entityId: group[0].id,
      message: `Clients ${ids} share the same normalized email.`,
    });
  }

  for (const group of duplicateGroups(
    operationalClients.filter((client) => !isOperationalAliasClientId(client.id)),
    (client) => normalized(client.name),
  )) {
    const ids = group.map((client) => `#${client.id}`).join(", ");
    issues.push({
      code: "DUPLICATE_CLIENT_NAME",
      severity: "WARNING",
      entityType: "client",
      entityId: group[0].id,
      message: `Canonical clients ${ids} share the same normalized name.`,
    });
  }

  for (const project of input.projects) {
    const client = clientById.get(project.clientId);
    if (!client) {
      issues.push({
        code: "PROJECT_CLIENT_MISSING",
        severity: "ERROR",
        entityType: "project",
        entityId: project.id,
        message: `${project.name} references missing client #${project.clientId}.`,
      });
    } else if (
      client.archivalState === "GELADEIRA" &&
      ["planned", "active", "review"].includes(project.status)
    ) {
      issues.push({
        code: "ARCHIVED_CLIENT_ACTIVE_PROJECT",
        severity: "WARNING",
        entityType: "project",
        entityId: project.id,
        message: `${project.name} is ${project.status} under archived client ${client.name}.`,
      });
    }
  }

  for (const video of input.videos) {
    const activeClientWork =
      video.videoKind === "CLIENT_WORK" && video.cancelledAt === null && video.status !== "DONE";
    if (activeClientWork && video.clientId === null) {
      issues.push({
        code: "VIDEO_CLIENT_MISSING",
        severity: "WARNING",
        entityType: "video",
        entityId: video.id,
        message: `${video.title ?? `Video #${video.id}`} is active client work without a client.`,
      });
    }
    if (video.projectId === null) continue;
    const project = projectById.get(video.projectId);
    if (!project) {
      issues.push({
        code: "VIDEO_PROJECT_MISSING",
        severity: "ERROR",
        entityType: "video",
        entityId: video.id,
        message: `${video.title ?? `Video #${video.id}`} references missing project #${video.projectId}.`,
      });
      continue;
    }
    if (video.clientId !== null && video.clientId !== project.clientId) {
      issues.push({
        code: "VIDEO_PROJECT_CLIENT_MISMATCH",
        severity: "ERROR",
        entityType: "video",
        entityId: video.id,
        message: `${video.title ?? `Video #${video.id}`} and its project reference different clients.`,
      });
    }
  }

  for (const contract of input.contracts) {
    const client = clientById.get(contract.clientId);
    if (!client) {
      issues.push({
        code: "CONTRACT_CLIENT_MISSING",
        severity: "ERROR",
        entityType: "contract",
        entityId: contract.id,
        message: `Contract #${contract.id} references missing client #${contract.clientId}.`,
      });
    } else if (client.archivalState === "GELADEIRA" && contract.status === "ACTIVE") {
      issues.push({
        code: "ARCHIVED_CLIENT_ACTIVE_CONTRACT",
        severity: "WARNING",
        entityType: "contract",
        entityId: contract.id,
        message: `Active contract #${contract.id} belongs to archived client ${client.name}.`,
      });
    }
  }

  for (const request of input.paymentRequests) {
    const client = clientById.get(request.clientId);
    if (!client) {
      issues.push({
        code: "PAYMENT_REQUEST_CLIENT_MISSING",
        severity: "ERROR",
        entityType: "payment_request",
        entityId: request.id,
        message: `Payment request #${request.id} references missing client #${request.clientId}.`,
      });
    } else if (client.archivalState === "GELADEIRA" && request.status === "OPEN") {
      issues.push({
        code: "ARCHIVED_CLIENT_OPEN_PAYMENT_REQUEST",
        severity: "WARNING",
        entityType: "payment_request",
        entityId: request.id,
        message: `Open payment request #${request.id} belongs to archived client ${client.name}.`,
      });
    }
  }

  for (const transaction of input.transactions) {
    if (transaction.clientId !== null && !clientById.has(transaction.clientId)) {
      issues.push({
        code: "TRANSACTION_CLIENT_MISSING",
        severity: "ERROR",
        entityType: "transaction",
        entityId: transaction.id,
        message: `Transaction #${transaction.id} references missing client #${transaction.clientId}.`,
      });
    }
  }

  return issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "ERROR" ? -1 : 1;
    return a.code.localeCompare(b.code) || a.entityId - b.entityId;
  });
}
