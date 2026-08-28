"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAsset, updateAsset, deleteAsset } from "@/modules/assets/actions";
import { ASSET_TYPES, ASSET_TYPE_LABELS, ASSET_STATUSES, ASSET_STATUS_LABELS, type AssetType, type AssetStatus } from "@/modules/assets/config";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

type AssetRow = {
  id: number;
  name: string;
  type: AssetType;
  status: AssetStatus;
  videoId: number | null;
  reviewUrl: string | null;
  deliveryUrl: string | null;
  publishedUrl: string | null;
  notes: string | null;
};

type FormState = {
  name: string;
  type: AssetType;
  status: AssetStatus;
  videoId: string;
  // Taryn August Ingest Readiness §7/§8: assets already carry
  // reviewUrl/deliveryUrl/publishedUrl in the schema (mirroring
  // video_logs), but exposing three near-duplicate link inputs on this
  // lightweight panel would work against "boring reliable data-entry
  // UX" -- for an Asset (unlike a Video) the distinction rarely matters
  // day to day. This panel exposes ONE provider-agnostic "Link" field,
  // stored as deliveryUrl -- reviewUrl/publishedUrl stay in the data
  // model for a future surface that needs them, unused here.
  url: string;
  notes: string;
};

function emptyForm(): FormState {
  return { name: "", type: "FINAL_DELIVERABLE", status: "DRAFT", videoId: "", url: "", notes: "" };
}

function fromAsset(a: AssetRow): FormState {
  return {
    name: a.name,
    type: a.type,
    status: a.status,
    videoId: a.videoId ? String(a.videoId) : "",
    url: a.deliveryUrl ?? "",
    notes: a.notes ?? "",
  };
}

// Monday Real-Operation Pre-Freeze §3: VIDEO != DELIVERABLE != ASSET. This
// panel is the minimum surface to record the Look Studios shape (multiple
// outputs of different kinds per project, most with no video relation at
// all) without building a DAM. Taryn August Ingest Readiness §7/§8 added
// the Link field and full edit capability (previously create+delete
// only, which meant a wrong name/type/link could only be fixed by
// deleting and recreating the asset -- unacceptable for real ingest).
export function AssetsPanel({
  projectId,
  videos,
  assets,
}: {
  projectId: number;
  videos: Array<{ id: number; title: string | null }>;
  assets: AssetRow[];
}) {
  const [open, setOpen] = useState(false);
  // The full original row, not just its id -- editing must carry forward
  // reviewUrl/publishedUrl/thumbnailUrl/deliveredAt/source untouched
  // (this lightweight form only edits name/type/status/video/link/notes;
  // omitting a field from the update payload would otherwise be
  // interpreted as "clear it").
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm());
    setError(null);
    setEditingAsset(null);
    setOpen(true);
  }

  function openEdit(a: AssetRow) {
    setForm(fromAsset(a));
    setError(null);
    setEditingAsset(a);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        projectId,
        videoId: form.videoId ? Number(form.videoId) : null,
        name: form.name,
        type: form.type,
        status: form.status,
        deliveryUrl: form.url || null,
        notes: form.notes || null,
        reviewUrl: editingAsset?.reviewUrl ?? null,
        publishedUrl: editingAsset?.publishedUrl ?? null,
      };
      const result = editingAsset
        ? await updateAsset(editingAsset.id, payload)
        : await createAsset(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setEditingAsset(null);
      setForm(emptyForm());
      router.refresh();
    });
  }

  function remove(id: number) {
    if (!confirm("Remove this asset?")) return;
    startTransition(async () => {
      await deleteAsset(id, projectId);
      router.refresh();
    });
  }

  return (
    <section className="mb-7" aria-labelledby="project-assets">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Outputs</p>
          <h2 id="project-assets" className="mt-1 text-xl font-black text-white">
            Assets <span className="font-mono text-sm text-zinc-600">{assets.length}</span>
          </h2>
        </div>
        <button
          onClick={openCreate}
          className="rounded-xl bg-amber-700 hover:bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition"
        >
          + Add Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-500">
            No assets yet — final deliverables, review cuts, utility assets, source prep, AI inputs, extras.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-white text-sm">{a.name}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {ASSET_TYPE_LABELS[a.type]} · {ASSET_STATUS_LABELS[a.status]}
                  {a.videoId ? " · linked to a video" : " · project-level"}
                </p>
                {a.deliveryUrl && (
                  <span className="mt-1 flex items-center gap-2">
                    <a
                      href={a.deliveryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block truncate max-w-full text-xs text-amber-400 hover:text-amber-300 underline"
                    >
                      {a.deliveryUrl}
                    </a>
                    <CopyLinkButton url={a.deliveryUrl} className="shrink-0 text-xs text-zinc-600 hover:text-amber-300 transition" />
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => openEdit(a)} disabled={isPending} className="text-xs text-zinc-500 hover:text-white transition">
                  Edit
                </button>
                <button onClick={() => remove(a.id)} disabled={isPending} className="text-xs text-zinc-600 hover:text-red-400 transition">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">{editingAsset ? "Edit Asset" : "Add Asset"}</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Taryn's Cut 1.0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AssetType }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AssetStatus }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Video (optional — asset can exist at project level)</label>
                <select value={form.videoId} onChange={(e) => setForm((f) => ({ ...f, videoId: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                  <option value="">Project-level (no video)</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>{v.title ?? `Video ${v.id}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Link (optional — Drive, YouTube, Frame.io, Dropbox, any HTTPS URL)</label>
                <input type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" disabled={isPending} className="w-full rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60">
                {isPending ? "Saving…" : editingAsset ? "Save changes" : "Add Asset"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
