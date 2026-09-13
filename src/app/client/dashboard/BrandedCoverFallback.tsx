"use client";

import { useState } from "react";
import Image from "next/image";

// Dave Monday Release §7: tier 4 of the cover fallback chain -- rendered
// only when a video has no real cover at all (video/project/client-
// default all null) but the client does have a logo/avatar on file.
// Deliberately NOT the same treatment as CoverImage (object-cover fill):
// a square avatar stretched or cropped to fill a 16:9/9:16 frame looks
// broken and cuts off faces/logos. This centers the image, contained
// (never cropped), on an intentional dark branded background instead --
// reads as "this is whose work it is," not as a bad video thumbnail.
export function BrandedCoverFallback({ logoUrl }: { logoUrl: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-700">
        <span className="text-2xl" aria-hidden="true">🎬</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">No preview yet</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950/40 via-zinc-950 to-zinc-950">
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 shadow-lg sm:h-20 sm:w-20">
        <Image
          src={logoUrl}
          alt=""
          fill
          unoptimized
          sizes="80px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
