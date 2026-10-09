"use client";

import { QualityEvidenceItem } from "@/components/quality-evidence/QualityEvidenceComparison";
import { STATIC_BASE_PATH } from "@/lib/auth-core";
import { getQualityEvidenceForVideo, type QualityEvidenceView } from "@/modules/quality-evidence/actions";
import type { QualityEvidenceType, QualityEvidenceVisibility } from "@/modules/quality-evidence/config";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type CreateResponse = { success: true; id: number } | { success: false; error: string };

const fieldClass = "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";

export function QualityEvidencePanel({ videoId }: { videoId: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<QualityEvidenceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [authoring, setAuthoring] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [type, setType] = useState<QualityEvidenceType>("IMAGE_COMPARISON");
  const [visibility, setVisibility] = useState<QualityEvidenceVisibility>("INTERNAL_ONLY");

  const load = useCallback(async () => {
    const result = await getQualityEvidenceForVideo(videoId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setItems(result.data);
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    void getQualityEvidenceForVideo(videoId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setItems(result.data);
    });
    return () => { cancelled = true; };
  }, [videoId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFeedback("");
    const data = new FormData(event.currentTarget);
    data.set("videoId", String(videoId));
    data.set("type", type);
    data.set("visibility", visibility);
    try {
      const response = await fetch(`${STATIC_BASE_PATH}/api/quality-evidence`, { method: "POST", body: data });
      const result = (await response.json()) as CreateResponse;
      if (!response.ok || !result.success) {
        setError(result.success ? "Quality evidence could not be saved." : result.error);
        return;
      }
      setFeedback("Quality evidence saved.");
      formRef.current?.reset();
      setAuthoring(false);
      await load();
      router.refresh();
    } catch {
      setError("Quality evidence could not be saved.");
    } finally {
      setPending(false);
    }
  }

  const accept = type === "IMAGE_COMPARISON"
    ? "image/png,image/jpeg,image/webp"
    : "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav";

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950/20 ${items.length === 0 && !authoring && !loading ? "p-3" : "space-y-3 p-4 sm:p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Quality evidence</p>
          {(items.length > 0 || authoring || loading) && <p className="mt-1 text-xs text-zinc-600">Explicit proof of transformation. Not approval, scoring, time, or billing.</p>}
        </div>
        <button type="button" onClick={() => setAuthoring((value) => !value)} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-xs font-black text-zinc-300 hover:border-violet-500/60 hover:text-white">
          {authoring ? "Cancel" : "+ Add evidence"}
        </button>
      </div>
      {error && <p className="text-xs text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="text-xs text-emerald-300" aria-live="polite">{feedback}</p>}

      {authoring && (
        <form ref={formRef} onSubmit={submit} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Type
            <select value={type} onChange={(event) => setType(event.target.value as QualityEvidenceType)} className={`${fieldClass} mt-1`}>
              <option value="IMAGE_COMPARISON">Image before / after</option>
              <option value="AUDIO_COMPARISON">Audio A / B</option>
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Visibility
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as QualityEvidenceVisibility)} className={`${fieldClass} mt-1`}>
              <option value="INTERNAL_ONLY">Internal only</option>
              <option value="CLIENT_SAFE">Client safe</option>
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-2">
            Label
            <input name="label" required maxLength={160} placeholder={type === "IMAGE_COMPARISON" ? "Color correction" : "Audio correction"} className={`${fieldClass} mt-1`} />
          </label>
          {(["before", "after"] as const).map((side) => (
            <fieldset key={side} className="rounded-xl border border-zinc-800 p-3">
              <legend className="px-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">{side}</legend>
              <input name={`${side}File`} type="file" accept={accept} className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:font-bold file:text-white" />
              <p className="my-2 text-center text-[9px] font-black uppercase tracking-wider text-zinc-700">or HTTPS reference</p>
              <input name={`${side}Url`} type="url" placeholder="https://…" className={fieldClass} />
            </fieldset>
          ))}
          <button disabled={pending} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-50 sm:col-span-2">
            {pending ? "Saving…" : "Save quality evidence"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-zinc-600">Loading evidence…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-600">No before / after proof attached.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <QualityEvidenceItem key={item.id} evidence={item} internal />)}
        </div>
      )}
    </section>
  );
}
