import Link from "next/link";
import {
  getArchivedCaptures,
  getResolvedCaptures,
  getUnresolvedCaptures,
  type CaptureRow,
} from "@/modules/captures/data";
import { captureDurationMinutes } from "@/modules/captures/core";
import {
  CAPTURE_CONTEXT_LABELS,
  CAPTURE_EVENT_TYPE_LABELS,
  CAPTURE_OUTCOME_LABELS,
} from "@/modules/captures/config";
import { CaptureActions, CaptureArchiveButton } from "./CaptureActions";

export const dynamic = "force-dynamic";

function formatAge(createdAt: Date | null): string {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  return `${days}d old`;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Wave 2 §8: mirrors the Sensor review page's card shape
// (src/app/productivity/sensor/page.tsx) rather than inventing a new
// design system.
function CaptureCard({ row, review = false }: { row: CaptureRow; review?: boolean }) {
  const minutes = captureDurationMinutes(row.startedAt, row.endedAt);
  const isPromoted = row.promotedClientId !== null;
  return (
    <article className="rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-zinc-100">
            {row.counterpartyLabel ?? "(no label)"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {CAPTURE_CONTEXT_LABELS[row.context as keyof typeof CAPTURE_CONTEXT_LABELS]} · {CAPTURE_EVENT_TYPE_LABELS[row.eventType as keyof typeof CAPTURE_EVENT_TYPE_LABELS]}
            {row.channel ? ` · ${row.channel}` : ""}
            {minutes !== null ? ` · ${minutes}m` : ""}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {formatDateTime(row.createdAt)} · {formatAge(row.createdAt)} · {CAPTURE_OUTCOME_LABELS[row.outcome as keyof typeof CAPTURE_OUTCOME_LABELS]}
            {row.dismissedAt ? " · Dismissed" : ""}
            {isPromoted ? ` · Promoted → Client #${row.promotedClientId}` : ""}
          </p>
          {row.note && <p className="mt-2 text-xs text-zinc-400">{row.note}</p>}
        </div>
      </div>
      {review && <CaptureActions id={row.id} counterpartyLabel={row.counterpartyLabel} />}
      {!review && <CaptureArchiveButton id={row.id} />}
    </article>
  );
}

export default async function CaptureInboxPage() {
  const [unresolved, resolved, archived] = await Promise.all([
    getUnresolvedCaptures(),
    getResolvedCaptures(),
    getArchivedCaptures(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/productivity" className="text-xs font-bold text-cyan-400">← Productivity</Link>
      <h1 className="mt-2 text-2xl font-black text-white">📥 Capture Inbox</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Real operational facts captured before they earned full Client / Project / Video structure — a Moritz-shaped
        lead, a sample, internal work, an admin task. Nothing here is revenue, billing evidence, or a Work Session
        until you explicitly promote it. Unresolved Captures never disappear on their own.
      </p>

      <section className="mt-6 rounded-2xl border border-violet-800/50 bg-violet-950/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Unresolved</h2>
            <p className="mt-1 text-xs text-zinc-500">Still needs an operator decision.</p>
          </div>
          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
            {unresolved.length} unresolved
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {unresolved.length === 0 && <p className="text-sm text-zinc-600">Inbox clear.</p>}
          {unresolved.map((row) => <CaptureCard key={row.id} row={row} review />)}
        </div>
      </section>

      {resolved.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-bold text-white">Resolved</h2>
          <div className="mt-4 space-y-3">
            {resolved.map((row) => <CaptureCard key={row.id} row={row} />)}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <summary className="cursor-pointer text-sm font-bold text-zinc-500">
            Archived ({archived.length})
          </summary>
          <p className="mt-2 text-xs text-zinc-600">Hidden from active review. Evidence remains available for BI/history.</p>
          <div className="mt-4 space-y-3">
            {archived.map((row) => <CaptureCard key={row.id} row={row} />)}
          </div>
        </details>
      )}
    </div>
  );
}
