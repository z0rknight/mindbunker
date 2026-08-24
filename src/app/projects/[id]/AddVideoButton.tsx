"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVideoLogsBulk } from "@/modules/productivity/actions";
import { VIDEO_STATUSES, VIDEO_STATUS_LABELS, type VideoStatus } from "@/modules/productivity/config";
import { todayISO } from "@/utils/date";

// "MindBunker — Final Single Video Ingest Gap" round: a real workflow gap
// found in human QA -- registering ONE already-existing/historical video
// (e.g. "Full Cut", already DONE, already has a delivery link) had no
// honest entry point. Plan Video is semantically wrong (it means future
// work, always PLANNED). Add Multiple Videos works but is unnecessary
// friction for one row (sequence-generator controls, batch-preview UI,
// etc. that don't apply to a single record).
//
// This is NOT a second create implementation: it calls the exact same
// createVideoLogsBulk(projectId, rows, batchLabel) the historical bulk-ingest
// flow already uses, with a one-item rows array. Same validation, same
// status vocabulary, same date/URL handling, same project/client ownership
// check, same all-or-nothing insert path. The only thing this component
// owns is a smaller, single-row form.
export function AddVideoButton({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<VideoStatus>("PLANNED");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [batchLabel, setBatchLabel] = useState("");

  function openModal() {
    setTitle("");
    setDate(todayISO());
    setStatus("PLANNED");
    setDeliveryUrl("");
    setReviewUrl("");
    setPublishedUrl("");
    setBatchLabel("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Name this video.");
      return;
    }
    startTransition(async () => {
      const result = await createVideoLogsBulk(
        projectId,
        [
          {
            title: title.trim(),
            date: date || null,
            status,
            deliveryUrl: deliveryUrl.trim() || null,
            reviewUrl: reviewUrl.trim() || null,
            publishedUrl: publishedUrl.trim() || null,
          },
        ],
        batchLabel.trim() || null,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // No navigation -- this modal already lives on the Project workspace,
      // so staying put and refreshing is what "return to the same Project"
      // means here (mirrors BulkAddVideosButton's own close behavior).
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 hover:bg-emerald-900/40 px-4 py-2.5 text-sm font-black text-emerald-300 transition"
      >
        + Add Video
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Add Video</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <p className="text-zinc-500 text-xs mb-4">
              Register one video that already exists — already in progress, already delivered, whatever its real state is. For future work, use Plan Video instead.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="addVideoTitle" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Title</label>
                <input
                  id="addVideoTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Full Cut"
                  autoFocus
                  maxLength={180}
                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="addVideoDate" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Date</label>
                  <input
                    id="addVideoDate"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="addVideoStatus" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Status</label>
                  <select
                    id="addVideoStatus"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VideoStatus)}
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {VIDEO_STATUSES.map((s) => (
                      <option key={s} value={s}>{VIDEO_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="addVideoDeliveryUrl" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Delivery / watch URL <span className="font-normal normal-case text-zinc-600">optional</span></label>
                <input
                  id="addVideoDeliveryUrl"
                  type="url"
                  value={deliveryUrl}
                  onChange={(e) => setDeliveryUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="addVideoReviewUrl" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                    Review URL <span className="font-normal normal-case text-zinc-600">{status === "READY_FOR_REVIEW" ? "required" : "optional"}</span>
                  </label>
                  <input
                    id="addVideoReviewUrl"
                    type="url"
                    value={reviewUrl}
                    onChange={(e) => setReviewUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="addVideoPublishedUrl" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Published URL <span className="font-normal normal-case text-zinc-600">optional</span></label>
                  <input
                    id="addVideoPublishedUrl"
                    type="url"
                    value={publishedUrl}
                    onChange={(e) => setPublishedUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="addVideoBatchLabel" className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Batch label <span className="font-normal normal-case text-zinc-600">optional</span></label>
                <input
                  id="addVideoBatchLabel"
                  type="text"
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                  placeholder="Content Waterfall — Batch 1"
                  maxLength={160}
                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Adding…" : "Add video"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
