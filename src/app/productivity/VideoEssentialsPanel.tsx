"use client";

// House Cleaning Wave 2 §3-§4 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// replaces OperationalMemoryPanel's ~50-control umbrella with exactly the
// four things the research found actually earn a place in daily video
// work -- Deadline, Blocked, Revision, Delivery. Everything else that
// lived in that panel (Production Ticket, Friction logging, Revision
// Provenance's 4-field taxonomy, per-video Log Manual Time, Schedule
// call, Copy Context, Client follow-up) is removed from this daily
// surface. No table was dropped and no server action was deleted --
// getVideoOperationalSnapshot, createVideoCommitment,
// updateVideoCommitmentDue, setCommitmentStatus, openVideoBlocker,
// resolveVideoBlocker, recordDetailedRevision and recordVideoDelivery
// are the exact same canonical actions the old panel used, just called
// from four small, honest controls instead of five expanded-by-default
// forms. Production Ticket + Friction history remain visible, read-only
// where the research found no evidence of active use, behind
// VideoAdvancedPanel.
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
import { QuickBlock } from "@/components/work-sessions/QuickVideoActions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Snapshot = Extract<VideoOperationalSnapshot, { success: true }>["data"];

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-500";
const smallButton =
  "min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 hover:border-violet-500/60 disabled:opacity-40";

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

export function VideoEssentialsPanel({ videoId, revisionsCount }: { videoId: number; revisionsCount: number }) {
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
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

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
  const openBlockers = useMemo(
    () => snapshot?.blockers.filter((item) => !item.resolvedAt) ?? [],
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

  if (loading && !snapshot) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (!snapshot) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {error && <p className="text-sm text-red-300 sm:col-span-2" aria-live="assertive">{error}</p>}
      {feedback && <p className="text-sm text-emerald-300 sm:col-span-2" aria-live="polite">{feedback}</p>}

      {/* DEADLINE */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Deadline</p>
        {openCommitments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {openCommitments.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{item.title}</p>
                  <p className="text-[11px] text-zinc-500">{formatWhen(item.dueAt)} · São Paulo</p>
                </div>
                <button disabled={pending} onClick={() => run(() => setCommitmentStatus(videoId, item.id, "DONE"))} className={smallButton}>Done</button>
              </div>
            ))}
          </div>
        ) : deadlineOpen ? (
          <div className="mt-2 space-y-2">
            <input value={deadlineTitle} onChange={(event) => setDeadlineTitle(event.target.value)} placeholder="What's the deadline for?" maxLength={300} className={inputClass} autoFocus />
            <input aria-label="Deadline date" type="datetime-local" value={deadlineDue} onChange={(event) => setDeadlineDue(event.target.value)} className={inputClass} />
            <div className="flex gap-2">
              <button
                disabled={pending || !deadlineTitle.trim() || !deadlineDue}
                onClick={() => {
                  const dueAt = canonicalDue(deadlineDue);
                  if (!dueAt) return;
                  run(
                    () => createVideoCommitment({ videoId, title: deadlineTitle, dueAt }),
                    () => { setDeadlineTitle(""); setDeadlineDue(""); setDeadlineOpen(false); },
                  );
                }}
                className={smallButton}
              >
                Save
              </button>
              <button disabled={pending} onClick={() => setDeadlineOpen(false)} className={smallButton}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setDeadlineOpen(true)} className="mt-2 min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:border-violet-500/60 hover:text-white">
            + Set deadline
          </button>
        )}
      </section>

      {/* BLOCKED */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Blocked</p>
        {openBlockers.length > 0 ? (
          <div className="mt-2 space-y-2">
            {openBlockers.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-red-900/50 bg-red-950/15 p-2">
                <p className="truncate text-xs text-red-200">{item.note || item.category}</p>
                <button disabled={pending} onClick={() => run(() => resolveVideoBlocker(videoId, item.id))} className={smallButton}>Resolve</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <QuickBlock videoId={videoId} />
          </div>
        )}
      </section>

      {/* REVISION */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
          Revision {revisionsCount > 0 && <span className="text-zinc-600">· {revisionsCount} so far</span>}
        </p>
        {revisionOpen ? (
          <div className="mt-2 space-y-2">
            <input value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="What did the client ask to change?" maxLength={1_000} className={inputClass} autoFocus />
            <div className="flex gap-2">
              <button
                disabled={pending || !revisionNote.trim()}
                onClick={() => run(
                  // Default cause/category/minutes -- the research found
                  // this taxonomy was never exercised daily. The one
                  // canonical action (recordDetailedRevision) still owns
                  // creation, so revisionsCount and the revisions table
                  // never drift apart, per §7's explicit instruction.
                  () => recordDetailedRevision({ videoId, causedBy: "UNKNOWN", category: "", minutesRework: "", note: revisionNote }),
                  () => { setRevisionNote(""); setRevisionOpen(false); },
                )}
                className={smallButton}
              >
                Record revision
              </button>
              <button disabled={pending} onClick={() => setRevisionOpen(false)} className={smallButton}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setRevisionOpen(true)} className="mt-2 min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:border-violet-500/60 hover:text-white">
            + Record revision
          </button>
        )}
      </section>

      {/* DELIVERY */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-3.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Delivery</p>
        {deliveryOpen ? (
          <div className="mt-2 space-y-2">
            <input type="url" value={deliveryUrl} onChange={(event) => setDeliveryUrl(event.target.value)} placeholder="HTTPS delivery link" className={inputClass} autoFocus />
            <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Note (optional)" maxLength={1_000} className={inputClass} />
            <div className="flex gap-2">
              <button
                disabled={pending || !deliveryUrl.trim()}
                onClick={() => run(
                  () => recordVideoDelivery({ videoId, deliveryUrl, note: deliveryNote, commitmentId: null }),
                  () => { setDeliveryNote(""); setDeliveryOpen(false); },
                )}
                className={smallButton}
              >
                Record delivery
              </button>
              <button disabled={pending} onClick={() => setDeliveryOpen(false)} className={smallButton}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setDeliveryOpen(true)} className="mt-2 min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-400 hover:border-violet-500/60 hover:text-white">
            + Record delivery
          </button>
        )}
      </section>
    </div>
  );
}
