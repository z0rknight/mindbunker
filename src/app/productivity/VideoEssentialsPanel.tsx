"use client";

import {
  createVideoCommitment,
  getVideoOperationalSnapshot,
  recordDetailedRevision,
  recordVideoDelivery,
  resolveVideoBlocker,
  setCommitmentStatus,
  type VideoOperationalSnapshot,
} from "@/modules/video-operations/actions";
import { operatorLocalDateTimeToIso } from "@/modules/video-operations/core";
import { REVISION_CAUSES, REVISION_CAUSE_LABELS, type RevisionCause } from "@/modules/video-operations/config";
import type { VideoStatus } from "@/modules/productivity/config";
import { getVideoWorkspaceStatePresentation } from "@/modules/productivity/workspace-hierarchy";
import { QuickBlock } from "@/components/work-sessions/QuickVideoActions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Snapshot = Extract<VideoOperationalSnapshot, { success: true }>["data"];

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";
const smallButton =
  "min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

const toneClass = {
  neutral: "border-zinc-700 bg-zinc-950/55",
  active: "border-violet-500/35 bg-violet-950/20",
  review: "border-cyan-500/35 bg-cyan-950/20",
  changes: "border-amber-500/35 bg-amber-950/20",
  done: "border-emerald-500/35 bg-emerald-950/20",
} as const;

function formatWhen(value: Date | string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function VideoEssentialsPanel({ videoId, revisionsCount, status }: { videoId: number; revisionsCount: number; status: VideoStatus }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDue, setDeadlineDue] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionCause, setRevisionCause] = useState<RevisionCause>("UNKNOWN");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryLabel, setDeliveryLabel] = useState("");

  const load = useCallback(async () => {
    const result = await getVideoOperationalSnapshot(videoId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSnapshot(result.data);
    setDeliveryUrl(result.data.video.deliveryUrl ?? "");
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    void getVideoOperationalSnapshot(videoId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSnapshot(result.data);
      setDeliveryUrl(result.data.video.deliveryUrl ?? "");
    });
    return () => { cancelled = true; };
  }, [videoId]);

  const openCommitments = useMemo(() => snapshot?.commitments.filter((item) => item.status === "OPEN") ?? [], [snapshot]);
  const openBlockers = useMemo(() => snapshot?.blockers.filter((item) => !item.resolvedAt) ?? [], [snapshot]);
  const presentation = getVideoWorkspaceStatePresentation(status);
  const latestDelivery = snapshot?.deliveries[0] ?? null;
  const latestRevision = snapshot?.revisions[0] ?? null;
  const nextDeliveryVersion = (latestDelivery?.version ?? 0) + 1;

  function run(action: () => Promise<{ success: boolean; message?: string; error?: string }>, reset?: () => void) {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setFeedback(result.message ?? "Saved.");
      reset?.();
      await load();
      router.refresh();
    });
  }

  function canonicalDue(localValue: string) {
    const instant = operatorLocalDateTimeToIso(localValue);
    if (!instant) {
      setError("Choose a valid São Paulo date and time.");
      return null;
    }
    return instant;
  }

  if (loading && !snapshot) return <section className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">Loading review and delivery…</section>;
  if (!snapshot) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/20 p-4 sm:p-5" data-testid="video-review-delivery">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Review / delivery</p>
          <p className="mt-1 text-xs text-zinc-600">Two adjacent decisions, two canonical histories.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
          <span className={`rounded-full border px-2.5 py-1 ${presentation.reviewIsPrimary ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-zinc-800 text-zinc-600"}`}>Review · {presentation.reviewIsPrimary ? "needs attention" : "not waiting"}</span>
          <span className={`rounded-full border px-2.5 py-1 ${latestDelivery ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 text-zinc-600"}`}>Delivery · {latestDelivery ? `v${latestDelivery.version}` : "none"}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="text-sm text-emerald-300" aria-live="polite">{feedback}</p>}

      {openBlockers.length > 0 && (
        <div className="rounded-xl border border-red-500/45 bg-red-950/25 p-3" data-testid="video-active-blocker">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Blocking execution now</p>
          <div className="mt-2 space-y-2">
            {openBlockers.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-red-100">{item.note || item.category}</p>
                <button disabled={pending} onClick={() => run(() => resolveVideoBlocker(videoId, item.id))} className={smallButton}>Resolve blocker</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-xl border p-4 ${toneClass[presentation.tone]}`} data-testid={`video-state-${status.toLowerCase()}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{presentation.eyebrow}</p>
        <h3 className="mt-1 text-lg font-black text-white">{presentation.headline}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">{presentation.guidance}</p>
        {presentation.reviewIsPrimary && snapshot.video.reviewUrl && <a href={snapshot.video.reviewUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-cyan-500 px-4 text-xs font-black text-zinc-950 hover:bg-cyan-400">Open current review ↗</a>}
        {status === "CHANGES_REQUESTED" && latestRevision?.note && <p className="mt-3 rounded-lg border border-amber-500/20 bg-black/20 p-3 text-xs leading-5 text-amber-100">Latest request: {latestRevision.note}</p>}
        {presentation.reviewIsPrimary && !snapshot.video.reviewUrl && <p className="mt-3 text-xs font-bold text-amber-300">Review URL is missing. Add it in Video details.</p>}
      </div>

      {(latestDelivery || presentation.deliveryIsPrimary) && (
        <div className={`rounded-xl border p-3 ${presentation.deliveryIsPrimary ? "border-emerald-500/35 bg-emerald-950/20" : "border-zinc-800 bg-zinc-950/40"}`} data-testid="video-latest-delivery">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Latest delivery</p>
          {latestDelivery ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-black text-white">v{latestDelivery.version} · {latestDelivery.note?.trim() || (latestDelivery.version === 1 ? "Delivery" : "Redelivery")}</p><p className="mt-0.5 text-[11px] text-zinc-600">{formatWhen(latestDelivery.deliveredAt)}</p></div>
              {latestDelivery.deliveryUrl ? <a href={latestDelivery.deliveryUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-cyan-300 hover:text-cyan-200">Open delivery ↗</a> : <span className="text-xs text-zinc-600">No URL</span>}
            </div>
          ) : <p className="mt-2 text-sm font-bold text-amber-200">DONE has no canonical Delivery version yet.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "CHANGES_REQUESTED" && !revisionOpen && <button type="button" onClick={() => setRevisionOpen(true)} className="min-h-10 rounded-xl bg-amber-500 px-3 text-xs font-black text-zinc-950">Record requested change</button>}
        <button type="button" onClick={() => setDeliveryOpen((value) => !value)} className={smallButton}>{deliveryOpen ? "Cancel delivery" : `Record delivery v${nextDeliveryVersion}`}</button>
        {openBlockers.length === 0 && <QuickBlock videoId={videoId} />}
      </div>

      {revisionOpen && (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-950/10 p-3">
          <input value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="What did the client ask to change?" maxLength={1_000} className={inputClass} autoFocus />
          <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-600">Cause <span className="font-normal normal-case">(optional)</span><select value={revisionCause} onChange={(event) => setRevisionCause(event.target.value as RevisionCause)} className={`${inputClass} mt-1`} aria-label="Revision cause (optional)">{REVISION_CAUSES.map((cause) => <option key={cause} value={cause}>{REVISION_CAUSE_LABELS[cause]}</option>)}</select></label>
          <div className="flex gap-2"><button disabled={pending || !revisionNote.trim()} onClick={() => run(() => recordDetailedRevision({ videoId, causedBy: revisionCause, category: "", minutesRework: "", note: revisionNote }), () => { setRevisionNote(""); setRevisionCause("UNKNOWN"); setRevisionOpen(false); })} className={smallButton}>Save revision</button><button disabled={pending} onClick={() => setRevisionOpen(false)} className={smallButton}>Cancel</button></div>
        </div>
      )}

      {deliveryOpen && (
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3">
          <input type="url" value={deliveryUrl} onChange={(event) => setDeliveryUrl(event.target.value)} placeholder="HTTPS delivery link" className={inputClass} autoFocus />
          <input value={deliveryLabel} onChange={(event) => setDeliveryLabel(event.target.value)} placeholder="Version label (e.g. Final export)" maxLength={1_000} className={inputClass} />
          <button disabled={pending || !deliveryUrl.trim()} onClick={() => run(() => recordVideoDelivery({ videoId, deliveryUrl, note: deliveryLabel, commitmentId: null }), () => { setDeliveryLabel(""); setDeliveryOpen(false); })} className={smallButton}>Record v{nextDeliveryVersion}</button>
          <p className="text-[10px] leading-4 text-zinc-600">A new version never replaces prior Delivery history and does not imply approval.</p>
        </div>
      )}

      <details className="group rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
        <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-wider text-zinc-500"><span className="mr-1.5 inline-block transition group-open:rotate-90">▸</span>Deadlines, revisions & older delivery history</summary>
        <div className="mt-3 space-y-4 border-t border-zinc-800 pt-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Deadlines</p>
            {openCommitments.length > 0 ? (
              <div className="mt-2 space-y-2">{openCommitments.map((item) => <div key={item.id} className="flex items-center justify-between gap-2"><div><p className="text-sm font-bold text-white">{item.title}</p><p className="text-[11px] text-zinc-500">{formatWhen(item.dueAt)} · São Paulo</p></div><button disabled={pending} onClick={() => run(() => setCommitmentStatus(videoId, item.id, "DONE"))} className={smallButton}>Done</button></div>)}</div>
            ) : deadlineOpen ? (
              <div className="mt-2 space-y-2"><input value={deadlineTitle} onChange={(event) => setDeadlineTitle(event.target.value)} placeholder="What's the deadline for?" maxLength={300} className={inputClass} /><input aria-label="Deadline date" type="datetime-local" value={deadlineDue} onChange={(event) => setDeadlineDue(event.target.value)} className={inputClass} /><button disabled={pending || !deadlineTitle.trim() || !deadlineDue} onClick={() => { const dueAt = canonicalDue(deadlineDue); if (dueAt) run(() => createVideoCommitment({ videoId, title: deadlineTitle, dueAt }), () => { setDeadlineTitle(""); setDeadlineDue(""); setDeadlineOpen(false); }); }} className={smallButton}>Save deadline</button></div>
            ) : <button type="button" onClick={() => setDeadlineOpen(true)} className={`${smallButton} mt-2`}>+ Set deadline</button>}
          </div>
          {status !== "CHANGES_REQUESTED" && <button type="button" onClick={() => setRevisionOpen(true)} className={smallButton}>+ Record revision</button>}
          {snapshot.deliveries.length > 1 && <div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Older deliveries</p><ul className="mt-2 space-y-1.5">{snapshot.deliveries.slice(1).map((delivery) => <li key={delivery.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/20 px-2.5 py-2 text-[11px]"><span className="truncate font-bold text-zinc-400">v{delivery.version} · {delivery.note?.trim() || "Delivery"}</span>{delivery.deliveryUrl && <a href={delivery.deliveryUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-cyan-400">Open ↗</a>}</li>)}</ul></div>}
          <p className="text-[10px] text-zinc-600">{revisionsCount} revision{revisionsCount === 1 ? "" : "s"} recorded · provenance remains in Advanced / history.</p>
        </div>
      </details>
    </section>
  );
}
