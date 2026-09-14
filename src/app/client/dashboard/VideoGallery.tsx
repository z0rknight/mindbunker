"use client";

import { useMemo, useState } from "react";
import {
  VIDEO_CONTENT_TYPE_LABELS,
  VIDEO_CONTENT_TYPES,
  type VideoContentType,
} from "@/modules/productivity/config";
import {
  filterClientDashboardVideos,
  type ClientDashboardVideoCard,
} from "@/modules/client-portal/core";
import { VideoCard } from "./VideoCard";

type FilterValue = "all" | VideoContentType;

// Dave Monday Release: this gallery's own free-text search was removed --
// DashboardSearch (rendered near the top of the page) is now the one
// search entry point, per direct operator feedback ("the search engine is
// too low"). This component keeps the content-type filter chips (a
// different, complementary job: browsing everything of one kind, not
// finding one specific thing).
export function VideoGallery({
  videos,
  allowReview = true,
  allowPriority = true,
}: {
  videos: ClientDashboardVideoCard[];
  allowReview?: boolean;
  allowPriority?: boolean;
}) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const filteredVideos = useMemo(
    () => filterClientDashboardVideos(videos, filter),
    [filter, videos],
  );

  return (
    <section aria-labelledby="video-library-title">
      <div className="mb-3 flex flex-col gap-3">
        <div>
          <h2 id="video-library-title" className="text-sm font-black uppercase tracking-widest text-zinc-400">
            Video library
          </h2>
          <p className="mt-1 text-xs text-zinc-600">Browse everything, or filter by type.</p>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Filter videos by content type">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
          {VIDEO_CONTENT_TYPES.map((contentType) => (
            <FilterButton
              key={contentType}
              active={filter === contentType}
              onClick={() => setFilter(contentType)}
            >
              {VIDEO_CONTENT_TYPE_LABELS[contentType]}
            </FilterButton>
          ))}
        </div>
      </div>

      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              showReviewActions={allowReview && video.status === "READY_FOR_REVIEW"}
              allowPriority={allowPriority}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-7 text-center text-sm text-zinc-600">
          No videos in this category yet.
        </div>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-black transition ${
        active
          ? "border-violet-400 bg-violet-500 text-white"
          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
