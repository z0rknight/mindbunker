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

export function selectActiveContractForClient<T extends { clientId: number; status: string }>(
  contracts: T[],
  clientId: number,
): T | null {
  return contracts.find((contract) => contract.clientId === clientId && contract.status === "ACTIVE") ?? null;
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
