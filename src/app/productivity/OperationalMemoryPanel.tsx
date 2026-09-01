"use client";

import {
  createVideoCommitment,
  getVideoOperationalSnapshot,
  logVideoFriction,
  openVideoBlocker,
  recordDetailedRevision,
  recordVideoDelivery,
  resolveVideoBlocker,
  setCommitmentStatus,
  setProductionChecklistStep,
  type VideoOperationalSnapshot,
} from "@/modules/video-operations/actions";
import {
  BLOCKER_CATEGORIES,
  CHECKLIST_STATUSES,
  FRICTION_CATEGORIES,
  PRODUCTION_STEPS,
  REVISION_CATEGORIES,
  REVISION_CAUSES,
  type BlockerCategory,
  type ChecklistStatus,
  type FrictionCategory,
  type RevisionCategory,
  type RevisionCause,
} from "@/modules/video-operations/config";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Snapshot = Extract<VideoOperationalSnapshot, { success: true }>["data"];

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";
const smallButton =
  "min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

function formatWhen(value: Date | string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function OperationalMemoryPanel({ videoId }: { videoId: number }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [commitmentTitle, setCommitmentTitle] = useState("");
  const [commitmentDue, setCommitmentDue] = useState("");
  const [frictionCategory, setFrictionCategory] = useState<FrictionCategory>("FILES");
  const [frictionMinutes, setFrictionMinutes] = useState("");
  const [frictionNote, setFrictionNote] = useState("");
  const [blockerCategory, setBlockerCategory] = useState<BlockerCategory>("CLIENT");
  const [blockerNote, setBlockerNote] = useState("");
  const [revisionCause, setRevisionCause] = useState<RevisionCause>("UNKNOWN");
  const [revisionCategory, setRevisionCategory] = useState<RevisionCategory | "">("");
  const [revisionMinutes, setRevisionMinutes] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryCommitmentId, setDeliveryCommitmentId] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const openCommitments = useMemo(
    () => snapshot?.commitments.filter((item) => item.status === "OPEN") ?? [],
    [snapshot],
  );

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
    });
  }

  async function copyContext() {
    if (!snapshot) return;
    const lines = [
      `VIDEO: ${snapshot.video.title ?? `#${snapshot.video.id}`}`,
      `STATE: ${snapshot.video.status}`,
      `WORK: ${formatClosedDuration(snapshot.work.closedSeconds)} · ${snapshot.work.sessionCount} sessions`,
      "",
      "OPEN COMMITMENTS:",
      ...(openCommitments.length
        ? openCommitments.map((item) => `- ${item.title} · ${formatWhen(item.dueAt)}`)
        : ["- None"]),
      "",
      "OPEN BLOCKERS:",
      ...(snapshot.blockers.filter((item) => !item.resolvedAt).length
        ? snapshot.blockers.filter((item) => !item.resolvedAt).map((item) => `- ${item.category}: ${item.note ?? "No note"}`)
        : ["- None"]),
      "",
      `FRICTION: ${snapshot.friction.length} recent events`,
      `CHECKLIST: ${snapshot.checklistProgress.done}/${snapshot.checklistProgress.applicable} applicable steps done`,
      `REVISIONS: ${snapshot.revisions.length} detailed events shown`,
      `DELIVERIES: ${snapshot.deliveries.length}`,
      `PROMISE EVIDENCE: ${snapshot.promiseAccuracy.onTimeCount} on time · ${snapshot.promiseAccuracy.lateCount} late · ${snapshot.promiseAccuracy.sampleCount} measurable`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setFeedback("Video context copied.");
  }

  return (
    <section className="rounded-2xl border border-cyan-900/50 bg-cyan-950/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Operational memory</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Facts inherit this video’s client and project. Lifecycle stays separate.</p>
        </div>
        <button type="button" onClick={() => void copyContext()} disabled={!snapshot} className={smallButton}>
          Copy context
        </button>
      </div>

      {loading && !snapshot && <p className="mt-4 text-sm text-zinc-500">Loading operational facts…</p>}
      {error && <p className="mt-3 text-sm text-red-300" aria-live="assertive">{error}</p>}
      {feedback && <p className="mt-3 text-sm text-emerald-300" aria-live="polite">{feedback}</p>}

      {snapshot && (
        <div className="mt-4 space-y-3">
          <details open className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-300">
              Promise & delivery · {openCommitments.length} open
            </summary>
            <div className="mt-3 space-y-3">
              {openCommitments.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="text-[11px] text-zinc-500">{formatWhen(item.dueAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={pending} onClick={() => run(() => setCommitmentStatus(videoId, item.id, "DONE"))} className={smallButton}>Done</button>
                    <button disabled={pending} onClick={() => run(() => setCommitmentStatus(videoId, item.id, "CANCELLED"))} className={smallButton}>Cancel</button>
                  </div>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
                <input value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} placeholder="Promise made…" maxLength={300} className={inputClass} />
                <input aria-label="Promise due date" type="datetime-local" value={commitmentDue} onChange={(event) => setCommitmentDue(event.target.value)} className={inputClass} />
                <button disabled={pending || !commitmentTitle.trim() || !commitmentDue} onClick={() => run(() => createVideoCommitment({ videoId, title: commitmentTitle, dueAt: commitmentDue }), () => { setCommitmentTitle(""); setCommitmentDue(""); })} className={smallButton}>Add promise</button>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">Record output evidence</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="url" value={deliveryUrl} onChange={(event) => setDeliveryUrl(event.target.value)} placeholder="HTTPS delivery link (optional)" className={inputClass} />
                  <select value={deliveryCommitmentId} onChange={(event) => setDeliveryCommitmentId(event.target.value)} className={inputClass}>
                    <option value="">No promise link</option>
                    {openCommitments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Delivery note (optional)" maxLength={1_000} className={inputClass} />
                  <button disabled={pending} onClick={() => run(() => recordVideoDelivery({ videoId, deliveryUrl, note: deliveryNote, commitmentId: deliveryCommitmentId ? Number(deliveryCommitmentId) : null }), () => { setDeliveryNote(""); setDeliveryCommitmentId(""); })} className={smallButton}>Record delivery</button>
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Evidence: {snapshot.promiseAccuracy.onTimeCount} on time · {snapshot.promiseAccuracy.lateCount} late · {snapshot.promiseAccuracy.sampleCount} measurable. Raw counts only.
                </p>
              </div>
            </div>
          </details>

          <details open className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-300">
              Production ticket · {snapshot.checklistProgress.done}/{snapshot.checklistProgress.applicable}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRODUCTION_STEPS.map((step) => {
                const current = snapshot.checklist.find((item) => item.step === step)?.status ?? "NOT_STARTED";
                return (
                  <label key={step} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                    <span className="block text-[10px] font-black text-zinc-500">{step}</span>
                    <select value={current} onChange={(event) => run(() => setProductionChecklistStep(videoId, step, event.target.value as ChecklistStatus))} disabled={pending} className="mt-1 w-full bg-transparent text-xs font-bold text-zinc-200 outline-none">
                      {CHECKLIST_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </details>

          <details className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-300">
              Friction & blockers · {snapshot.blockers.filter((item) => !item.resolvedAt).length} blocking
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-300">Friction occurred</p>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <select value={frictionCategory} onChange={(event) => setFrictionCategory(event.target.value as FrictionCategory)} className={inputClass}>{FRICTION_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                  <input type="number" min="0" max="10080" value={frictionMinutes} onChange={(event) => setFrictionMinutes(event.target.value)} placeholder="Minutes" className={inputClass} />
                </div>
                <input value={frictionNote} onChange={(event) => setFrictionNote(event.target.value)} placeholder="What slowed the work?" maxLength={1_000} className={inputClass} />
                <button disabled={pending} onClick={() => run(() => logVideoFriction({ videoId, category: frictionCategory, minutesLost: frictionMinutes, note: frictionNote }), () => { setFrictionMinutes(""); setFrictionNote(""); })} className={smallButton}>Log friction</button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-red-300">Work cannot proceed</p>
                {snapshot.blockers.filter((item) => !item.resolvedAt).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-red-900/50 bg-red-950/15 p-2">
                    <p className="text-xs text-red-200">{item.category}: {item.note ?? "No note"}</p>
                    <button disabled={pending} onClick={() => run(() => resolveVideoBlocker(videoId, item.id))} className={smallButton}>Resolve</button>
                  </div>
                ))}
                <select value={blockerCategory} onChange={(event) => setBlockerCategory(event.target.value as BlockerCategory)} className={inputClass}>{BLOCKER_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <input value={blockerNote} onChange={(event) => setBlockerNote(event.target.value)} placeholder="What is blocked?" maxLength={1_000} className={inputClass} />
                <button disabled={pending} onClick={() => run(() => openVideoBlocker({ videoId, category: blockerCategory, note: blockerNote }), () => setBlockerNote(""))} className={smallButton}>Open blocker</button>
              </div>
            </div>
          </details>

          <details className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-300">
              Revision provenance · {snapshot.revisions.length} detailed rows
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select value={revisionCause} onChange={(event) => setRevisionCause(event.target.value as RevisionCause)} className={inputClass}>{REVISION_CAUSES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
              <select value={revisionCategory} onChange={(event) => setRevisionCategory(event.target.value as RevisionCategory | "")} className={inputClass}><option value="">No category</option>{REVISION_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <input type="number" min="0" max="10080" value={revisionMinutes} onChange={(event) => setRevisionMinutes(event.target.value)} placeholder="Rework minutes (optional)" className={inputClass} />
              <input value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="What changed?" maxLength={1_000} className={inputClass} />
              <button disabled={pending} onClick={() => run(() => recordDetailedRevision({ videoId, causedBy: revisionCause, category: revisionCategory, minutesRework: revisionMinutes, note: revisionNote }), () => { setRevisionMinutes(""); setRevisionNote(""); })} className={`${smallButton} sm:col-span-2`}>Record revision detail</button>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
