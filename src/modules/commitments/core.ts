// September Local Feature Harvest -- Cluster A (Commitments / shared
// "promise tracking" primitive). Pure logic only: no DB access here, same
// separation as work-sessions/core.ts. See src/db/schema.ts `commitments`
// for the storage shape and why ownerType/ownerId is a deliberate
// polymorphic (non-FK) reference.

export const COMMITMENT_OWNER_TYPES = ["CLIENT", "PROJECT", "VIDEO"] as const;
export type CommitmentOwnerType = (typeof COMMITMENT_OWNER_TYPES)[number];

export const COMMITMENT_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export const COMMITMENT_OWNER_LABELS: Record<CommitmentOwnerType, string> = {
  CLIENT: "Client",
  PROJECT: "Project",
  VIDEO: "Video",
};

export function isCommitmentOwnerType(
  value: unknown,
): value is CommitmentOwnerType {
  return (
    typeof value === "string" &&
    (COMMITMENT_OWNER_TYPES as readonly string[]).includes(value)
  );
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export type CommitmentRow = {
  id: number;
  ownerType: CommitmentOwnerType;
  ownerId: number;
  description: string;
  dueAt: Date | null;
  status: CommitmentStatus;
  source: string;
  actor: string;
  createdAt: Date;
  completedAt: Date | null;
};

// A commitment is overdue only while it is still OPEN and its due date has
// passed. A DONE or CANCELLED commitment is never overdue, regardless of
// when it was due -- overdue is a property of unresolved promises, not a
// permanent stain on history.
export function isCommitmentOverdue(
  commitment: Pick<CommitmentRow, "status" | "dueAt">,
  now: Date = new Date(),
): boolean {
  if (commitment.status !== "OPEN") return false;
  if (!commitment.dueAt) return false;
  return commitment.dueAt.getTime() < now.getTime();
}

export function sortCommitmentsByUrgency(
  commitments: CommitmentRow[],
  now: Date = new Date(),
): CommitmentRow[] {
  const rank = (c: CommitmentRow) => {
    if (isCommitmentOverdue(c, now)) return 0;
    if (c.dueAt) return 1;
    return 2;
  };
  return [...commitments].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const aTime = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

export function validateNewCommitment(input: {
  ownerType: unknown;
  ownerId: unknown;
  description: unknown;
  dueAtIso?: unknown;
}): { ok: true; description: string; dueAt: Date | null } | { ok: false; error: string } {
  if (!isCommitmentOwnerType(input.ownerType)) {
    return { ok: false, error: "Invalid owner type." };
  }
  if (!isPositiveInt(input.ownerId)) {
    return { ok: false, error: "Invalid owner." };
  }
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (!description) {
    return { ok: false, error: "Description is required." };
  }
  if (description.length > 500) {
    return { ok: false, error: "Description is too long (max 500 characters)." };
  }
  let dueAt: Date | null = null;
  if (input.dueAtIso) {
    if (typeof input.dueAtIso !== "string") {
      return { ok: false, error: "Invalid due date." };
    }
    const parsed = new Date(input.dueAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invalid due date." };
    }
    dueAt = parsed;
  }
  return { ok: true, description, dueAt };
}
