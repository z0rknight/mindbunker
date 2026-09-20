import Link from "next/link";
import { signalActionHref, type SignalSeverity } from "@/modules/signals/core";
import type { ProductivityAttentionGroup } from "@/modules/productivity/attention";

// P0.2: renders the Productivity projection of modules/signals (see
// modules/productivity/attention.ts for the selection/grouping rule).
// Deliberately server-rendered, no client state -- every item here is a
// link into this same page (?video=…), never a separate mutation surface.
const MAX_ROWS_PER_GROUP = 4;

function severityDotClass(severity: SignalSeverity) {
  return severity === "ACTION" ? "bg-red-400" : "bg-amber-400";
}

function severityCardClass(severity: SignalSeverity) {
  return severity === "ACTION"
    ? "border-red-900/50 bg-red-950/10"
    : "border-amber-900/50 bg-amber-950/10";
}

export function NeedsAttentionSection({ groups }: { groups: ProductivityAttentionGroup[] }) {
  return (
    <section aria-labelledby="needs-attention" className="mb-7">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Before you start</p>
        <h2 id="needs-attention" className="mt-1 text-lg font-black text-white sm:text-xl">
          Needs Attention
        </h2>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-600">No operational exceptions right now.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const visible = group.signals.slice(0, MAX_ROWS_PER_GROUP);
            const hiddenCount = group.signals.length - visible.length;
            return (
              <div
                key={group.kind}
                className={`rounded-2xl border p-3.5 sm:p-4 ${severityCardClass(group.severity)}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${severityDotClass(group.severity)}`} />
                  <p className="text-sm font-black text-white">{group.label}</p>
                  {group.signals.length > 1 && (
                    <span className="font-mono text-xs text-zinc-500">{group.signals.length}</span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {visible.map((signal) => (
                    <div
                      key={signal.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200">{signal.statement}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{signal.evidence}</p>
                      </div>
                      {signal.action && (
                        <Link
                          href={signalActionHref(signal.action.href, "/productivity")}
                          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-center text-xs font-bold text-zinc-200 hover:border-violet-500 hover:text-violet-200"
                        >
                          {signal.action.label} →
                        </Link>
                      )}
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <p className="text-xs text-zinc-500">+{hiddenCount} more {group.label.toLowerCase()}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
