"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSourceMediaReference, deleteSourceMediaReference } from "@/modules/assets/actions";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

type SourceMediaRow = {
  id: number;
  approxSizeLabel: string | null;
  sourceUrl: string | null;
  location: string | null;
  profile: string | null;
  notes: string | null;
};

// §4: reference substantial source media (e.g. ~800GB of LOG originals)
// without hosting it. approxSizeLabel stays free text everywhere -- an
// estimate must not silently become false precision.
export function SourceMediaPanel({
  projectId,
  references,
}: {
  projectId: number;
  references: SourceMediaRow[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [approxSizeLabel, setApproxSizeLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [location, setLocation] = useState("");
  const [profile, setProfile] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSourceMediaReference({
        projectId,
        approxSizeLabel: approxSizeLabel || null,
        sourceUrl: sourceUrl || null,
        location: location || null,
        profile: profile || null,
        notes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setApproxSizeLabel("");
      setSourceUrl("");
      setLocation("");
      setProfile("");
      setNotes("");
      router.refresh();
    });
  }

  function remove(id: number) {
    // Sprint 3 P2: this is the operator's record of where large source
    // footage actually lives -- every other delete/revoke action in the
    // app confirms first (ProjectWorkspaceControls, AssetsPanel,
    // ClientActions, etc.); this one didn't.
    if (!confirm("Remove this source media reference? This does not delete the actual footage, only this record of where it is.")) {
      return;
    }
    startTransition(async () => {
      await deleteSourceMediaReference(id, projectId);
      router.refresh();
    });
  }

  return (
    <section className="mb-7" aria-labelledby="project-source-media">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">References only — not hosted</p>
          <h2 id="project-source-media" className="mt-1 text-xl font-black text-white">
            Source Media <span className="font-mono text-sm text-zinc-600">{references.length}</span>
          </h2>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-sm font-black text-zinc-300 transition">
          + Add Reference
        </button>
      </div>

      {references.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-500">No source media referenced yet — e.g. ~800 GB / LOG / NAS.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="min-w-0">
                <p className="font-bold text-white text-sm">
                  {r.approxSizeLabel ?? "Unknown size"}{r.profile ? ` · ${r.profile}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">{r.location ?? "Location unknown"}</p>
                {r.sourceUrl && (
                  <span className="mt-1 flex items-center gap-2">
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block truncate max-w-full text-xs text-zinc-400 hover:text-white underline"
                    >
                      {r.sourceUrl}
                    </a>
                    <CopyLinkButton url={r.sourceUrl} className="shrink-0 text-xs text-zinc-600 hover:text-white transition" />
                  </span>
                )}
                {r.notes && <p className="mt-1 text-xs text-zinc-500">{r.notes}</p>}
              </div>
              <button onClick={() => remove(r.id)} disabled={isPending} className="shrink-0 text-xs text-zinc-600 hover:text-red-400 transition">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">Add Source Media Reference</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Approx size</label>
                <input type="text" value={approxSizeLabel} onChange={(e) => setApproxSizeLabel(e.target.value)} placeholder="~800 GB" autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Source URL (optional — the client&apos;s own link, e.g. their Dropbox share)</label>
                <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="NAS / Dropbox" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Profile</label>
                  <input type="text" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="LOG" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="downloaded via shell to RMEDIA NAS" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending} className="w-full rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Saving…" : "Add Reference"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
