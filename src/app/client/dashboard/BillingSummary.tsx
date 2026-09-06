import type { ClientBillingSummary } from "@/modules/client-portal/core";

// Client Portal Gateway round (Client Billing Transparency): renders
// exactly what getClientBillingSummary/buildClientBillingSummary produce --
// no additional computation happens here. "No billable work recorded yet"
// is a genuine, distinct state from "$0.00" and is never collapsed into it
// (see the comment on ClientBillingSummary in core.ts for why).
export function BillingSummary({ billing }: { billing: ClientBillingSummary }) {
  if (!billing.hasAnyRecordedWork) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
          Current recorded spend
        </h2>
        <p className="mt-2 text-sm text-zinc-500">No billable work recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
      <h2 className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
        Current recorded spend
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
        {billing.byCurrency.map((entry) => (
          <div key={entry.currency}>
            <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {formatCurrency(entry.totalAmount, entry.currency)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatMinutes(entry.totalMinutes)} recorded billable work
              {entry.hourlyRate !== null && (
                <> · Rate: {formatCurrency(entry.hourlyRate, entry.currency)}/hour</>
              )}
            </p>
          </div>
        ))}
      </div>

      {billing.byProject.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-zinc-800/80 pt-4">
          {billing.byProject.map((entry) => (
            <div
              key={`${entry.projectId ?? "none"}:${entry.currency}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-400">
                {entry.projectName ?? "Other"}
              </span>
              <span className="flex items-baseline gap-2 font-semibold text-zinc-200">
                {entry.minutes !== null && (
                  <span className="text-xs font-normal text-zinc-600">{formatMinutes(entry.minutes)}</span>
                )}
                {formatCurrency(entry.amount, entry.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    // Defensive fallback if `currency` is ever a value Intl doesn't
    // recognize (schema allows free-text) -- never let a formatting error
    // take down the whole dashboard.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}m`;
}
