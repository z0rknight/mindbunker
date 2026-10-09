"use client";

import { clampPlaybackPosition } from "@/modules/quality-evidence/core";
import type { QualityEvidenceView } from "@/modules/quality-evidence/actions";
import { useRef, useState } from "react";

export function ImageBeforeAfter({ evidence }: { evidence: QualityEvidenceView }) {
  const [position, setPosition] = useState(50);
  if (!evidence.beforeUrl || !evidence.afterUrl) {
    return <IncompleteEvidence evidence={evidence} />;
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
      {/* Authenticated application media routes are intentionally dynamic and cannot use Next image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={evidence.beforeUrl} alt={`${evidence.label} before`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={evidence.afterUrl} alt={`${evidence.label} after`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">Before</span>
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black">After</span>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]" style={{ left: `${position}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/75 text-xs font-black text-white">↔</span>
      </div>
      <input
        aria-label={`Compare before and after for ${evidence.label}`}
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-col-resize opacity-0"
      />
    </div>
  );
}

export function AudioBeforeAfter({ evidence }: { evidence: QualityEvidenceView }) {
  const [active, setActive] = useState<"before" | "after">("before");
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingRef = useRef<{ position: number; resume: boolean } | null>(null);
  if (!evidence.beforeUrl || !evidence.afterUrl) {
    return <IncompleteEvidence evidence={evidence} />;
  }
  const activeUrl = active === "before" ? evidence.beforeUrl : evidence.afterUrl;

  function switchTo(next: "before" | "after") {
    if (next === active) return;
    const audio = audioRef.current;
    pendingRef.current = audio
      ? { position: audio.currentTime, resume: !audio.paused }
      : { position: 0, resume: false };
    setActive(next);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={`${evidence.label} audio version`}>
        {(["before", "after"] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-pressed={active === side}
            onClick={() => switchTo(side)}
            className={`min-h-10 rounded-lg border px-3 text-xs font-black uppercase tracking-wider transition ${active === side ? "border-white bg-white text-black" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            {side}
          </button>
        ))}
      </div>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={activeUrl}
        className="mt-3 h-10 w-full"
        onLoadedMetadata={(event) => {
          const pending = pendingRef.current;
          if (!pending) return;
          const audio = event.currentTarget;
          audio.currentTime = clampPlaybackPosition(pending.position, audio.duration);
          pendingRef.current = null;
          if (pending.resume) void audio.play().catch(() => undefined);
        }}
      />
      <p className="mt-2 text-[10px] text-zinc-600">Switching preserves the current position when the media duration allows it.</p>
    </div>
  );
}

function IncompleteEvidence({ evidence }: { evidence: QualityEvidenceView }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-700/60 bg-amber-950/10 p-4 text-xs text-amber-200">
      Incomplete comparison · {evidence.beforeUrl ? "after" : "before"} reference missing. This evidence stays out of the client view.
    </div>
  );
}

export function QualityEvidenceItem({ evidence, internal = false }: { evidence: QualityEvidenceView; internal?: boolean }) {
  return (
    <article className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/35 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            {evidence.type === "IMAGE_COMPARISON" ? "Color / image" : "Audio finish"}
          </p>
          <h3 className="mt-1 text-sm font-black text-white">{evidence.label}</h3>
        </div>
        {internal && (
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${evidence.visibility === "CLIENT_SAFE" ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>
            {evidence.visibility === "CLIENT_SAFE" ? "Client safe" : "Internal only"}
          </span>
        )}
      </div>
      {evidence.type === "IMAGE_COMPARISON"
        ? <ImageBeforeAfter evidence={evidence} />
        : <AudioBeforeAfter evidence={evidence} />}
      {internal && (
        <p className="text-[10px] text-zinc-600">Provenance · {evidence.provenance}</p>
      )}
    </article>
  );
}
