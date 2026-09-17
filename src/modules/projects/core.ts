import {
  PROJECT_GROUPS,
  PROJECT_STATUSES,
  PROJECT_STATUS_GROUPS,
  type ProjectGroup,
  type ProjectStatus,
} from "./config.ts";
import { validateCoverUrl } from "../productivity/core.ts";

export type ProjectOverviewItem = {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  notes: string | null;
  updatedAt: Date | null;
  totalVideos: number;
  doneVideos: number;
  inFlightVideos: number;
  plannedVideos: number;
  // Sprint 3 P1 (Project + Video visual covers).
  coverUrl: string | null;
  clientDefaultCoverUrl: string | null;
  clientAvatarUrl: string | null;
  // MICRO PATCH §2 (Last Active): ISO instant of the most recent closed,
  // attributed Work Session for this project, unbounded lookback. null
  // when the project has never had one -- never fabricated as "now".
  lastActiveAt: string | null;
  // Tuesday Patch Priority 2: count of open blockers on this project's
  // videos -- a real, derived project-level exception (not a new
  // project-level primitive; blockers stay video-scoped, this just rolls
  // them up for display).
  openBlockerCount: number;
};

export type ProjectOverviewGroups = Record<
  ProjectGroup,
  ProjectOverviewItem[]
>;

export type ProjectInput = {
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  notes: string | null;
  coverUrl: string | null;
};

type ProjectInputResult =
  | { success: true; data: ProjectInput }
  | { success: false; error: string };

export function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    PROJECT_STATUSES.includes(value as ProjectStatus)
  );
}

export function getProjectGroup(status: ProjectStatus): ProjectGroup {
  return PROJECT_STATUS_GROUPS[status];
}

// Sep 17 Morning Production QA Patch: reproduced directly from the
// operator's real "September Content Waterfall" project -- 6/6 videos
// already done, yet the project still read "3D OVERDUE" because
// project.status (a separate, operator-set lifecycle field -- see the
// "video completion != project completion" note on getProjectNextAction
// below) had not yet been manually moved past "active". That is a real
// admin lag, not an open obligation: there is nothing left to be late on
// once every real deliverable is already produced. isProjectOverdue now
// also asks "is there still a deliverable that isn't done" -- a project
// with zero videos ever registered stays overdue on a passed deadline
// (nothing was ever produced, which IS a real miss), and a project with
// any still-incomplete video stays overdue exactly as before. This does
// NOT touch project.status or auto-transition it -- "Move to review"
// (getProjectNextAction) is still the only place that copy is decided.
export function isProjectOverdue(
  project: Pick<ProjectOverviewItem, "deadline" | "status" | "totalVideos" | "doneVideos">,
  today: string,
) {
  if (!Boolean(project.deadline && project.deadline < today)) return false;
  if (getProjectGroup(project.status) === "completed") return false;
  if (project.totalVideos > 0 && project.doneVideos >= project.totalVideos) return false;
  return true;
}

export function getProjectProgress(project: Pick<
  ProjectOverviewItem,
  "totalVideos" | "doneVideos"
>) {
  if (project.totalVideos === 0) return 0;
  return Math.round((project.doneVideos / project.totalVideos) * 100);
}

// ─── Tuesday Patch Priority 2 (Projects structural redesign) ───────────────
//
// Critical semantic rule from the brief: video completion != project
// completion. "2/2 done" cannot be the only signal, or the UI implies a
// conclusion the domain doesn't support. project.status already IS the
// real "project stage" concept (planned/active/review/delivered/archived,
// see config.ts's PROJECT_STATUS_LABELS) -- no new field needed there.
// "Next" below is the one genuinely new piece, and it is derived only
// from data that already exists (video counts + status), never invented:
// a project with videos left to shoot says so; a project whose videos are
// ALL done but still "active" (exactly the "why is 2/2 still Active"
// inconsistency the brief calls out) says "Move to review" -- which
// answers the operator's own question instead of hiding it.
export function getProjectNextAction(
  project: Pick<ProjectOverviewItem, "status" | "totalVideos" | "doneVideos" | "inFlightVideos" | "plannedVideos">,
): string | null {
  if (project.status === "delivered" || project.status === "archived") return null;
  if (project.totalVideos === 0) return "Plan the first video";
  if (project.plannedVideos > 0) {
    return `Produce ${project.plannedVideos} planned video${project.plannedVideos === 1 ? "" : "s"}`;
  }
  if (project.inFlightVideos > 0) {
    return `Finish ${project.inFlightVideos} video${project.inFlightVideos === 1 ? "" : "s"} in flight`;
  }
  if (project.doneVideos === project.totalVideos && project.status === "active") {
    return "Move to review";
  }
  if (project.status === "review") return "Client review";
  return null;
}

export type ProjectExceptionKind = "OVERDUE" | "BLOCKED" | "PLANNED";

// The badge vocabulary the brief asks for is deliberately small: normal
// active/in-review state gets no badge at all (you're already inside
// "active projects" -- repeating that is exactly the redundant ACTIVE
// badge the brief rejected). Only genuine exceptions and the PLANNED
// lifecycle state get one, and only one -- overdue outranks blocked.
export function getProjectException(
  project: Pick<ProjectOverviewItem, "status" | "deadline" | "openBlockerCount" | "totalVideos" | "doneVideos">,
  today: string,
): ProjectExceptionKind | null {
  if (isProjectOverdue(project, today)) return "OVERDUE";
  if (project.openBlockerCount > 0) return "BLOCKED";
  if (project.status === "planned") return "PLANNED";
  return null;
}

export type ClientProjectGroup = {
  clientId: number;
  clientName: string;
  clientDefaultCoverUrl: string | null;
  clientAvatarUrl: string | null;
  hasException: boolean;
  projects: ProjectOverviewItem[];
};

const EXCEPTION_RANK: Record<ProjectExceptionKind | "NONE", number> = {
  OVERDUE: 0,
  BLOCKED: 1,
  PLANNED: 2,
  NONE: 3,
};

export type ProjectSortMode = "attention" | "recent";

// Groups an already-filtered project list by client, sorts projects
// within each client group, and sorts the client groups themselves --
// groups containing a real exception come first (matching the brief's
// own worked example: Dave, who has an overdue project, listed before
// Taryn, who doesn't). This is the ONE place either sort happens; the
// page component must not re-derive it.
export function groupProjectsByClient(
  projectList: readonly ProjectOverviewItem[],
  today: string,
  sortMode: ProjectSortMode = "attention",
): ClientProjectGroup[] {
  const byClient = new Map<number, ClientProjectGroup>();
  for (const project of projectList) {
    const existing = byClient.get(project.clientId);
    if (existing) {
      existing.projects.push(project);
    } else {
      byClient.set(project.clientId, {
        clientId: project.clientId,
        clientName: project.clientName,
        clientDefaultCoverUrl: project.clientDefaultCoverUrl,
        clientAvatarUrl: project.clientAvatarUrl,
        hasException: false,
        projects: [project],
      });
    }
  }

  const groups = [...byClient.values()];
  for (const group of groups) {
    group.projects.sort((a, b) => {
      if (sortMode === "attention") {
        const rankA = EXCEPTION_RANK[getProjectException(a, today) ?? "NONE"];
        const rankB = EXCEPTION_RANK[getProjectException(b, today) ?? "NONE"];
        if (rankA !== rankB) return rankA - rankB;
      }
      const updatedOrder = (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      return updatedOrder || b.id - a.id;
    });
    group.hasException = group.projects.some((project) => getProjectException(project, today) !== null);
  }

  groups.sort((a, b) => {
    if (a.hasException !== b.hasException) return a.hasException ? -1 : 1;
    return a.clientName.localeCompare(b.clientName);
  });

  return groups;
}

export function filterProjectsBySearch(
  projectList: readonly ProjectOverviewItem[],
  query: string,
): ProjectOverviewItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...projectList];
  return projectList.filter(
    (project) =>
      project.name.toLowerCase().includes(needle) ||
      project.clientName.toLowerCase().includes(needle),
  );
}

function compareNullableDates(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export function groupProjectsForOverview(
  projects: ProjectOverviewItem[],
): ProjectOverviewGroups {
  const groups: ProjectOverviewGroups = {
    active: [],
    planned: [],
    completed: [],
  };

  for (const project of projects) {
    groups[getProjectGroup(project.status)].push(project);
  }

  for (const group of PROJECT_GROUPS) {
    groups[group].sort((a, b) => {
      if (group === "active" && a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      const deadlineOrder = compareNullableDates(a.deadline, b.deadline);
      if (deadlineOrder !== 0) return deadlineOrder;
      const updatedOrder =
        (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      return updatedOrder || b.id - a.id;
    });
  }

  return groups;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateProjectInput(values: {
  name: unknown;
  status: unknown;
  deadline?: unknown;
  notes?: unknown;
  coverUrl?: unknown;
}): ProjectInputResult {
  const name = cleanOptionalText(values.name, 160);
  if (!name) {
    return { success: false, error: "Project name is required." };
  }
  if (!isProjectStatus(values.status)) {
    return { success: false, error: "Choose a valid project status." };
  }

  const deadline = cleanOptionalText(values.deadline, 10);
  if (deadline && !isDateKey(deadline)) {
    return { success: false, error: "Choose a valid project deadline." };
  }

  // Sprint 3 P1: same HTTPS-only validator videoLogs.coverUrl already
  // uses (modules/productivity/core.ts) -- one cover-URL safety rule,
  // not two.
  const coverUrl = validateCoverUrl(values.coverUrl);
  if (!coverUrl.success) {
    return { success: false, error: coverUrl.error };
  }

  return {
    success: true,
    data: {
      name,
      status: values.status,
      deadline,
      notes: cleanOptionalText(values.notes, 5_000),
      coverUrl: coverUrl.value,
    },
  };
}

// Brief C ("Final Local Ingest / Live Readiness") §9: deterministic Project
// workspace video ordering. Real bulk-generated names ("Bonnie Content
// Waterfall_1" ... "_9") must not lexically sort as 1, 10 (n/a here but
// still), 2, 3... i.e. "_2" must sort before "_10" whenever both exist.
// This is a pure string comparator (numeric-aware "natural sort"), applied
// after the batch-label/date grouping described in §9 -- see
// sortProjectWorkspaceVideos below for how the three keys combine.
export function naturalCompare(a: string, b: string): number {
  const chunk = /(\d+|\D+)/g;
  const aParts = a.match(chunk) ?? [a];
  const bParts = b.match(chunk) ?? [b];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";
    const aNum = /^\d+$/.test(aPart) ? Number(aPart) : null;
    const bNum = /^\d+$/.test(bPart) ? Number(bPart) : null;
    if (aNum !== null && bNum !== null) {
      if (aNum !== bNum) return aNum - bNum;
      continue;
    }
    const cmp = aPart.localeCompare(bPart);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export type ProjectWorkspaceVideoOrderInput = {
  id: number;
  title: string | null;
  date: string;
  batchLabel: string | null;
};

// Preferred order per §9: batch label (grouping batches together, videos
// with no batch label first), then historical date, then natural
// numeric-aware name ordering. Falls back to id for total determinism when
// every other key ties (never leaves ordering to insertion/query-plan
// accident).
export function sortProjectWorkspaceVideos<
  T extends ProjectWorkspaceVideoOrderInput,
>(videos: readonly T[]): T[] {
  return [...videos].sort((a, b) => {
    const batchA = a.batchLabel ?? "";
    const batchB = b.batchLabel ?? "";
    if (batchA !== batchB) return batchA.localeCompare(batchB);
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const titleA = a.title ?? "";
    const titleB = b.title ?? "";
    const titleCmp = naturalCompare(titleA, titleB);
    if (titleCmp !== 0) return titleCmp;
    return a.id - b.id;
  });
}


// ─── NIGHT SHIFT REALITY PATCH §7 ──────────────────────────────────────────
// "Current WIP / review link" -- derived, never a new dedicated field. The
// project workspace already fetches every video's reviewUrl/deliveryUrl/
// publishedUrl (see getProjectWorkspace); this is pure derivation logic
// over that existing data, with no new query and no schema change.

export type CurrentWorkVideoCandidate = {
  id: number;
  status: string;
  reviewUrl: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

const ACTIVE_WORK_STATUSES = new Set(["IN_PROGRESS", "CHANGES_REQUESTED"]);

function byRecency<T extends { updatedAt: Date | null; createdAt: Date | null }>(
  a: T,
  b: T,
): number {
  const aTime = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
  const bTime = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
  return bTime - aTime;
}

// Preference order per §7: (A) the most recently updated video the operator
// is actively working on right now (IN_PROGRESS / CHANGES_REQUESTED) --
// READY_FOR_REVIEW is deliberately excluded from this tier, since that's
// work waiting on the client, not work in progress. Falls back to (B) the
// most recently updated video that has a reviewUrl at all, so a project
// sitting entirely in review still surfaces something. Returns null rather
// than fabricating a "current work" video for a project with nothing
// in-flight and nothing reviewable (e.g. all DONE, all PLANNED, or empty).
export function resolveCurrentWorkVideo<T extends CurrentWorkVideoCandidate>(
  videos: readonly T[],
): T | null {
  const inFlight = videos
    .filter((video) => ACTIVE_WORK_STATUSES.has(video.status))
    .toSorted(byRecency);
  if (inFlight[0]) return inFlight[0];

  const reviewable = videos
    .filter((video) => video.reviewUrl !== null)
    .toSorted(byRecency);
  return reviewable[0] ?? null;
}
