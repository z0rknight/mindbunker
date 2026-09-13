"use client";

import { useState } from "react";
import { PixelIcon } from "@/components/ui/PixelVisuals";

export function ProjectCover({ url, projectName, clientName }: {
  url: string | null;
  projectName: string;
  clientName: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-cyan-950 via-zinc-900 to-violet-950">
      {!showImage && (
        <div className="absolute inset-0 flex flex-col justify-between p-4" aria-hidden="true">
          <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/70">
            <PixelIcon name="project" className="h-3.5 w-3.5" /> RMEDIA / PROJECT
          </span>
          <div>
            <p className="line-clamp-2 text-lg font-black leading-tight text-white/90">{projectName}</p>
            <p className="mt-1 truncate text-xs font-bold uppercase tracking-wide text-zinc-500">{clientName}</p>
          </div>
        </div>
      )}
      {showImage && (
        // Existing cover URLs may be private application routes or external
        // HTTPS images, so Next/Image cannot safely assume one optimizer host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
    </div>
  );
}
