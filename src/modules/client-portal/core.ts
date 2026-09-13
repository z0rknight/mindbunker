import type {
  VideoContentType,
  VideoOrientation,
  VideoStatus,
} from "../productivity/config.ts";
import { VIDEO_CONTENT_TYPE_LABELS } from "../productivity/config.ts";
import { validateDeliveryUrl, validateCoverUrl } from "../productivity/core.ts";
import type { ProjectStatus } from "../projects/config.ts";
import { resolveCoverUrl, toClientWorkerCoverUrl } from "../media/core.ts";
import type { ClientQuoteSummary } from "../quotes/core.ts";

export const CLIENT_VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In production",
  READY_FOR_REVIEW: "Review",
  CHANGES_REQUESTED: "Updates in progress",
  DONE: "Delivered",
};

// Client Portal Reality round §K (historical friction sweep, item 2): the
// static DONE -> "Delivered" label above reads as false confidence when a
// video is marked DONE (production finished) but never actually got a
// delivery link -- e.g. a batch status clean-up, or a video finished but
// not yet handed off. "Delivered" now requires a real deliveryUrl;
// otherwise a DONE video reads as "Completed" (production finished, not
// yet delivered). Every other status keeps the static label unchanged.
export function clientVideoStatusLabel(
  status: VideoStatus,
  hasDeliveryUrl: boolean,
): string {
  if (status === "DONE") {
    return hasDeliveryUrl ? "Delivered" : "Completed";
  }
  return CLIENT_VIDEO_STATUS_LABELS[status];
}

export const CLIENT_PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Upcoming",
  active: "Active",
  review: "Review",
  delivered: "Completed",
  archived: "Completed",
};

const PROJECT_STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  review: 1,
  planned: 2,
  delivered: 3,
  archived: 4,
};

export type ClientPortalProjectRow = {
  id: number;
  clientId: number;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
};

export type ClientPortalVideoRow = {
  id: number;
  projectId: number | null;
  clientId: number | null;
  projectClientId: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  batchLabel: string | null;
  // Client Portal Reality round: this token-based Vault surface never
  // carried covers at all, unlike the authenticated dashboard below --
  // same fallback chain (Video -> Project), tier 2 only, same as
  // toCard's coverUrl resolution.
  coverUrl: string | null;
  projectCoverUrl: string | null;
  clientDefaultCoverUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ClientPortalProject = {
  name: string;
  status: string;
  deadline: string | null;
  videos: Array<{
    id: number;
    title: string;
    status: string;
    lastUpdated: string | null;
    deliveryUrl: string | null;
    reviewUrl: string | null;
    publishedUrl: string | null;
    batchLabel: string | null;
    coverUrl: string | null;
  }>;
};

function lastMeaningfulUpdate(video: ClientPortalVideoRow) {
  const value = video.updatedAt ?? video.createdAt;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

/**
 * Defense-in-depth projection. Database queries are already scoped by the
 * capability token; this function applies ownership checks again and strips
 * every internal identifier before data reaches the portal page.
 */
export function buildClientPortalProjects(
  authenticatedClientId: number,
  projectRows: readonly ClientPortalProjectRow[],
  videoRows: readonly ClientPortalVideoRow[],
): ClientPortalProject[] {
  const ownedProjects = projectRows
    .filter((project) => project.clientId === authenticatedClientId)
    .toSorted((a, b) => {
      const statusDifference =
        PROJECT_STATUS_ORDER[a.status] - PROJECT_STATUS_ORDER[b.status];
      if (statusDifference !== 0) return statusDifference;
      return (a.deadline ?? "9999-12-31").localeCompare(
        b.deadline ?? "9999-12-31",
      );
    });
  const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));

  return ownedProjects.map((project) => ({
    name: project.name,
    status: CLIENT_PROJECT_STATUS_LABELS[project.status],
    deadline: project.deadline,
    videos: videoRows
      .filter(
        (video) =>
          video.projectId === project.id &&
          ownedProjectIds.has(project.id) &&
          video.clientId === authenticatedClientId &&
          video.projectClientId === authenticatedClientId,
      )
      .map((video) => {
        const deliveryUrl = validateDeliveryUrl(video.deliveryUrl);
        const reviewUrl = validateDeliveryUrl(video.reviewUrl);
        const publishedUrl = validateDeliveryUrl(video.publishedUrl);
        // Client Vault Cover Bug fix (25 Aug 2026): this was
        // validateDeliveryUrl, which requires an absolute https:// URL --
        // it silently rejected the app's own internal cover route
        // (/mindbunker/media/covers/<uuid>.<ext>, a relative path) and
        // fell back to null, so an uploaded R2 cover that rendered fine
        // operator-side showed as "No preview yet" client-side.
        // validateCoverUrl is the correct validator here: it recognizes
        // that internal route via isInternalCoverRoute before falling
        // back to the same strict-HTTPS check for any external URL.
        const coverUrl = validateCoverUrl(
          resolveCoverUrl(
            video.coverUrl,
            video.projectCoverUrl,
            video.clientDefaultCoverUrl,
          ),
        );
        // deliveryUrl.success is true both when a real URL validated AND
        // when there simply was none (validateDeliveryUrl treats null/""
        // as a valid "absence") -- Delivered must require an actual link,
        // so check the resolved value, not just .success.
        const resolvedDeliveryUrl = deliveryUrl.success ? deliveryUrl.value : null;
        return {
          id: video.id,
          title: video.title?.trim() || `Video ${video.date}`,
          status: clientVideoStatusLabel(video.status, resolvedDeliveryUrl !== null),
          lastUpdated: lastMeaningfulUpdate(video),
          deliveryUrl: resolvedDeliveryUrl,
          reviewUrl: reviewUrl.success ? reviewUrl.value : null,
          publishedUrl: publishedUrl.success ? publishedUrl.value : null,
          batchLabel: video.batchLabel?.trim() || null,
          coverUrl: coverUrl.success ? toClientWorkerCoverUrl(coverUrl.value) : null,
        };
      }),
  }));
}


// --- Client Dashboard (Sprint 1.2.2 Client Portal Identity round) ---------
//
// Same defense-in-depth discipline as buildClientPortalProjects above:
// database queries are already scoped to the authenticated client, and this
// function re-derives ownership again and strips every field that isn't on
// the client-safe allowlist before anything reaches a page component.
//
// Deliberately expresses "current state" as counts + short lists rather
// than a raw dump of every video, and deliberately does NOT expose
// created-this-week or worked-on-this-week -- the former is easy to
// conflate with completed-this-week (the brief explicitly warns against
// this), and the latter is derived from work_sessions, which is
// operator-private data (labor/time-tracking) that must never cross this
// boundary regardless of how it's framed.

export type ClientDashboardVideoRow = {
  id: number;
  projectId: number | null;
  clientId: number | null;
  projectClientId: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  batchLabel: string | null;
  coverUrl: string | null;
  // Sprint 3 P1: cover fallback tier 2 -- see resolveCoverUrl below.
  projectCoverUrl: string | null;
  clientDefaultCoverUrl: string | null;
  orientation: VideoOrientation | null;
  contentType: VideoContentType | null;
  // Lunch Reality Patch P1 §7: client-settable "priority now" video.
  isPriority: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * One row per `video.finished` crm_events entry -- i.e. the moment an
 * operator marked a video DONE. This is the only honest source for
 * "completed this week" / "recent deliveries": video_logs.updatedAt is
 * touched by ANY edit (including unrelated metadata fixes after delivery),
 * not just status transitions, so it cannot truthfully answer "when was
 * this completed." See CLIENT_VIDEO_STATUS_LABELS' DONE -> "Delivered"
 * mapping for the one open question this does NOT resolve: DONE means the
 * operator finished production, not that delivery to the client has been
 * separately confirmed. Documented, not resolved, this round (carried over
 * from the Sunday Systems Round report).
 */
export type ClientCompletionEventRow = {
  videoId: number | null;
  createdAt: Date | null;
};

export type ClientDashboardVideoCard = {
  id: number;
  title: string;
  status: VideoStatus;
  statusLabel: string;
  projectId: number | null;
  projectName: string | null;
  contentType: VideoContentType | null;
  contentTypeLabel: string | null;
  orientation: VideoOrientation | null;
  coverUrl: string | null;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  batchLabel: string | null;
  lastUpdated: string | null;
  // Lunch Reality Patch P1 §7: client-settable "priority now" video.
  isPriority: boolean;
  // Quick Morning Reality Patch (26 Aug 2026) §4: how many videos this
  // video's project currently has, from the client's own owned-video set.
  // null when the video has no project. Lets the UI distinguish "the only
  // candidate in this project" (an honest static state -- there is
  // nothing else to prioritize against) from "one of several" (a real
  // choice, worth an actionable toggle). Never used for ranking/ordering,
  // only for this single UI decision.
  projectVideoCount: number | null;
};

export type ClientDashboard = {
  activeProjectsCount: number;
  totalVideos: number;
  totals: {
    completed: number;
    inProduction: number;
    readyForReview: number;
  };
  completedThisWeek: number;
  // Sprint 3 P1 (Client Gateway Intelligence): total video activity in
  // the period, by production date -- distinct from completedThisWeek
  // above, which counts only videos actually finished this week. A video
  // shot this week that is still in production counts here but not there.
  videosThisWeek: number;
  videosThisMonth: number;
  currentWork: ClientDashboardVideoCard[];
  readyForReview: ClientDashboardVideoCard[];
  recentDeliveries: Array<ClientDashboardVideoCard & { deliveredAt: string | null }>;
  allVideos: ClientDashboardVideoCard[];
  contentBreakdown: Array<{
    contentType: VideoContentType;
    label: string;
    completedCount: number;
  }>;
  unclassifiedCompletedCount: number;
};

export function toCard(
  video: ClientDashboardVideoRow,
  projectNameById: Map<number, string>,
  projectVideoCounts: Map<number, number> = new Map(),
): ClientDashboardVideoCard {
  const deliveryUrl = validateDeliveryUrl(video.deliveryUrl);
  const reviewUrl = validateDeliveryUrl(video.reviewUrl);
  const publishedUrl = validateDeliveryUrl(video.publishedUrl);
  // Sprint 3 P1 cover fallback chain, tier 2 only (Video -> Project): the
  // Client's own avatar is deliberately not tier 3 here -- a client
  // viewing their own portal doesn't need their own avatar as a video
  // placeholder; VideoCard's existing "No preview yet" state already
  // covers the empty case cleanly.
  // Client Vault Cover Bug fix (25 Aug 2026): see the identical fix and
  // full explanation in buildClientPortalProjects above -- same wrong
  // validator, same silent-null failure mode, same fix.
  const coverUrl = validateCoverUrl(
    resolveCoverUrl(
      video.coverUrl,
      video.projectCoverUrl,
      video.clientDefaultCoverUrl,
    ),
  );
  const updated = video.updatedAt ?? video.createdAt;
  // Same fix as buildClientPortalProjects above: check the resolved value,
  // not just .success (which is also true when there's simply no URL).
  const resolvedDeliveryUrl = deliveryUrl.success ? deliveryUrl.value : null;
  return {
    id: video.id,
    title: video.title?.trim() || `Video ${video.date}`,
    status: video.status,
    statusLabel: clientVideoStatusLabel(video.status, resolvedDeliveryUrl !== null),
    projectId: video.projectId,
    projectName: video.projectId ? (projectNameById.get(video.projectId) ?? null) : null,
    contentType: video.contentType,
    contentTypeLabel: video.contentType
      ? VIDEO_CONTENT_TYPE_LABELS[video.contentType]
      : null,
    orientation: video.orientation,
    coverUrl: coverUrl.success ? toClientWorkerCoverUrl(coverUrl.value) : null,
    deliveryUrl: resolvedDeliveryUrl,
    reviewUrl: reviewUrl.success ? reviewUrl.value : null,
    publishedUrl: publishedUrl.success ? publishedUrl.value : null,
    batchLabel: video.batchLabel?.trim() || null,
    lastUpdated:
      updated instanceof Date && !Number.isNaN(updated.getTime())
        ? updated.toISOString()
        : null,
    isPriority: video.isPriority,
    projectVideoCount:
      video.projectId !== null ? (projectVideoCounts.get(video.projectId) ?? null) : null,
  };
}

function startOfWeekUTC(now: Date) {
  // Monday-anchored week, matching the rest of the app's ISO-week
  // conventions (see src/utils/date.ts). Computed in UTC to avoid the
  // React-Compiler-forbidden Date.now()/local-timezone drift issue that
  // bit an earlier round -- callers pass `now` in explicitly.
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

function startOfMonthUTC(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function buildClientDashboard(
  authenticatedClientId: number,
  projectRows: readonly ClientPortalProjectRow[],
  videoRows: readonly ClientDashboardVideoRow[],
  completionEvents: readonly ClientCompletionEventRow[],
  now: Date,
): ClientDashboard {
  const ownedProjects = projectRows.filter(
    (project) => project.clientId === authenticatedClientId,
  );
  const projectNameById = new Map(
    ownedProjects.map((project) => [project.id, project.name]),
  );
  const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));

  const ownedVideos = videoRows.filter(
    (video) =>
      video.clientId === authenticatedClientId &&
      video.projectClientId === authenticatedClientId &&
      (video.projectId === null || ownedProjectIds.has(video.projectId)),
  );
  const ownedVideoIds = new Set(ownedVideos.map((video) => video.id));

  // Quick Morning Reality Patch §4: per-project sibling count within this
  // client's own owned videos, so toCard can tell "only video in this
  // project" from "one of several" -- see projectVideoCount's comment on
  // ClientDashboardVideoCard.
  const projectVideoCounts = new Map<number, number>();
  for (const video of ownedVideos) {
    if (video.projectId !== null) {
      projectVideoCounts.set(video.projectId, (projectVideoCounts.get(video.projectId) ?? 0) + 1);
    }
  }

  const inProduction = ownedVideos.filter(
    (video) => video.status === "IN_PROGRESS" || video.status === "CHANGES_REQUESTED",
  );
  const readyForReview = ownedVideos.filter(
    (video) => video.status === "READY_FOR_REVIEW",
  );
  const completed = ownedVideos.filter((video) => video.status === "DONE");

  const currentlyCompletedVideoIds = new Set(completed.map((video) => video.id));
  const weekStart = startOfWeekUTC(now);
  const relevantCompletionEvents = completionEvents.filter(
    (event) =>
      event.videoId !== null &&
      ownedVideoIds.has(event.videoId) &&
      currentlyCompletedVideoIds.has(event.videoId),
  );
  const completedThisWeekVideoIds = new Set(
    relevantCompletionEvents
      .filter((event) => (event.createdAt?.getTime() ?? 0) >= weekStart.getTime())
      .map((event) => event.videoId as number),
  );

  const videoById = new Map(ownedVideos.map((video) => [video.id, video]));
  const recentDeliveries = relevantCompletionEvents
    .toSorted((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 5)
    .map((event) => {
      const video = event.videoId !== null ? videoById.get(event.videoId) : undefined;
      if (!video) return null;
      return {
        ...toCard(video, projectNameById, projectVideoCounts),
        deliveredAt:
          event.createdAt instanceof Date && !Number.isNaN(event.createdAt.getTime())
            ? event.createdAt.toISOString()
            : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const contentBreakdownCounts = new Map<VideoContentType, number>();
  let unclassifiedCompletedCount = 0;
  for (const video of completed) {
    if (video.contentType) {
      contentBreakdownCounts.set(
        video.contentType,
        (contentBreakdownCounts.get(video.contentType) ?? 0) + 1,
      );
    } else {
      unclassifiedCompletedCount += 1;
    }
  }

  const weekStartDateKey = weekStart.toISOString().slice(0, 10);
  const monthStartDateKey = startOfMonthUTC(now).toISOString().slice(0, 10);

  return {
    activeProjectsCount: ownedProjects.filter((project) => project.status === "active")
      .length,
    totalVideos: ownedVideos.length,
    totals: {
      completed: completed.length,
      inProduction: inProduction.length,
      readyForReview: readyForReview.length,
    },
    completedThisWeek: completedThisWeekVideoIds.size,
    videosThisWeek: ownedVideos.filter((video) => video.date >= weekStartDateKey).length,
    videosThisMonth: ownedVideos.filter((video) => video.date >= monthStartDateKey).length,
    currentWork: inProduction
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById, projectVideoCounts)),
    readyForReview: readyForReview
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById, projectVideoCounts)),
    recentDeliveries,
    allVideos: ownedVideos
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById, projectVideoCounts)),
    contentBreakdown: Array.from(contentBreakdownCounts.entries()).map(
      ([contentType, completedCount]) => ({
        contentType,
        label: VIDEO_CONTENT_TYPE_LABELS[contentType],
        completedCount,
      }),
    ),
    unclassifiedCompletedCount,
  };
}

export function filterClientDashboardVideos(
  videos: readonly ClientDashboardVideoCard[],
  contentType: "all" | VideoContentType,
) {
  return contentType === "all"
    ? [...videos]
    : videos.filter((video) => video.contentType === contentType);
}

// Client Portal Gateway round: instant text search over the video library.
// Deliberately searches only the same client-safe fields already rendered
// on the card (title, project name) -- never internal notes, which never
// reach this type in the first place (ClientDashboardVideoCard has no
// notes field), so there is no separate "don't leak notes" check needed
// here beyond the type itself. Case-insensitive substring match, not a
// fuzzy/ranked search -- with realistic per-client volumes (dozens, not
// tens of thousands) a plain substring filter is instant and predictable.
export function searchClientDashboardVideos<T extends ClientDashboardVideoCard>(
  videos: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...videos];
  return videos.filter((video) => {
    const haystack = `${video.title} ${video.projectName ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

// Client Vault "video must act like a video" fix (25 Aug 2026, brief §9):
// a client-safe single-video detail, built from the same validated card
// (toCard) plus an optional approved-quote summary. No internal notes, no
// rate-equivalent, no private Finance, no Sensor data -- exactly the same
// fields the list card already exposes, plus the quote.
export type ClientVideoDetail = ClientDashboardVideoCard & {
  quote: ClientQuoteSummary | null;
};

export function buildClientVideoDetail(
  video: ClientDashboardVideoRow,
  projectNameById: Map<number, string>,
  quote: ClientQuoteSummary | null,
  projectVideoCount: number | null,
): ClientVideoDetail {
  const projectVideoCounts =
    video.projectId !== null && projectVideoCount !== null
      ? new Map([[video.projectId, projectVideoCount]])
      : new Map<number, number>();
  return {
    ...toCard(video, projectNameById, projectVideoCounts),
    quote,
  };
}

// Client Portal Gateway round (Client Billing Transparency): "current
// recorded spend" -- the client-facing projection of the SAME
// billing_evidence/billing_allocations chain Finance already treats as
// the canonical, admin-curated record of billed work (see
// custody/core.ts's buildCustodyProjection for the admin-side sibling of
// this aggregation, and finance/actions.ts's getBillingHistoryForContract
// for the per-contract admin view). Deliberately NOT derived from
// work_sessions -- work_sessions is operator-private labor/time-tracking
// data that must never cross this boundary (see the comment on
// getClientDashboardView's data-selection in data.ts), and
// billing_evidence is the only table in this codebase that already
// represents a finalized, snapshotted, client-attributable dollar amount.
// `hasAnyRecordedWork: false` is a genuine, honest empty state (nothing
// has been transcribed into billing_evidence yet) -- it is never
// papered over with a fabricated $0.00 total that would read as "you have
// spent zero dollars" when the truth is "nothing has been recorded yet."
// Amounts are grouped by currency and never summed across currencies.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ClientBillingContractRow = {
  id: number;
  clientId: number;
  currency: string;
  billingType: "HOURLY" | "FIXED";
  hourlyRate: number | null;
};

export type ClientBillingEvidenceRow = {
  contractId: number;
  // Defense-in-depth: the row's own join-time clientId, re-checked here
  // rather than trusted from the SQL WHERE clause alone -- same pattern as
  // buildClientPortalProjects/buildClientDashboard above.
  contractClientId: number;
  currency: string;
  billableMinutes: number;
  grossAmount: number;
};

export type ClientBillingAllocationRow = {
  contractClientId: number;
  amount: number;
  minutes: number | null;
  currency: string;
  videoId: number | null;
  projectId: number | null;
};

export type ClientBillingCurrencyTotal = {
  currency: string;
  totalAmount: number;
  totalMinutes: number;
  // Only populated when exactly one HOURLY contract with a rate exists for
  // this client in this currency -- multiple contracts, or a FIXED
  // contract, would make a single "$X/hour" line dishonest, so it is
  // omitted rather than guessed at.
  hourlyRate: number | null;
};

export type ClientBillingProjectBreakdown = {
  projectId: number | null; // null = "Other / not yet assigned to a project"
  projectName: string | null;
  currency: string;
  amount: number;
  minutes: number | null;
};

export type ClientBillingSummary = {
  visibility?: "visible" | "hidden";
  hasAnyRecordedWork: boolean;
  byCurrency: ClientBillingCurrencyTotal[];
  byProject: ClientBillingProjectBreakdown[];
};

export function buildClientBillingSummary(
  authenticatedClientId: number,
  contractRows: readonly ClientBillingContractRow[],
  evidenceRows: readonly ClientBillingEvidenceRow[],
  allocationRows: readonly ClientBillingAllocationRow[],
  projectNameById: ReadonlyMap<number, string>,
): ClientBillingSummary {
  const ownedContracts = contractRows.filter(
    (contract) => contract.clientId === authenticatedClientId,
  );
  const ownedContractIds = new Set(ownedContracts.map((contract) => contract.id));

  const ownedEvidence = evidenceRows.filter(
    (evidence) =>
      evidence.contractClientId === authenticatedClientId &&
      ownedContractIds.has(evidence.contractId),
  );

  const byCurrencyMap = new Map<string, { totalAmount: number; totalMinutes: number }>();
  for (const evidence of ownedEvidence) {
    const bucket = byCurrencyMap.get(evidence.currency) ?? { totalAmount: 0, totalMinutes: 0 };
    bucket.totalAmount += evidence.grossAmount;
    bucket.totalMinutes += evidence.billableMinutes;
    byCurrencyMap.set(evidence.currency, bucket);
  }

  const byCurrency: ClientBillingCurrencyTotal[] = Array.from(byCurrencyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, totals]) => {
      const hourlyContractsInCurrency = ownedContracts.filter(
        (contract) =>
          contract.currency === currency &&
          contract.billingType === "HOURLY" &&
          contract.hourlyRate !== null,
      );
      return {
        currency,
        totalAmount: round2(totals.totalAmount),
        totalMinutes: totals.totalMinutes,
        hourlyRate: hourlyContractsInCurrency.length === 1 ? hourlyContractsInCurrency[0].hourlyRate : null,
      };
    });

  const ownedAllocations = allocationRows.filter(
    (allocation) => allocation.contractClientId === authenticatedClientId,
  );

  const byProjectMap = new Map<
    string,
    { projectId: number | null; currency: string; amount: number; minutes: number }
  >();
  for (const allocation of ownedAllocations) {
    const key = `${allocation.projectId ?? "none"}:${allocation.currency}`;
    const bucket =
      byProjectMap.get(key) ??
      { projectId: allocation.projectId, currency: allocation.currency, amount: 0, minutes: 0 };
    bucket.amount += allocation.amount;
    bucket.minutes += allocation.minutes ?? 0;
    byProjectMap.set(key, bucket);
  }

  const byProject: ClientBillingProjectBreakdown[] = Array.from(byProjectMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => ({
      projectId: entry.projectId,
      projectName: entry.projectId !== null ? (projectNameById.get(entry.projectId) ?? null) : null,
      currency: entry.currency,
      amount: round2(entry.amount),
      minutes: entry.minutes > 0 ? entry.minutes : null,
    }));

  return {
    hasAnyRecordedWork: ownedEvidence.length > 0,
    byCurrency,
    byProject,
  };
}
