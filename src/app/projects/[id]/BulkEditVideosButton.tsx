"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateVideoLogsBulk,
  type UpdateVideoLogsBulkPatch,
} from "@/modules/productivity/actions";
import { VIDEO_STATUSES, VIDEO_STATUS_LABELS, type VideoStatus } from "@/modules/productivity/config";

type FieldState<T extends string> =
  | { enabled: false }
  | { enabled: true; value: T }
  | { enabled: true; clear: true };

function fieldOff<T extends string>(): FieldState<T> {
  return { enabled: false };
}

// Brief C ("Final Local Ingest / Live Readiness") §7: Project workspace
// bulk-edit for already-created videos -- select rows, "Edit selected".
// Every field below is OFF (untouched) by default; the operator must
// explicitly turn a field on before it is included in the patch sent to
// updateVideoLogsBulk. "NEVER overwrite a field unless the operator
// explicitly chose to change it" / "a blank bulk-edit field must mean
// leave unchanged, not erase" -- enforced here by never sending a field the
// operator didn't touch, and by requiring the separate "Clear" control for
// the two genuinely nullable link fields rather than inferring clear from
// an empty text box.
export function BulkEditVideosButton({
  projectId,
  selectedIds,
  onDone,
}: {
  projectId: number;
  selectedIds: number[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [status, setStatus] = useState<FieldState<VideoStatus>>(fieldOff());
  const [date, setDate] = useState<FieldState<string>>(fieldOff());
  const [deliveryUrl, setDeliveryUrl] = useState<FieldState<string> | { enabled: true; clear: true }>(fieldOff());
  const [reviewUrl, setReviewUrl] = useState<FieldState<string> | { enabled: true; clear: true }>(fieldOff());
  const [batchLabel, setBatchLabel] = useState<FieldState<string> | { enabled: true; clear: true }>(fieldOff());

  function openModal() {
    setStatus(fieldOff());
    setDate(fieldOff());
    setDeliveryUrl(fieldOff());
    setReviewUrl(fieldOff());
    setBatchLabel(fieldOff());
    setError("");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const patch: UpdateVideoLogsBulkPatch = {};
    if (status.enabled && "value" in status) patch.status = { value: status.value };
    if (date.enabled && "value" in date) patch.date = { value: date.value };
    if (deliveryUrl.enabled) {
      patch.deliveryUrl = "clear" in deliveryUrl ? { clear: true } : { value: deliveryUrl.value };
    }
    if (reviewUrl.enabled) {
      patch.reviewUrl = "clear" in reviewUrl ? { clear: true } : { value: reviewUrl.value };
    }
    if (batchLabel.enabled) {
      patch.batchLabel = "clear" in batchLabel ? { clear: true } : { value: batchLabel.value };
    }

    if (Object.keys(patch).length === 0) {
      setError("Turn on at least one field to change before saving.");
      return;
    }

    startTransition(async () => {
      const result = await updateVideoLogsBulk(selectedIds, patch);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDone();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={selectedIds.length === 0}
        className="rounded-xl border border-cyan-700/50 bg-cyan-950/30 hover:bg-cyan-900/40 px-4 py-2.5 text-sm font-black text-cyan-300 transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        Edit selected ({selectedIds.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Edit selected videos</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none" aria-label="Close">×</button>
            </div>
            <p className="mb-4 text-xs font-bold text-amber-300">
              {selectedIds.length} video{selectedIds.length === 1 ? "" : "s"} will be affected. Only fields you turn on below are changed — everything else stays exactly as it is.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <input type="checkbox" checked={status.enabled} onChange={(e) => setStatus(e.target.checked ? { enabled: true, value: "PLANNED" } : fieldOff())} className="h-4 w-4" />
                  Change status
                </label>
                {status.enabled && "value" in status && (
                  <select
                    value={status.value}
                    onChange={(e) => setStatus({ enabled: true, value: e.target.value as VideoStatus })}
                    className="mt-2 w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {VIDEO_STATUSES.map((s) => (
                      <option key={s} value={s}>{VIDEO_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <input type="checkbox" checked={date.enabled} onChange={(e) => setDate(e.target.checked ? { enabled: true, value: "" } : fieldOff())} className="h-4 w-4" />
                  Change date
                </label>
                {date.enabled && "value" in date && (
                  <input
                    type="date"
                    value={date.value}
                    onChange={(e) => setDate({ enabled: true, value: e.target.value })}
                    className="mt-2 w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>

              <UrlField label="Delivery / watch URL" state={deliveryUrl} setState={setDeliveryUrl} />
              <UrlField label="Review URL" state={reviewUrl} setState={setReviewUrl} />
              <UrlField label="Batch label" state={batchLabel} setState={setBatchLabel} isText />

              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving…" : `Save changes to ${selectedIds.length} video${selectedIds.length === 1 ? "" : "s"}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function UrlField({
  label,
  state,
  setState,
  isText = false,
}: {
  label: string;
  state: FieldState<string>;
  setState: (next: FieldState<string>) => void;
  isText?: boolean;
}) {
  const value = state.enabled && "value" in state ? state.value : "";
  const clearing = state.enabled && "clear" in state;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
        <input type="checkbox" checked={state.enabled} onChange={(e) => setState(e.target.checked ? { enabled: true, value: "" } : fieldOff())} className="h-4 w-4" />
        Change {label.toLowerCase()}
      </label>
      {state.enabled && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type={isText ? "text" : "url"}
            value={value}
            disabled={clearing}
            onChange={(e) => setState({ enabled: true, value: e.target.value })}
            placeholder={isText ? "" : "https://…"}
            maxLength={isText ? 160 : 2048}
            className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-40"
          />
          <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-red-300">
            <input
              type="checkbox"
              checked={clearing}
              onChange={(e) => setState(e.target.checked ? { enabled: true, clear: true } : { enabled: true, value: "" })}
              className="h-3.5 w-3.5"
            />
            Clear
          </label>
        </div>
      )}
    </div>
  );
}
