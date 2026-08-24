import Link from "next/link";
import { getSubscriptions, getSubscriptionSummary } from "@/modules/finance/actions";
import { AddSubscriptionButton } from "./AddSubscriptionButton";
import { SubscriptionRow } from "./SubscriptionRow";

export const dynamic = "force-dynamic";

// Monday Real-Operation Pre-Freeze §17/§18: monthly + annual recurring
// costs. monthlyEquivalent is always DERIVED (amount, or amount/12 for
// ANNUAL) -- the real billing event is what's stored. Grouped by currency
// -- never summed together.
export default async function SubscriptionsPage() {
  const [subscriptions, summary] = await Promise.all([
    getSubscriptions(),
    getSubscriptionSummary(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
          <h1 className="text-2xl font-bold text-white mt-1">🔁 Subscriptions</h1>
          <p className="text-zinc-500 text-sm mt-1">Recurring operational costs — monthly and annual.</p>
        </div>
        <AddSubscriptionButton />
      </div>

      {summary.byCurrency.length > 0 && (
        <div className="mb-6 space-y-3">
          {summary.byCurrency.map((c) => (
            <div key={c.currency} className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Monthly recurring ({c.currency})</p>
                <p className="text-white font-bold text-lg mt-1">{c.monthlyRecurring.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Annual committed ({c.currency})</p>
                <p className="text-white font-bold text-lg mt-1">{c.annualCommitted.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Monthly equivalent ({c.currency})</p>
                <p className="text-cyan-300 font-bold text-lg mt-1">{c.monthlyEquivalent.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No subscriptions recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((s) => (
            <SubscriptionRow key={s.id} subscription={s} />
          ))}
        </div>
      )}
    </div>
  );
}
