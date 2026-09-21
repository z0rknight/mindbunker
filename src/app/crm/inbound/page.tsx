import Link from "next/link";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { acknowledgeAndOpenSystemIntakes } from "@/modules/system-inbound/actions";
import { getSystemInbound } from "@/modules/system-inbound/data";

export const dynamic = "force-dynamic";

function formatReceivedAt(value: Date | null) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export default async function SystemInboundPage() {
  const { groups, unreadEventCount } = await getSystemInbound();

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-red-400">CRM · System custody</p>
          <h1 className="text-2xl font-bold text-white">Inbound</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Machine-originated intake evidence grouped by the canonical Lead. Manual Leads stay in CRM only.
          </p>
        </div>
        <Link className="text-sm font-semibold text-zinc-400 hover:text-white" href="/crm">← All CRM</Link>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <span className="rounded bg-red-600 px-2 py-1 text-xs font-black text-white" aria-label={`${unreadEventCount} unread system intake events`}>
          {unreadEventCount} NEW
        </span>
        <p className="text-sm text-zinc-400">Unread count is intake events, not Lead rows.</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <p className="font-semibold text-zinc-300">No system intakes yet.</p>
          <p className="mt-1 text-sm text-zinc-600">Manual Leads do not appear in this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const unreadEventIds = group.intakes.filter((intake) => intake.unread).map((intake) => intake.eventId);
            const open = acknowledgeAndOpenSystemIntakes.bind(
              null,
              unreadEventIds.length > 0 ? unreadEventIds : [group.intakes[0].eventId],
              group.clientId,
            );
            return (
              <article key={group.clientId} className={`rounded-xl border bg-zinc-900/50 p-4 ${group.unreadCount > 0 ? "border-red-700/70 shadow-[inset_3px_0_0_#ff0000]" : "border-zinc-800"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-white">{group.name}</h2>
                      {group.unreadCount > 0 && (
                        <span className="rounded border border-red-700 bg-red-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300">
                          NEW · {group.unreadCount}
                        </span>
                      )}
                      {group.intakeCount > 1 && <span className="text-xs text-zinc-500">{group.intakeCount} intakes</span>}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{group.email ?? "No email"} · Current Lead state: {group.status}</p>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-xs text-zinc-600">Received</dt><dd className="mt-1 text-zinc-300">{formatReceivedAt(group.latestReceivedAt)}</dd></div>
                      <div><dt className="text-xs text-zinc-600">Source</dt><dd className="mt-1 text-zinc-300">{group.latestSourceLabel}</dd></div>
                      <div><dt className="text-xs text-zinc-600">What they want</dt><dd className="mt-1 text-zinc-300">{group.latestProjection.whatTheyWant} · {group.latestProjection.volume}</dd></div>
                      <div><dt className="text-xs text-zinc-600">Starting path</dt><dd className="mt-1 text-zinc-300">{group.latestProjection.startingPath}</dd></div>
                    </dl>
                    {group.intakeCount > 1 && (
                      <details className="mt-4 border-t border-zinc-800 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-500">Prior intake history ({group.intakeCount})</summary>
                        <ol className="mt-3 space-y-2">
                          {group.intakes.map((intake) => (
                            <li key={intake.eventId} className="flex flex-wrap gap-x-3 text-xs text-zinc-500">
                              <span>{formatReceivedAt(intake.receivedAt)}</span><span>{intake.sourceLabel}</span><span>{intake.projection.startingPath}</span><span>{intake.unread ? "Unread" : "Reviewed"}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                  <form action={open}>
                    <button type="submit" className="min-h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 lg:w-auto">
                      Open canonical Lead
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
