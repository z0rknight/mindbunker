"use client";

import { useState } from "react";
import Image from "next/image";

// Client Portal Reality round: same load-error fallback as the
// authenticated dashboard's CoverImage (client/dashboard/CoverImage.tsx) --
// duplicated locally rather than shared, matching this codebase's existing
// convention of colocated per-route components.
export function CoverImage({ src, alt = "" }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-700">
        <span className="text-lg" aria-hidden="true">🎬</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 50vw"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
