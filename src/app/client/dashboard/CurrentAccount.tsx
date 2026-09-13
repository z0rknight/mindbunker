import { formatCurrency } from "@/utils/date";
import type { ClientPaymentRequestView } from "@/modules/payment-requests/core";

// Dave Monday Release §9-§12: a client-safe, unambiguous "what do I owe
// right now, and how do I pay it" card. Renders nothing at all when there
// is no OPEN payment request -- never a dead/stale payment button, and
// never distinguishable from "financials are hidden for this client" (see
// the null-collapsing comment on ClientDashboardView.paymentRequest).
// Deliberately labeled "Payment request," never "Paid"/"Received"/
// "Balance" -- this number is a canonical ask, not a canonical fact about
// money that has already moved (that stays `transactions`' job alone).
export function CurrentAccount({ request }: { request: ClientPaymentRequestView }) {
  if (!request) return null;

  return (
    <section
      className="pixel-frame pixel-frame-client rounded-2xl border border-amber-500/30 bg-amber-950/10 p-4 sm:p-5"
      aria-labelledby="current-account-title"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
        Current account
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Payment request
          </p>
          <h2 id="current-account-title" className="mt-0.5 text-2xl font-black text-white sm:text-3xl">
            {formatCurrency(request.amountCents / 100, request.currency)}
          </h2>
        </div>
        <a
          href={request.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-500 px-5 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Pay with Wise
        </a>
      </div>
    </section>
  );
}
