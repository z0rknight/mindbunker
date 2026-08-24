"use client";

import { useEffect, useState } from "react";
import { getSourceMediaForProject } from "@/modules/assets/actions";

type SourceMediaReferenceRow = {
  id: number;
  projectId: number;
  approxSizeLabel: string | null;
  sourceUrl: string | null;
  location: string | null;
  profile: string | null;
  notes: string | null;
  createdAt: Date | null;
};

// Brief C ("Final Local Ingest / Live Readiness") §10: Source Media
// References live at the Project level, but an operator working inside a
// Video couldn't see them without leaving to the Project workspace. This
// is a small READ-ONLY panel -- no duplication/copy into the Video, no
// desktop-app deep linking (documented as future work in the round
// report). Fetches lazily only when the Video workspace is actually open
// and the video has a project, via the exact same server action the
// Project workspace's own SourceMediaPanel calls.
export function ProjectReferencesPanel({
  projectId,
  active,
}: {
  projectId: number;
  active: boolean;
}) {
  const [references, setReferences] = useState<SourceMediaReferenceRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getSourceMediaForProject(projectId)
      .then((rows) => {
        if (!cancelled) setReferences(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  if (!active) return null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
        Project source references
      </p>
      {error && <p className="text-xs text-zinc-600">Could not load source references.</p>}
      {!error && references === null && <p className="text-xs text-zinc-600">Loading…</p>}
      {references !== null && references.length === 0 && (
        <p className="text-xs text-zinc-600">No source media references recorded for this project yet.</p>
      )}
      {references !== null && references.length > 0 && (
        <ul className="space-y-2">
          {references.map((ref) => (
            <li key={ref.id} className="rounded-xl bg-zinc-900/60 p-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {ref.location && <span className="font-bold text-zinc-300">{ref.location}</span>}
                {ref.profile && (
                  <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                    {ref.profile}
                  </span>
                )}
                {ref.approxSizeLabel && <span className="text-zinc-600">{ref.approxSizeLabel}</span>}
              </div>
              {ref.sourceUrl && (
                <a
                  href={ref.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block break-all text-cyan-400 hover:text-cyan-300"
                >
                  {ref.sourceUrl}
                </a>
              )}
              {ref.notes && <p className="mt-1 text-zinc-500">{ref.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
