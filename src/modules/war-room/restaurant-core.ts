// War Room Restaurant View V1 -- pure derived read model.
//
// This is a PRESENTATION projection only: it reshapes facts that already
// exist elsewhere (video lifecycle, production orders, work sessions,
// canonical billing allocations) into a bounded set of "tables" and
// "tickets" for the restaurant stage. It computes nothing new, persists
// nothing, and never invents a dollar figure -- a client with no
// canonical attribution simply carries no `attributable` entry, never a
// fabricated $0.

import { round2, type UnallocatedManualEvidence } from "../finance/core.ts";
import type { ClientBillingProjectBreakdown } from "../client-portal/core.ts";
import type { VideoStatus } from "../productivity/config.ts";
import type { ProductionOrderListRow } from "../production-orders/data.ts";
import { PRODUCTION_ORDER_PHASE_LABELS, type ProductionOrderPhase } from "../production-orders/config.ts";
import type { OpenWorkSession } from "../work-sessions/core.ts";
import { isInternalClientName } from "../../lib/client-identity.ts";

export const RESTAURANT_MAX_TABLES = 8;
export const RESTAURANT_MAX_TICKETS = 8;

export type RestaurantClientHealth = "ACTIVE" | "REVIEW" | "BLOCKED" | "IDLE";

export type RestaurantClientCandidateInput = {
  id: number;
  name: string;
  archivalState: string | null;
};

export type RestaurantVideoInput = {
  id: number;
  clientId: number | null;
  projectId: number | null;
  projectName: string | null;
  status: VideoStatus;
  videoKind: string;
  isOperationalContainer: boolean;
};

export type SelectedRestaurantClient = {
  id: number;
  name: string;
  activeCount: number;
  reviewCount: number;
  blockedCount: number;
  health: RestaurantClientHealth;
  lastActiveAt: string | null;
  projects: Array<{ id: number; name: string }>;
};

// A container row represents the whole Production Order rather than a
// deliverable, and SAMPLE/INTERNAL kinds are not real client work -- both
// would inflate a client's "active" count with items that were never
// actually promised to that client.
function isRealClientDeliverable(video: RestaurantVideoInput): boolean {
  return !video.isOperationalContainer && video.videoKind === "CLIENT_WORK";
}

export function selectRestaurantClients(
  clients: readonly RestaurantClientCandidateInput[],
  videos: readonly RestaurantVideoInput[],
  blockedVideoIds: ReadonlySet<number>,
  lastActiveByClient: ReadonlyMap<number, string>,
  limit: number = RESTAURANT_MAX_TABLES,
): SelectedRestaurantClient[] {
  const eligibleClients = new Map(
    clients
      .filter((c) => c.archivalState !== "GELADEIRA" && !isInternalClientName(c.name))
      .map((c) => [c.id, c] as const),
  );

  type Accumulator = {
    active: number;
    review: number;
    blocked: number;
    projects: Map<number, string>;
  };
  const byClient = new Map<number, Accumulator>();
  for (const video of videos) {
    if (video.clientId === null || !eligibleClients.has(video.clientId)) continue;
    if (!isRealClientDeliverable(video)) continue;
    const entry = byClient.get(video.clientId) ?? { active: 0, review: 0, blocked: 0, projects: new Map() };
    if (video.status === "IN_PROGRESS") entry.active += 1;
    if (video.status === "READY_FOR_REVIEW" || video.status === "CHANGES_REQUESTED") entry.review += 1;
    if (blockedVideoIds.has(video.id)) entry.blocked += 1;
    if (video.projectId !== null && video.projectName) entry.projects.set(video.projectId, video.projectName);
    byClient.set(video.clientId, entry);
  }

  // Candidate pool: any eligible client with a current deliverable OR a
  // recent Work Session -- never the full historical client list, per the
  // mission's explicit "do not fill the restaurant with historical
  // inactive clients" instruction.
  const candidateIds = new Set<number>([...byClient.keys(), ...lastActiveByClient.keys()]);

  const candidates: SelectedRestaurantClient[] = [];
  for (const clientId of candidateIds) {
    const client = eligibleClients.get(clientId);
    if (!client) continue;
    const entry = byClient.get(clientId) ?? { active: 0, review: 0, blocked: 0, projects: new Map() };
    const health: RestaurantClientHealth =
      entry.blocked > 0 ? "BLOCKED" : entry.review > 0 ? "REVIEW" : entry.active > 0 ? "ACTIVE" : "IDLE";
    candidates.push({
      id: clientId,
      name: client.name,
      activeCount: entry.active,
      reviewCount: entry.review,
      blockedCount: entry.blocked,
      health,
      lastActiveAt: lastActiveByClient.get(clientId) ?? null,
      projects: Array.from(entry.projects, ([id, name]) => ({ id, name })),
    });
  }

  // Deterministic ranking: current work first, then recency, then a
  // stable name/id tiebreak so the same input always produces the same
  // table assignment.
  candidates.sort((a, b) => {
    const aHasWork = a.activeCount + a.reviewCount > 0 ? 1 : 0;
    const bHasWork = b.activeCount + b.reviewCount > 0 ? 1 : 0;
    if (aHasWork !== bHasWork) return bHasWork - aHasWork;
    const aRecency = a.lastActiveAt ?? "";
    const bRecency = b.lastActiveAt ?? "";
    if (aRecency !== bRecency) return aRecency > bRecency ? -1 : 1;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.id - b.id;
  });

  return candidates.slice(0, limit);
}

export type RestaurantAttributableAmount = {
  currency: string;
  amount: number;
  minutes: number | null;
};

export type RestaurantClientTable = SelectedRestaurantClient & {
  attributable: RestaurantAttributableAmount[];
  hasUnallocatedHistorical: boolean;
};

export type RestaurantCommercialInput = {
  byProject: ClientBillingProjectBreakdown[];
  unallocatedManualEvidence: UnallocatedManualEvidence[];
};

// Sums only canonical `billing_allocations` (never the separate
// unallocated-evidence figure) per currency, across every project for
// this client -- the same "confirmed attributable" semantic already
// proven in the CRM Active Jobs panel, just grouped one level higher for
// the table's compact ticket.
export function attachRestaurantCommercials(
  selected: readonly SelectedRestaurantClient[],
  commercialByClientId: ReadonlyMap<number, RestaurantCommercialInput>,
): RestaurantClientTable[] {
  return selected.map((client) => {
    const commercial = commercialByClientId.get(client.id);
    const byProject = commercial?.byProject ?? [];
    const byCurrency = new Map<string, { amount: number; minutes: number | null }>();
    for (const row of byProject) {
      const existing = byCurrency.get(row.currency) ?? { amount: 0, minutes: null };
      existing.amount = round2(existing.amount + row.amount);
      if (row.minutes !== null) {
        existing.minutes = (existing.minutes ?? 0) + row.minutes;
      }
      byCurrency.set(row.currency, existing);
    }
    return {
      ...client,
      attributable: Array.from(byCurrency, ([currency, v]) => ({ currency, amount: v.amount, minutes: v.minutes })),
      hasUnallocatedHistorical: (commercial?.unallocatedManualEvidence.length ?? 0) > 0,
    };
  });
}

export type RestaurantTicket = {
  id: number;
  clientId: number;
  clientName: string;
  label: string;
  projectName: string;
  itemCount: number;
  phase: ProductionOrderPhase;
  phaseLabel: string;
};

const PHASE_URGENCY: Record<ProductionOrderPhase, number> = {
  REVIEW: 0,
  IN_PRODUCTION: 1,
  RECEIVED: 2,
  DELIVERED: 3,
};

// The comanda rail only shows what is still open -- a DELIVERED order has
// already left the kitchen and belongs in history, not the active queue.
export function buildRestaurantTickets(
  orders: readonly ProductionOrderListRow[],
  limit: number = RESTAURANT_MAX_TICKETS,
): RestaurantTicket[] {
  const open = orders.filter((o) => o.state === "OPEN" && o.phase !== "DELIVERED");
  const sorted = [...open].sort((a, b) => {
    const byPhase = PHASE_URGENCY[a.phase] - PHASE_URGENCY[b.phase];
    if (byPhase !== 0) return byPhase;
    if (a.receivedAt !== b.receivedAt) return a.receivedAt < b.receivedAt ? -1 : 1;
    return a.id - b.id;
  });
  return sorted.slice(0, limit).map((o) => ({
    id: o.id,
    clientId: o.clientId,
    clientName: o.clientName,
    label: o.label,
    projectName: o.projectName,
    itemCount: o.activeItemCount,
    phase: o.phase,
    phaseLabel: PRODUCTION_ORDER_PHASE_LABELS[o.phase],
  }));
}

export type RestaurantActiveSession = {
  clientId: number | null;
  clientName: string | null;
  videoTitle: string;
  activityType: string;
  elapsedSeconds: number;
  stale: boolean;
};

// Work Session stays the one canonical timer -- this never starts a
// second clock, it only reflects the elapsed value War Room already
// computes for NowFocusPanel.
export function buildRestaurantActiveSession(
  openSession: OpenWorkSession | null,
  elapsedSeconds: number,
  stale: boolean,
): RestaurantActiveSession | null {
  if (!openSession) return null;
  return {
    clientId: openSession.clientId,
    clientName: openSession.clientName,
    videoTitle: openSession.videoTitle,
    activityType: openSession.activityType,
    elapsedSeconds,
    stale,
  };
}

export type RestaurantViewModel = {
  activeSession: RestaurantActiveSession | null;
  clients: RestaurantClientTable[];
  tickets: RestaurantTicket[];
};

export function buildRestaurantViewModel(input: {
  selectedClients: readonly SelectedRestaurantClient[];
  commercialByClientId: ReadonlyMap<number, RestaurantCommercialInput>;
  productionOrders: readonly ProductionOrderListRow[];
  openSession: OpenWorkSession | null;
  openSessionElapsedSeconds: number;
  openSessionStale: boolean;
  maxTickets?: number;
}): RestaurantViewModel {
  return {
    activeSession: buildRestaurantActiveSession(
      input.openSession,
      input.openSessionElapsedSeconds,
      input.openSessionStale,
    ),
    clients: attachRestaurantCommercials(input.selectedClients, input.commercialByClientId),
    tickets: buildRestaurantTickets(input.productionOrders, input.maxTickets ?? RESTAURANT_MAX_TICKETS),
  };
}
