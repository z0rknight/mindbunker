import type { getMorningBrief, getEndOfDayClose, getWeeklyFactoryReport, getCapacityPressure } from "./ops-data";
import type { TimelineEntry } from "./timeline-data";
import { EvidenceDrawer } from "./EvidenceDrawer";

function fmtHours(seconds: number) { return `${(seconds / 3600).toFixed(1)}h`; }

export function MorningBriefPanel({ brief, id }: { brief: Awaited<ReturnType<typeof getMorningBrief>>; id?: string }) {
  return (
    <div id={id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">☀️ Morning Brief</p>
      <ul className="text-xs text-zinc-300 space-y-1">
        <li className={brief.overdueCount ? "text-red-400" : ""}>{brief.overdueCount} overdue commitment(s)</li>
        <li>{brief.dueOrOverdueCommitments.length} commitment(s) with a due date total</li>
        <li className={brief.openBlockers.length ? "text-amber-400" : ""}>{brief.openBlockers.length} open blocker(s)</li>
        <li className={brief.staleSessionCount ? "text-amber-400" : ""}>{brief.staleSessionCount} stale session(s)</li>
        <li className="text-zinc-500">Last night: {brief.lastNightSleepHours !== null ? `${brief.lastNightSleepHours}h sleep` : "not logged"}{brief.lastNightEnergy !== null ? `, energy ${brief.lastNightEnergy}/5` : ""}</li>
      </ul>
    </div>
  );
}

export function EndOfDayPanel({ close, id }: { close: Awaited<ReturnType<typeof getEndOfDayClose>>; id?: string }) {
  return (
    <div id={id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">🌙 End of Day</p>
      <ul className="text-xs text-zinc-300 space-y-1">
        <li>{fmtHours(close.trackedSeconds)} intentional work</li>
        <li>{close.videosProgressed} video(s) progressed</li>
        <li>{close.deliveriesToday} delivery(ies), {close.qaEventsToday} QA event(s)</li>
        <li>{close.frictionOrRevisionsToday} friction/revision event(s)</li>
        <li>{close.commitmentsCompletedToday} commitment(s) completed</li>
        {close.openStaleSession && <li className="text-amber-400">Session still open — close it before tomorrow</li>}
      </ul>
    </div>
  );
}

export function WeeklyReportPanel({ report, id }: { report: Awaited<ReturnType<typeof getWeeklyFactoryReport>>; id?: string }) {
  return (
    <div id={id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">📅 Weekly Factory Report</p>
      <div className="text-xs text-zinc-300 space-y-1">
        <p><span className="text-zinc-500">OUTPUT:</span> {report.deliveredVideoCount} video(s) delivered (all-time DONE)</p>
        <p><span className="text-zinc-500">WORK:</span> {fmtHours(report.trackedSeconds)} tracked ({report.sessionSampleCount} sessions, 7d)</p>
        <p><span className="text-zinc-500">QUALITY:</span> {report.ourError} our errors, {report.clientChange} client changes (7d)</p>
        <p><span className="text-zinc-500">PROMISE:</span> {report.commitmentsMet} met, {report.commitmentsMissed} missed (of {report.commitmentSampleCount} created, 7d)</p>
        <p><span className="text-zinc-500">FRICTION:</span> {report.blockerCount} blocker(s) opened (7d)</p>
      </div>
      <EvidenceDrawer label="weekly sample sizes" sources={[`${report.sessionSampleCount} work sessions`, `${report.commitmentSampleCount} commitments created this window`, "7-day trailing window, not a statistical trend"]} />
    </div>
  );
}

export function CapacityPanel({ capacity, id }: { capacity: Awaited<ReturnType<typeof getCapacityPressure>>; id?: string }) {
  const color = capacity.level === "HIGH" ? "text-red-400" : capacity.level === "MEDIUM" ? "text-amber-400" : "text-emerald-400";
  return (
    <div id={id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">Capacity Pressure</p>
      <p className={`text-lg font-bold ${color}`}>{capacity.level}</p>
      <ul className="text-xs text-zinc-400 space-y-0.5">
        {capacity.reasons.length === 0 ? <li>No pressure signals.</li> : capacity.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <p className="text-[10px] text-zinc-600">A transparent rule, not a prediction.</p>
    </div>
  );
}

export function WhatChangedPanel({ today }: { today: TimelineEntry[] }) {
  const byKind = today.reduce<Record<string, number>>((acc, e) => { acc[e.kind] = (acc[e.kind] ?? 0) + 1; return acc; }, {});
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-white">What Changed Since Yesterday</p>
      {Object.keys(byKind).length === 0 ? <p className="text-xs text-zinc-500">Nothing yet today.</p> : (
        <ul className="text-xs text-zinc-300 space-y-0.5">
          {Object.entries(byKind).map(([k, c]) => <li key={k}>{k}: {c}</li>)}
        </ul>
      )}
    </div>
  );
}
