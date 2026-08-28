"use client";

import {
  COVER_MAX_BYTES,
  isInternalCoverRoute,
  validateCoverUploadMetadata,
  type CoverTargetType,
} from "@/modules/media/core";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type UploadResponse =
  | { success: true; coverUrl: string | null }
  | { success: false; error: string };

export function CoverUploadField({
  targetType,
  targetId,
  coverUrl,
  onCoverUrlChange,
}: {
  targetType: CoverTargetType;
  targetId: number;
  coverUrl: string;
  onCoverUrlChange: (coverUrl: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const inputId = `cover-upload-${targetType}-${targetId}`;

  async function upload(file: File) {
    setError("");
    setFeedback("");
    const validationError = validateCoverUploadMetadata({
      size: file.size,
      contentType: file.type,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.set("targetType", targetType);
    formData.set("targetId", String(targetId));
    formData.set("file", file);

    setPending(true);
    try {
      const response = await fetch("/mindbunker/api/media/covers", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadResponse;
      if (!response.ok || !result.success || !result.coverUrl) {
        setError(result.success ? "Cover upload failed." : result.error);
        return;
      }
      onCoverUrlChange(result.coverUrl);
      setFeedback("Cover uploaded.");
      router.refresh();
    } catch {
      setError("Cover upload failed. Try again.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Remove this cover and restore the fallback image?")) return;
    setPending(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/mindbunker/api/media/covers", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      const result = (await response.json()) as UploadResponse;
      if (!response.ok || !result.success) {
        setError(result.success ? "Cover removal failed." : result.error);
        return;
      }
      onCoverUrlChange("");
      setFeedback("Cover removed. Fallback restored.");
      router.refresh();
    } catch {
      setError("Cover removal failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-violet-600 px-3 text-xs font-black text-white transition hover:bg-violet-500"
        >
          {pending ? "Uploading…" : "Upload image"}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {coverUrl && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={pending}
            className="min-h-11 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
          >
            Remove cover
          </button>
        )}
        <span className="text-[11px] text-zinc-600">
          PNG, JPEG or WEBP · max {Math.round(COVER_MAX_BYTES / 1024 / 1024)} MB
        </span>
      </div>
      {coverUrl && (
        <p className="mt-2 text-[11px] text-zinc-600">
          {isInternalCoverRoute(coverUrl) ? "Uploaded cover stored privately in MindBunker." : "External cover URL in use."}
        </p>
      )}
      {feedback && <p className="mt-2 text-xs text-emerald-400">{feedback}</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
