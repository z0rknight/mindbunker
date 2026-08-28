"use client";

import { useState } from "react";
import Image from "next/image";

// Client Portal Reality round §K (historical friction sweep, item 3): a
// coverUrl that is well-formed but points at a dead/expired asset (a
// rotated signed URL, a deleted object) used to render as a broken image
// with zero fallback -- the client would just see a blank/broken box.
// Falls back to the same "No preview yet" placeholder VideoCard already
// shows when there's no coverUrl at all, so a stale link degrades to
// exactly the same honest empty state instead of a visibly broken page.
export function CoverImage({ src, alt = "" }: { src: string; alt?: string }) {
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
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 33vw"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
