"use client";

import { useState, useTransition } from "react";
import { markSessionInvalid, splitWorkSession, closeStaleSession } from "@/modules/work-session-repair/actions";
import { deriveIntegrityState } from "@/modules/work-session-repair/core";

type RepairRow = {
  id: number;
  startedAt: Date;
  endedAt: Date | null;
  activityType: string;
  source: string;
  integrityState: string;
  videoId: number | null;
  videoTitle: string | null;
  clientName: string | null;
  projectName: string | null;
};

function fmt(d: Date | null) {
  if (!d) return "open";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function badgeClass(state: string) {
  switch (state) {
    case "NORMAL": return "bg-zinc-800 text-zinc-400";
    case "STALE": return "bg-amber-900 text-amber-300";
    case "CORRECTED": return "bg-blue-900 text-blue-300";
    case "INVALID": return "bg-red-900 text-red-300";
    case "REQUIRES_REVIEW": return "bg-violet-900 text-violet-300";
    default: return "bg-zinc-800 text-zinc-400";
  }
}

export function WorkSessionRepairPanel({ sessions }: { sessions: RepairRow[] }) {
  const [pending, startTransition] = useTransition();
  const [reasonBySession, setReasonBySession] = useState<Record<number, string>>({});
  const [splitAtBySession, setSplitAtBySession] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Frozen at mount rather than read live during render (components must
  // stay pure) -- fine for a lab tool where the underlying data is already
  // a server-fetched snapshot.
  const [nowMs] = useState(() => Date.now());

  const withState = sessions.map((s) => ({
    ...s,
    derived: deriveIntegrityState({
      integrityState: s.integrityState,
      endedAt: s.endedAt,
      elapsedSeconds: s.endedAt ? 0 : (nowMs - s.startedAt.getTime()) / 1000,
    }),
  }));
  const needsAttention = withState.filter((s) => s.derived !== "NORMAL");
  const visible = showAll ? withState : needsAttention;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Work Session Repair</p>
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
          {showAll ? "Show only flagged" : `Show all (${withState.length})`}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Soft repair only. Nothing is ever hard-deleted -- INVALID and CORRECTED rows stay in the table, just excluded from economics. {needsAttention.length} session(s) currently flagged.
      </p>
      <ul className="space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-800 p-2 text-xs text-zinc-300 space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span>
                #{s.id} · {s.videoTitle ?? "no video"} {s.clientName ? `(${s.clientName})` : ""} · {s.activityType} · {fmt(s.startedAt)} → {fmt(s.endedAt)}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${badgeClass(s.derived)}`}>{s.derived}</span>
            </div>
            {s.derived === "STALE" && (
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await closeStaleSession(s.id, new Date().toISOString());
                      setMessage(r.success ? "Stale session closed and marked corrected." : r.error);
                    })
                  }
                  className="rounded-md bg-amber-700 px-2 py-1 text-[11px] font-semibold text-white"
                >
                  Close stale (now)
                </button>
              </div>
            )}
            {s.derived !== "INVALID" && (
              <div className="flex gap-1.5 flex-wrap items-center">
                <input
                  value={reasonBySession[s.id] ?? ""}
                  onChange={(e) => setReasonBySession((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  placeholder="Reason for invalidating"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white"
                />
                <button
                  disabled={pending || !(reasonBySession[s.id] ?? "").trim()}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await markSessionInvalid(s.id, reasonBySession[s.id] ?? "");
                      setMessage(r.success ? r.message : r.error);
                      if (r.success) setReasonBySession((prev) => ({ ...prev, [s.id]: "" }));
                    })
                  }
                  className="shrink-0 rounded-md bg-red-800 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  Mark Invalid
                </button>
              </div>
            )}
            {s.endedAt && (
              <div className="flex gap-1.5 flex-wrap items-center">
                <input
                  type="datetime-local"
                  value={splitAtBySession[s.id] ?? ""}
                  onChange={(e) => setSplitAtBySession((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-white"
                />
                <button
                  disabled={pending || !(splitAtBySession[s.id] ?? "")}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await splitWorkSession(s.id, new Date(splitAtBySession[s.id]).toISOString());
                      setMessage(r.success ? r.message : r.error);
                    })
                  }
                  className="shrink-0 rounded-md bg-zinc-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  Split here
                </button>
              </div>
            )}
            {s.integrityState === "INVALID" && <p className="text-[11px] text-red-400">Reason on file: soft-invalidated, row kept.</p>}
          </li>
        ))}
        {visible.length === 0 && <li className="text-xs text-zinc-500">Nothing flagged. All sessions NORMAL.</li>}
      </ul>
      {message && <p className="text-[11px] text-zinc-400">{message}</p>}
    </div>
  );
}
