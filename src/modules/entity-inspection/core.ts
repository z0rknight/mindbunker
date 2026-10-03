import type { InspectableEntity, InspectableEntityType } from "@/lib/entity-navigation";
import type { ClientWorkMode } from "@/lib/client-identity";

export type InspectionTone = "neutral" | "live" | "attention" | "complete";

export type InspectionClientIdentity = {
  id: number;
  name: string;
  operationalId: number;
  operationalName: string;
  workMode: ClientWorkMode;
  aliasContext: string | null;
};

export type InspectionAction =
  | { kind: "START_WORK"; videoId: number; label: "Start Work" | "Resume Work" }
  | { kind: "END_SESSION"; videoId: number; label: "End Session" }
  | { kind: "BLOCKED"; label: string; reason: string }
  | { kind: "NONE"; label: null };

type InspectionBase = {
  ref: InspectableEntity;
  entityType: InspectableEntityType;
  title: string;
  subtitle: string | null;
  primaryState: string;
  tone: InspectionTone;
  fullPageHref: string;
  integrityIssues: string[];
  inactive: boolean;
};

export type ClientInspection = InspectionBase & {
  kind: "client";
  relationshipStatus: string;
  aliases: Array<{ id: number; name: string; workMode: ClientWorkMode }>;
  activeProjectCount: number;
  activeProjects: Array<{ id: number; name: string; status: string }>;
  openWork: Array<{ id: number; title: string; status: string }>;
  nextAction: { label: string; dueDate: string | null } | null;
  lastRelationshipEvent: { type: string; description: string; occurredAt: string } | null;
  receivedByCurrency: Array<{ currency: string; amount: number }>;
};

export type ProjectInspection = InspectionBase & {
  kind: "project";
  client: InspectionClientIdentity;
  status: string;
  condition: "BLOCKED" | "WAITING" | "CLEAR" | "CLOSED";
  workClass: "CLIENT" | "INTERNAL";
  deadline: string | null;
  progress: { done: number; total: number; percent: number };
  explicitBatchCount: number;
  activeDeliverables: Array<{ id: number; title: string; status: string }>;
  nextMilestone: string | null;
  blocker: string | null;
  recordedSeconds: number;
  recommendedVideo: { id: number; title: string } | null;
};

export type VideoInspection = InspectionBase & {
  kind: "video";
  client: InspectionClientIdentity | null;
  project: { id: number; name: string; status: string } | null;
  status: string;
  contentType: string | null;
  videoKind: string;
  deadline: string | null;
  blocker: string | null;
  queuePosition: number | null;
  recordedSeconds: number;
  currentSession: { id: number; startedAt: string; elapsedSeconds: number } | null;
  nextAction: string;
  recommendationRelationship: "CURRENT" | "RECOMMENDED" | "OTHER";
  notes: string | null;
  links: Array<{ label: string; href: string }>;
  action: InspectionAction;
};

export type SessionInspection = InspectionBase & {
  kind: "session";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  status: "OPEN" | "CLOSED";
  activityType: string;
  source: string;
  note: string | null;
  video: { id: number; title: string; status: string };
  project: { id: number; name: string } | null;
  client: InspectionClientIdentity | null;
  sensorEvidence: { deviceName: string } | null;
  action: InspectionAction;
};

export type EntityInspection =
  | ClientInspection
  | ProjectInspection
  | VideoInspection
  | SessionInspection;

export type EntityInspectionResult =
  | { status: "ready"; inspection: EntityInspection }
  | { status: "not_found"; ref: InspectableEntity; message: string }
  | { status: "invalid"; message: string }
  | { status: "unavailable"; ref: InspectableEntity; message: string };

export function inspectionLabel(type: InspectableEntityType): string {
  if (type === "client") return "Client";
  if (type === "project") return "Project";
  if (type === "video") return "Video / Deliverable";
  return "Work Session";
}
