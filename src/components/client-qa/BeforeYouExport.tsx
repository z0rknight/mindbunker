"use client";

import { useEffect, useState } from "react";
import { getPreExportContextForVideo } from "@/modules/client-qa/actions";
import { PROTECTED_TERM_KIND_LABELS } from "@/modules/client-qa/config";
import { GENERIC_EXPORT_CHECKS } from "@/modules/client-qa/core";
import type { PreExportContext } from "@/modules/client-qa/data";
import {
  ProductionMemoryDetails,
  ProductionMemoryStatusBadge,
} from "@/components/production-memory/ProductionMemoryDetails";

// "Before you export": a compact, READ-ONLY reminder in the Video Workspace,
// next to the lifecycle controls. Deliberately:
//  - no checkboxes, no completion state, no writes of any kind
//  - never disables or gates a status button (it does not receive or call the
//    status transition; READY_FOR_REVIEW / DONE are untouched)
//  - the two static generic checks render immediately and are all a client
//    with no data gets; client data (terms, reminders, production formats) is
//    fetched for THIS video's own client only and is ignored if it arrives for
//    a different video.
// It does not know which format (if any) a video "is using" -- no such
// association exists -- so production formats are an optional client-level
// reference, not an inference.
export function BeforeYouExport({ videoId, active }: { videoId: number; active: boolean }) {
  const [loaded, setLoaded] = useState<{ videoId: number; context: PreExportContext } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void getPreExportContextForVideo(videoId).then((result) => {
      if (!cancelled && result.success) setLoaded({ videoId, context: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [active, videoId]);

  if (!active) return null;

  const view = loaded && loaded.videoId === videoId ? loaded.context.view : null;
  const clientName = loaded && loaded.videoId === videoId ? loaded.context.clientName : null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4" data-testid="before-you-export">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Before you export</p>

      {view && view.terms.length > 0 && (
        <div className="mb-3" data-testid="pre-export-terms">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">Protected terms</p>
          <div className="flex flex-wrap gap-1.5">
            {view.terms.map((term) => (
              <span
                key={term.id}
                title={[term.kind ? PROTECTED_TERM_KIND_LABELS[term.kind] : null, term.note].filter(Boolean).join(" · ") || undefined}
                className="rounded-md border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 text-xs font-bold text-cyan-200"
              >
                {term.term}
              </span>
            ))}
          </div>
        </div>
      )}

      {view && view.reminders.length > 0 && (
        <div className="mb-3" data-testid="pre-export-reminders">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">
            {clientName ? `${clientName} reminders` : "Client reminders"}
          </p>
          <ul className="space-y-1">
            {view.reminders.map((reminder) => (
              <li key={reminder.id} className="text-xs leading-5 text-zinc-300">
                • {reminder.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-1" data-testid="pre-export-generic">
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">Quick check</p>
        <ul className="space-y-1">
          {GENERIC_EXPORT_CHECKS.map((check) => (
            <li key={check.label} className="text-xs leading-5 text-zinc-400">
              <span className="font-bold text-zinc-300">{check.label}.</span> {check.text}
            </li>
          ))}
        </ul>
      </div>

      {view && view.memories.length > 0 && (
        <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40" data-testid="pre-export-memory">
          <summary className="cursor-pointer px-3 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
            Production memory{clientName ? ` · ${clientName}` : ""} ({view.memories.length})
          </summary>
          <div className="space-y-2 border-t border-zinc-800 p-2">
            {view.memories.map((memory) => (
              <details key={memory.id} className="rounded-md border border-zinc-800 bg-zinc-950/60">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-zinc-100">
                  {memory.name}
                  <ProductionMemoryStatusBadge status={memory.status} />
                </summary>
                <div className="border-t border-zinc-800 p-2.5">
                  <ProductionMemoryDetails memory={memory} />
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
