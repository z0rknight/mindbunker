"use client";

import { useMemo, useState } from "react";
import {
  groupClientWorkByProject,
  indexClientBillingByProject,
  searchClientDashboardVideos,
  type ClientBillingSummary,
  type ClientDashboardVideoCard,
  type ClientWorkGroup,
} from "@/modules/client-portal/core";
import { formatCurrency } from "@/utils/date";
import { VideoCard } from "./VideoCard";

// Work Explorer (Bonnie/Taryn reference case, 14SEP follow-up): a client
// asking "what was done for X" gets the answer grouped by project/work
// family -- deliverable count, current state, and (only when financials
// are on and real billing exists) what's been billed for it -- instead
// of a flat video grid she'd have to eyeball herself. Still the ONE
// search entry point (Dave Monday Release §3/§4) -- same input, same
// already-client-safe `videos` array, same searchClientDashboardVideos
// function. `billing` is the exact object getClientBillingSummary
// already produces server-side: when portalCanSeeFinancials is off it
// arrives with byProject: [] and visibility: "hidden", so there is
// nothing for this component to additionally hide -- no real figure is
// ever serialized to a client whose financials are off, by construction
// upstream, not by a client-side check here.
export function DashboardSearch({
  videos,
  billing,
  allowPriority = true,
}: {
  videos: ClientDashboardVideoCard[];
  billing: ClientBillingSummary;
  allowPriority?: boolean;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const billingByProject = useMemo(
    () => indexClientBillingByProject(billing.byProject),
    [billing.byProject],
  );
  const groups = useMemo(() => {
    if (!trimmed) return [];
    const matches = searchClientDashboardVideos(videos, trimmed);
    return groupClientWorkByProject(matches, billingByProject);
  }, [videos, trimmed, billingByProject]);
  const totalResults = groups.reduce((sum, group) => sum + group.videos.length, 0);

  return (
    <section aria-labelledby="dashboard-search-title">
      <h2 id="dashboard-search-title" className="sr-only">
        Search your work
      </h2>
      <label className="relative block">
        <span className="sr-only">Search by title, project, or batch</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your work — a project, a person, a batch..."
          autoComplete="off"
          className="min-h-12 w-full rounded-full border border-zinc-800 bg-zinc-900 px-5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </label>

      {trimmed && (
        <div className="mt-3 space-y-5">
          {groups.length > 0 ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {totalResults} match{totalResults === 1 ? "" : "es"} in {groups.length} project{groups.length === 1 ? "" : "s"}
              </p>
              {groups.map((group) => (
                <WorkGroup
                  key={group.projectId}
                  group={group}
                  allowPriority={allowPriority}
                  billingVisible={billing.visibility === "visible"}
                />
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-sm text-zinc-600">
              No work matches &ldquo;{trimmed}&rdquo;.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function stateSummary(group: ClientWorkGroup): string {
  const parts: string[] = [];
  if (group.deliveredCount > 0) parts.push(`${group.deliveredCount} delivered`);
  if (group.readyForReviewCount > 0) parts.push(`${group.readyForReviewCount} in review`);
  if (group.inProgressCount > 0) parts.push(`${group.inProgressCount} in production`);
  if (group.plannedCount > 0) parts.push(`${group.plannedCount} planned`);
  return parts.join(" · ") || `${group.videos.length} item${group.videos.length === 1 ? "" : "s"}`;
}

function WorkGroup({
  group,
  allowPriority,
  billingVisible,
}: {
  group: ClientWorkGroup;
  allowPriority: boolean;
  billingVisible: boolean;
}) {
  return (
    <div className="pixel-frame pixel-frame-client rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{group.projectName}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {group.videos.length} deliverable{group.videos.length === 1 ? "" : "s"} · {stateSummary(group)}
          </p>
        </div>
        {group.billed.length > 0 ? (
          <div className="text-right">
            {group.billed.map((row) => (
              <p key={row.currency} className="text-sm font-black text-emerald-300">
                Billed {formatCurrency(row.amount, row.currency)}
              </p>
            ))}
          </div>
        ) : (
          billingVisible && (
            <p className="text-xs text-zinc-600">No billing recorded for this work yet</p>
          )
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {group.videos.map((video) => (
          <VideoCard key={video.id} video={video} allowPriority={allowPriority} />
        ))}
      </div>
    </div>
  );
}
