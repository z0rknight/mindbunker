"use client";

import { useState, useTransition } from "react";
import {
  deriveBucketIdAndHostname,
  detectBucketTypeFromFilename,
  type ActivityWatchBucketType,
} from "@/modules/activitywatch/core";
import {
  confirmActivityWatchImport,
  previewActivityWatchImport,
  type ActivityWatchImportRequest,
  type ActivityWatchPreviewResult,
} from "@/modules/activitywatch/actions";

type Phase = "idle" | "working" | "preview" | "done" | "error";

type StagedFile = ActivityWatchImportRequest;

type UploadApiResponse =
  | {
      success: true;
      r2ObjectKey: string;
      bucketId: string;
      bucketType: ActivityWatchBucketType;
      hostname: string | null;
      fileFingerprint: string;
      fileSizeBytes: number;
    }
  | { success: false; error: string };

async function sha256Hex(file: File): Promise<string> {
  // Reading the whole file into memory here happens in the BROWSER tab,
  // not the Cloudflare Worker -- a 64MB ArrayBuffer is trivial for a
  // browser to hold. This is deliberately NOT how the file reaches the
  // server (see the upload fetch() below, which streams `file` directly
  // as the request body without this app ever calling file.text()).
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ImportActivityWatchPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFile | null>(null);
  const [preview, setPreview] = useState<ActivityWatchPreviewResult | null>(null);
  const [confirmedSummary, setConfirmedSummary] = useState<
    Awaited<ReturnType<typeof confirmActivityWatchImport>> | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPhase("idle");
    setError(null);
    setFileName(null);
    setStaged(null);
    setPreview(null);
    setConfirmedSummary(null);
  }

  async function handleFile(file: File) {
    reset();
    setFileName(file.name);

    const bucketType: ActivityWatchBucketType | null = detectBucketTypeFromFilename(file.name);
    if (!bucketType) {
      setPhase("error");
      setError(
        "Only aw-watcher-window_* and aw-watcher-afk_* ActivityWatch export files are supported.",
      );
      return;
    }
    const { bucketId, hostname } = deriveBucketIdAndHostname(file.name, bucketType);

    setPhase("working");
    try {
      const fileFingerprint = await sha256Hex(file);

      const uploadUrl = `/mindbunker/api/activitywatch/upload?filename=${encodeURIComponent(
        file.name,
      )}&fileFingerprint=${encodeURIComponent(fileFingerprint)}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: file, // streamed by fetch(), never buffered whole into a JS string here
        headers: { "Content-Type": "application/octet-stream" },
      });
      const uploadResult = (await uploadResponse.json()) as UploadApiResponse;
      if (!uploadResult.success) {
        setPhase("error");
        setError(uploadResult.error ?? "Upload failed.");
        return;
      }

      const request: ActivityWatchImportRequest = {
        r2ObjectKey: uploadResult.r2ObjectKey,
        bucketId: uploadResult.bucketId ?? bucketId,
        bucketType: uploadResult.bucketType ?? bucketType,
        hostname: uploadResult.hostname ?? hostname,
        fileFingerprint: uploadResult.fileFingerprint ?? fileFingerprint,
        fileSizeBytes: uploadResult.fileSizeBytes,
      };
      setStaged(request);

      const previewResult = await previewActivityWatchImport(request);
      if (!previewResult.success) {
        setPhase("error");
        setError(previewResult.error);
        return;
      }
      setPreview(previewResult);
      setPhase("preview");
    } catch {
      setPhase("error");
      setError("Something went wrong while reading or uploading this file.");
    }
  }

  function handleConfirm() {
    if (!staged) return;
    startTransition(async () => {
      const result = await confirmActivityWatchImport(staged);
      if (!result.success) {
        setPhase("error");
        setError(result.error);
        return;
      }
      setConfirmedSummary(result);
      setPhase("done");
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">
        Import ActivityWatch
      </p>
      <p className="mt-1.5 text-sm text-zinc-400">
        Import raw ActivityWatch export files (window-focus or AFK-state history)
        as observed evidence. Nothing here becomes a Sensor Session, a billable
        hour, or any canonical MindBunker record — it stays preserved as-is, with its
        own provenance, for future analysis.
      </p>

      {phase === "idle" && (
        <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950 px-4 text-center transition hover:border-violet-500/50">
          <span className="text-sm font-bold text-zinc-300">Choose an ActivityWatch export…</span>
          <span className="text-xs text-zinc-500">
            aw-watcher-window_*.json or aw-watcher-afk_*.json
          </span>
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      )}

      {phase === "working" && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          Uploading and scanning <span className="font-mono text-zinc-300">{fileName}</span>…
          this reads the file as a stream, so large exports (tens of MB) are expected
          to take a little while.
        </div>
      )}

      {phase === "preview" && preview?.success && staged && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <p className="text-zinc-500">Bucket</p>
                <p className="font-mono text-zinc-200">{staged.bucketId}</p>
              </div>
              <div>
                <p className="text-zinc-500">Type</p>
                <p className="font-bold text-zinc-200">{staged.bucketType}</p>
              </div>
              <div>
                <p className="text-zinc-500">Hostname</p>
                <p className="font-mono text-zinc-200">{staged.hostname ?? "—"}</p>
              </div>
              <div>
                <p className="text-zinc-500">File size</p>
                <p className="text-zinc-200">{formatBytes(staged.fileSizeBytes)}</p>
              </div>
              {preview.alreadyImported ? (
                <div className="col-span-2">
                  <p className="text-zinc-500">Previously imported</p>
                  <p className="text-zinc-200">{formatDate(preview.previousImportedAt)}</p>
                </div>
              ) : (
                <div className="col-span-2">
                  <p className="text-zinc-500">Time range</p>
                  <p className="text-zinc-200">
                    {formatDate(preview.summary.rangeStart)} → {formatDate(preview.summary.rangeEnd)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {preview.alreadyImported ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
              This exact file was already imported — re-confirming will write
              zero new events (this is the expected, safe outcome of
              reimporting the same export).
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3">
                <p className="text-2xl font-black text-emerald-300">{preview.summary.newCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">New</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-2xl font-black text-zinc-300">{preview.summary.duplicateCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Duplicate</p>
              </div>
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3">
                <p className="text-2xl font-black text-amber-300">{preview.summary.rejectedCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">Rejected</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="min-h-11 flex-1 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {isPending ? "Writing…" : "Confirm import"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "done" && confirmedSummary?.success && (
        <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4">
          <p className="text-sm font-bold text-emerald-200">
            {confirmedSummary.alreadyImported ? "Already imported — no changes made." : "Imported."}
          </p>
          <p className="mt-1 text-xs text-emerald-300/80">
            {confirmedSummary.summary.newCount} new · {confirmedSummary.summary.duplicateCount} duplicate ·{" "}
            {confirmedSummary.summary.rejectedCount} rejected
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 min-h-10 rounded-xl border border-emerald-800/60 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-900/30"
          >
            Import another file
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-4">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 min-h-10 rounded-xl border border-red-800/60 px-3 text-xs font-bold text-red-200 hover:bg-red-900/30"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
