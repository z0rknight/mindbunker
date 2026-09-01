"use client";

import { useState, useTransition } from "react";
import type { getLabCrmSummary } from "./crm-data";
import { getClientContactTimeline, type TimelineEntry } from "./timeline-data";

type CrmSummary = Awaited<ReturnType<typeof getLabCrmSummary>>;

function Row({ c, onExpand }: { c: CrmSummary["active"][number]; onExpand: (id: number) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onExpand(c.id)} className="text-left w-full hover:text-white">
        {c.name} · <span className="text-violet-400">{c.state}</span>
        {c.followUpDue && <span className="text-amber-400"> · FOLLOW-UP DUE</span>}
        {" · "}{c.openProjects}p/{c.openVideos}v/{c.openCommitments}c
        {c.contractType ? ` · ${c.contractType}` : ""}
      </button>
    </li>
  );
}

export function CrmOperatorPanel({ summary }: { summary: CrmSummary }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [pending, startTransition] = useTransition();

  function expand(id: number) {
    setExpanded(id);
    startTransition(async () => setTimeline(await getClientContactTimeline(id)));
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">CRM Operator View (prototype, not canonical /crm)</p>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Lead / Qualified / Opportunity</p>
        {summary.leadLike.length === 0 ? <p className="text-xs text-zinc-500">None.</p> : (
          <ul className="text-xs text-zinc-300 space-y-1">
            {summary.leadLike.map((c) => <Row key={c.id} c={c} onExpand={expand} />)}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Active / At Risk</p>
        <ul className="text-xs text-zinc-300 space-y-1">
          {summary.active.map((c) => <Row key={c.id} c={c} onExpand={expand} />)}
        </ul>
      </div>
      {summary.other.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Other (Dormant / Lost / Unknown)</p>
          <ul className="text-xs text-zinc-500 space-y-1">
            {summary.other.map((c) => <Row key={c.id} c={c} onExpand={expand} />)}
          </ul>
        </div>
      )}
      {expanded !== null && (
        <div className="rounded-lg border border-zinc-800 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Contact Timeline</p>
          {pending ? <p className="text-xs text-zinc-500">Loading…</p> : timeline.length === 0 ? <p className="text-xs text-zinc-500">No facts yet.</p> : (
            <ul className="text-xs text-zinc-300 space-y-0.5">
              {timeline.slice(0, 15).map((e, i) => (
                <li key={i}>{new Date(e.at).toLocaleDateString()} · {e.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
