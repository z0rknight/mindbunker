"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getVideoProductionContext } from "@/modules/production-context/actions";
import { batchLinkFromVideo } from "@/modules/production-context/core";
import type { VideoProductionContext as VideoContext } from "@/modules/production-context/data";
import { videoWorkspaceHref } from "@/modules/productivity/core";
import { ProductionContextBlock } from "./ProductionContextBlock";

// Video Workspace: the video's own review/delivery facts plus the context it
// INHERITS (batch notes, project notes, project source, formats), read in
// place. Includes the containment link up to the video's Production Order,
// which returns to THIS video (carrying the video's own origin), so the
// hierarchy link and the navigation origin stay separate facts. Read-only.
export function VideoProductionContext({
  videoId,
  active,
  returnTo,
}: {
  videoId: number;
  active: boolean;
  returnTo?: string;
}) {
  const [loaded, setLoaded] = useState<{ videoId: number; data: VideoContext } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void getVideoProductionContext(videoId).then((result) => {
      if (!cancelled && result.success) setLoaded({ videoId, data: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [active, videoId]);

  if (!active || !loaded || loaded.videoId !== videoId) return null;
  const { context, batch } = loaded.data;
  if (context.rows.length === 0 && !batch) return null;

  return (
    <div className="space-y-2" data-testid="video-production-context">
      <ProductionContextBlock context={context} />
      {batch && (
        <Link
          href={batchLinkFromVideo(batch.id, videoWorkspaceHref(videoId, returnTo))}
          className="inline-block text-[11px] font-bold text-zinc-500 hover:text-cyan-300"
          data-testid="video-to-batch-link"
        >
          Part of batch: {batch.label} →
        </Link>
      )}
    </div>
  );
}
