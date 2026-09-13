"use client";

import { useMemo, useState } from "react";
import {
  searchClientDashboardVideos,
  type ClientDashboardVideoCard,
} from "@/modules/client-portal/core";
import { VideoCard } from "./VideoCard";

// Dave Monday Release §3/§4: direct operator feedback was "the search
// engine is too low" -- a client with multiple batches, orientations, and
// old deliveries needs to find something without scrolling past the whole
// catalogue first. This is the ONE search entry point for the dashboard
// (VideoGallery below no longer has its own -- see that file); it reuses
// the exact same pure searchClientDashboardVideos function and the same
// already-client-safe `videos` list every other section on this page
// already receives, so there is nothing new to leak: no new query, no new
// data source, just this function called from higher up the page.
export function DashboardSearch({
  videos,
  allowPriority = true,
}: {
  videos: ClientDashboardVideoCard[];
  allowPriority?: boolean;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? searchClientDashboardVideos(videos, trimmed) : []),
    [videos, trimmed],
  );

  return (
    <section aria-labelledby="dashboard-search-title">
      <h2 id="dashboard-search-title" className="sr-only">
        Search your deliveries
      </h2>
      <label className="relative block">
        <span className="sr-only">Search by title, project, or batch</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search deliveries by title, project, or batch..."
          autoComplete="off"
          className="min-h-12 w-full rounded-full border border-zinc-800 bg-zinc-900 px-5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </label>

      {trimmed && (
        <div className="mt-3">
          {results.length > 0 ? (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {results.length} match{results.length === 1 ? "" : "es"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((video) => (
                  <VideoCard key={video.id} video={video} allowPriority={allowPriority} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-sm text-zinc-600">
              No deliveries match &ldquo;{trimmed}&rdquo;.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
