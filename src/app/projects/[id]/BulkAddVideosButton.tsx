"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVideoLogsBulk } from "@/modules/productivity/actions";
import { VIDEO_STATUSES, VIDEO_STATUS_LABELS, type VideoStatus } from "@/modules/productivity/config";
import { todayISO } from "@/utils/date";

type Row = {
  key: number;
  title: string;
  date: string;
  status: VideoStatus | ""; // "" = inherit the batch default
  deliveryUrl: string;
  reviewUrl: string;
  publishedUrl: string;
  detailsOpen: boolean;
};

let nextKey = 1;
function emptyRow(): Row {
  return { key: nextKey++, title: "", date: "", status: "", deliveryUrl: "", reviewUrl: "", publishedUrl: "", detailsOpen: false };
}

const SEPARATOR_OPTIONS = ["_", " ", "-", "#"] as const;

// House Cleaning Wave 2 §15 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// this is now the ONE "Add Video" door on a Project -- it already handled
// 1-to-50 rows before this patch (manual mode's own remove-row control
// goes down to a single row), so the merge with the former single-video
// AddVideoButton only meant: rename the trigger/header copy to welcome
// one video just as naturally as fifty, and add the one field the
// single-video form had that this one didn't (Published URL, per row).
// Plan Video stays a separate, deliberately-smaller link below -- it
// means something different (future work, always PLANNED) from
// registering a video that already exists in some real state.
//
// Brief C ("Final Local Ingest / Live Readiness") §2/§3/§4/§5/§6: extends
// the Taryn August "Add Multiple Videos" repeatable-row create with
// everything real historical ingest needed and the previous round didn't
// have:
//   MODE A (manual rows) -- unchanged repeatable rows.
//   MODE B (generate sequence) -- prefix/quantity/start/separator produces
//     normal, still-editable rows; not a separate persistence path.
//   Explicit per-batch/per-row status -- historical ingest may create a
//     Video directly in a later canonical lifecycle stage (see
//     allowExplicitStatus in modules/productivity/core.ts). Every row still
//     carries a concrete status value (defaulting to the batch default,
//     itself defaulting to PLANNED) -- never silently inferred completion.
//   Links -- delivery/review URL per row, or one shared batch link applied
//     to every row's delivery URL at submit time (no new storage
//     abstraction: the existing deliveryUrl column, written to every row).
//   Batch label -- optional, inherited by every row in this submission.
export function BulkAddVideosButton({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "generate">("manual");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<VideoStatus>("PLANNED");
  const [linkMode, setLinkMode] = useState<"individual" | "shared">("individual");
  const [sharedUrl, setSharedUrl] = useState("");
  const [batchLabel, setBatchLabel] = useState("");

  // Mode B (generate sequence) controls
  const [genPrefix, setGenPrefix] = useState("");
  const [genQuantity, setGenQuantity] = useState(9);
  const [genStart, setGenStart] = useState(1);
  const [genSeparator, setGenSeparator] = useState<string>("_");
  const [genZeroPad, setGenZeroPad] = useState(false);

  function openModal() {
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setMode("manual");
    setDefaultStatus("PLANNED");
    setLinkMode("individual");
    setSharedUrl("");
    setBatchLabel("");
    setError(null);
    setOpen(true);
  }

  function updateRow(key: number, field: "title" | "date" | "status" | "deliveryUrl" | "reviewUrl" | "publishedUrl", value: string) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function toggleDetails(key: number) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, detailsOpen: !r.detailsOpen } : r)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((r) => r.key !== key)));
  }

  const generatedNames = useMemo(() => {
    const quantity = Math.max(0, Math.min(50, Math.floor(genQuantity) || 0));
    const start = Math.floor(genStart) || 1;
    const prefix = genPrefix.trim();
    if (!prefix || quantity === 0) return [];
    const end = start + quantity - 1;
    const width = String(end).length;
    return Array.from({ length: quantity }, (_, i) => {
      const n = start + i;
      const numberPart = genZeroPad ? String(n).padStart(width, "0") : String(n);
      return `${prefix}${genSeparator}${numberPart}`;
    });
  }, [genPrefix, genQuantity, genStart, genSeparator, genZeroPad]);

  function generateRows() {
    if (generatedNames.length === 0) {
      setError("Enter a prefix and quantity to generate rows.");
      return;
    }
    setError(null);
    setRows(generatedNames.map((title) => ({ ...emptyRow(), title })));
    setMode("manual"); // generated rows become normal editable rows immediately
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nonBlank = rows.filter((r) => r.title.trim());
    if (nonBlank.length === 0) {
      setError("Name at least one video row.");
      return;
    }
    if (linkMode === "shared" && sharedUrl.trim() && !/^https:\/\//.test(sharedUrl.trim())) {
      setError("Shared batch link must be a valid HTTPS URL.");
      return;
    }
    startTransition(async () => {
      const result = await createVideoLogsBulk(
        projectId,
        nonBlank.map((r) => ({
          title: r.title.trim(),
          date: r.date || null,
          status: r.status || defaultStatus,
          deliveryUrl:
            linkMode === "shared"
              ? sharedUrl.trim() || null
              : r.deliveryUrl.trim() || null,
          reviewUrl: linkMode === "shared" ? null : r.reviewUrl.trim() || null,
          publishedUrl: r.publishedUrl.trim() || null,
        })),
        batchLabel.trim() || null,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const nonBlankCount = rows.filter((r) => r.title.trim()).length;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-xl border border-violet-700/50 bg-violet-950/30 hover:bg-violet-900/40 px-4 py-2.5 text-sm font-black text-violet-300 transition"
      >
        + Add Video
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-base">Add Video</h2>
              <button type="button" onClick={() => !isPending && setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>
            <p className="text-zinc-500 text-xs mb-4">
              Register one video, or several -- already in progress, already delivered, whatever its real state is. Each row becomes one video in this project; leave date blank to use today ({todayISO()}).
            </p>

            {/* Mode toggle */}
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`min-h-9 rounded-md transition ${mode === "manual" ? "bg-violet-700 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                Manual rows
              </button>
              <button
                type="button"
                onClick={() => setMode("generate")}
                className={`min-h-9 rounded-md transition ${mode === "generate" ? "bg-violet-700 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                Generate sequence
              </button>
            </div>

            {mode === "generate" && (
              <div className="mb-4 space-y-2 rounded-lg border border-violet-800/40 bg-violet-950/20 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Prefix / base name</label>
                    <input
                      type="text"
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value)}
                      placeholder="Bonnie Content Waterfall"
                      className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={genQuantity}
                      onChange={(e) => setGenQuantity(Number(e.target.value))}
                      className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Starting number</label>
                    <input
                      type="number"
                      value={genStart}
                      onChange={(e) => setGenStart(Number(e.target.value))}
                      className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Separator</label>
                    <select
                      value={genSeparator}
                      onChange={(e) => setGenSeparator(e.target.value)}
                      className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      {SEPARATOR_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s === " " ? "(space)" : s}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 sm:pt-5">
                    <input type="checkbox" checked={genZeroPad} onChange={(e) => setGenZeroPad(e.target.checked)} className="h-4 w-4" />
                    Zero-pad (01, 02…)
                  </label>
                </div>
                {generatedNames.length > 0 && (
                  <div className="rounded-md bg-zinc-950/60 p-2 text-[11px] text-zinc-400">
                    <span className="font-bold text-zinc-300">Preview:</span> {generatedNames[0]} … {generatedNames[generatedNames.length - 1]} ({generatedNames.length} video{generatedNames.length === 1 ? "" : "s"})
                  </div>
                )}
                <button
                  type="button"
                  onClick={generateRows}
                  className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2 text-xs transition-colors"
                >
                  Generate rows
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "manual" && (
                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={row.key} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-start">
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateRow(row.key, "title", e.target.value)}
                          placeholder={`Video name ${i + 1}`}
                          autoFocus={i === 0}
                          className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(row.key, "date", e.target.value)}
                            className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(row.key)}
                            disabled={rows.length <= 1}
                            className="shrink-0 min-h-[38px] px-2 text-zinc-600 hover:text-red-400 text-xs transition disabled:opacity-30"
                            aria-label={`Remove row ${i + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDetails(row.key)}
                        className="mt-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-300"
                      >
                        {row.detailsOpen ? "▾" : "▸"} Status &amp; links
                      </button>
                      {row.detailsOpen && (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">Status (row override)</label>
                            <select
                              value={row.status}
                              onChange={(e) => updateRow(row.key, "status", e.target.value)}
                              className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                            >
                              <option value="">Batch default ({VIDEO_STATUS_LABELS[defaultStatus]})</option>
                              {VIDEO_STATUSES.map((s) => (
                                <option key={s} value={s}>{VIDEO_STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </div>
                          {linkMode === "individual" && (
                            <>
                              <div>
                                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">Delivery / watch URL</label>
                                <input
                                  type="url"
                                  value={row.deliveryUrl}
                                  onChange={(e) => updateRow(row.key, "deliveryUrl", e.target.value)}
                                  placeholder="https://…"
                                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">Review URL</label>
                                <input
                                  type="url"
                                  value={row.reviewUrl}
                                  onChange={(e) => updateRow(row.key, "reviewUrl", e.target.value)}
                                  placeholder="https://…"
                                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">Published URL</label>
                                <input
                                  type="url"
                                  value={row.publishedUrl}
                                  onChange={(e) => updateRow(row.key, "publishedUrl", e.target.value)}
                                  placeholder="https://…"
                                  className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {mode === "manual" && (
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 py-2 text-xs font-semibold transition"
                >
                  + Add row
                </button>
              )}

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Default status for batch</label>
                  <select
                    value={defaultStatus}
                    onChange={(e) => setDefaultStatus(e.target.value as VideoStatus)}
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  >
                    {VIDEO_STATUSES.map((s) => (
                      <option key={s} value={s}>{VIDEO_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-zinc-600">Historical ingest may start a video directly in a later stage. Individual rows can override this above.</p>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Link mode</label>
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-300 sm:flex-row sm:gap-4">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="linkMode" checked={linkMode === "individual"} onChange={() => setLinkMode("individual")} />
                      Individual links (per row)
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="linkMode" checked={linkMode === "shared"} onChange={() => setLinkMode("shared")} />
                      Shared batch link (one URL, all videos)
                    </label>
                  </div>
                  {linkMode === "shared" && (
                    <input
                      type="url"
                      value={sharedUrl}
                      onChange={(e) => setSharedUrl(e.target.value)}
                      placeholder="https://drive.google.com/…"
                      className="mt-2 w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Batch label (optional)</label>
                  <input
                    type="text"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    placeholder="Content Waterfall — Batch 1"
                    maxLength={160}
                    className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Creating…" : `Create ${nonBlankCount || ""} video${nonBlankCount === 1 ? "" : "s"}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
