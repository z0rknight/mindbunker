"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  setCommitmentStatus,
  updateVideoCommitmentDue,
} from "@/modules/video-operations/actions";
import {
  QUICK_DEADLINE_PRESETS,
  operatorLocalDateTimeToIso,
} from "@/modules/video-operations/core";

// Tuesday Patch Completion Round §F: "one deadline object, visible in
// multiple surfaces, without duplication... use the existing commitments
// row." This is that one reusable projection -- Dashboard, War Room, and
// Productivity all render the SAME commitment via this component, and
// every action here calls the same canonical mutations
// (updateVideoCommitmentDue / setCommitmentStatus) OperationalMemoryPanel
// already uses. No new fact, no new table.
export type ActiveCommitmentData = {
  id: number;
  title: string;
  dueAt: string;
  videoId: number;
  videoTitle: string | null;
  clientName: string | null;
  projectName: string | null;
};

function formatRemaining(dueAtMs: number, nowMs: number): { text: string; overdue: boolean } {
  const diff = dueAtMs - nowMs;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const text = days > 0 ? `${days}d ${remHours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { text, overdue };
}

const PRESET_PLUS_2H = QUICK_DEADLINE_PRESETS.find((p) => p.label === "+2h")!;
const PRESET_TOMORROW = QUICK_DEADLINE_PRESETS.find((p) => p.label === "Tomorrow")!;

export function ActiveCommitmentCard({
  commitment,
  nowIso,
  compact = false,
}: {
  commitment: ActiveCommitmentData;
  nowIso: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = new Date(nowIso).getTime();
  const due = new Date(commitment.dueAt).getTime();
  const remaining = formatRemaining(due, now);

  const context = [commitment.clientName, commitment.projectName, commitment.videoTitle]
    .filter(Boolean)
    .join(" → ");

  function snooze(preset: typeof PRESET_PLUS_2H) {
    const localValue = preset.resolve();
    const iso = operatorLocalDateTimeToIso(localValue);
    if (!iso) return;
    startTransition(async () => {
      await updateVideoCommitmentDue(commitment.videoId, commitment.id, iso);
      router.refresh();
    });
  }

  function complete() {
    startTransition(async () => {
      await setCommitmentStatus(commitment.videoId, commitment.id, "DONE");
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      await setCommitmentStatus(commitment.videoId, commitment.id, "CANCELLED");
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        remaining.overdue ? "border-red-900/50 bg-red-950/10" : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{commitment.title}</p>
          {context && <p className="mt-0.5 truncate text-xs text-zinc-500">{context}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
            remaining.overdue
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
          }`}
        >
          {remaining.overdue ? `${remaining.text} overdue` : `${remaining.text} left`}
        </span>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" disabled={pending} onClick={() => snooze(PRESET_PLUS_2H)} className="min-h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-300 hover:border-violet-500/60 disabled:opacity-40">
            +2h
          </button>
          <button type="button" disabled={pending} onClick={() => snooze(PRESET_TOMORROW)} className="min-h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-300 hover:border-violet-500/60 disabled:opacity-40">
            Tomorrow
          </button>
          <button type="button" disabled={pending} onClick={complete} className="min-h-8 rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-2.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40">
            Complete
          </button>
          <button type="button" disabled={pending} onClick={cancel} className="min-h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-black text-zinc-400 hover:border-red-700/60 hover:text-red-300 disabled:opacity-40">
            Cancel
          </button>
          <Link
            href={`/productivity?video=${commitment.videoId}`}
            className="ml-auto min-h-8 rounded-lg px-2.5 text-[11px] font-black text-cyan-300 hover:text-cyan-200"
          >
            Open workspace →
          </Link>
        </div>
      )}
    </div>
  );
}
