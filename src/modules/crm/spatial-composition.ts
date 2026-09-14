// Spatial Recomposition Wave 4: pure read-model composition for the CRM
// client-detail page's 5-region layout. Extracted out of page.tsx and its
// region components so this logic is directly unit-testable with this
// repo's plain `node --test` runner (no "@/*" alias, no DB, no React) --
// see src/modules/client-portal/auth-data.test.mjs for why "@/*"-aliased
// modules aren't imported directly in tests here. Only relative imports of
// alias-free modules (PROJECT_STATUS_GROUPS) are used below.
import { PROJECT_STATUS_GROUPS } from "../projects/config.ts";
import type { ProjectStatus } from "../projects/config.ts";

export function selectActiveJobs<T extends { status: ProjectStatus }>(
  projects: T[],
  maxCount: number,
): { shown: T[]; hiddenCount: number } {
  const active = projects.filter((project) => PROJECT_STATUS_GROUPS[project.status] === "active");
  const shown = active.slice(0, maxCount);
  return { shown, hiddenCount: active.length - shown.length };
}

export function boundedSlice<T>(items: T[], maxCount: number): { shown: T[]; hiddenCount: number } {
  const shown = items.slice(0, maxCount);
  return { shown, hiddenCount: items.length - shown.length };
}

export function filterVideosForClient<T extends { clientId: number }>(videos: T[], clientId: number): T[] {
  return videos.filter((video) => video.clientId === clientId);
}

function contractTimeValue(value: Date | string | number | null): number {
  if (value === null) return -Infinity;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

// Wave 5 §7 hardening: a client can (today, incidentally) have at most one
// ACTIVE contract, but nothing enforced that, and the old implementation
// picked whichever ACTIVE row happened to come first in the caller's
// array -- correct only because getCommercialContracts() happens to sort
// desc(createdAt) today, an accidental dependency this function had no
// control over. This now resolves ties itself (most recently created
// ACTIVE contract wins, highest id as the final tiebreaker) regardless of
// input order, so a historical/superseded contract can never win over a
// newer current one even if it were ever passed in a different order.
export function selectActiveContractForClient<
  T extends { id: number; clientId: number; status: string; createdAt: Date | string | number | null },
>(contracts: T[], clientId: number): T | null {
  const activeForClient = contracts.filter(
    (contract) => contract.clientId === clientId && contract.status === "ACTIVE",
  );
  if (activeForClient.length === 0) return null;
  return activeForClient.reduce((mostRecent, candidate) => {
    const mostRecentTime = contractTimeValue(mostRecent.createdAt);
    const candidateTime = contractTimeValue(candidate.createdAt);
    if (candidateTime !== mostRecentTime) return candidateTime > mostRecentTime ? candidate : mostRecent;
    return candidate.id > mostRecent.id ? candidate : mostRecent;
  });
}

export function formatCommercialRelationship(
  contract: { platform: string; billingType: "HOURLY" | "FIXED"; hourlyRate: number | null } | null,
  formatRate: (amount: number) => string,
): string {
  if (!contract) return "No contract on file";
  if (contract.billingType === "HOURLY" && contract.hourlyRate) {
    return `${contract.platform} · Hourly · ${formatRate(contract.hourlyRate)}/hr`;
  }
  return `${contract.platform} · ${contract.billingType === "FIXED" ? "Fixed" : "Hourly"}`;
}
