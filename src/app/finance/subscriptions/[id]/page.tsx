import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscriptionById } from "@/modules/finance/actions";
import { formatCurrency, formatDate } from "@/utils/date";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscriptionId = Number(id);
  if (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0) notFound();

  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/finance/subscriptions" className="text-xs text-zinc-500 hover:text-white">
        ← Subscriptions
      </Link>

      <div className="mb-6 mt-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{subscription.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{subscription.vendor}</p>
          </div>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
            {subscription.status}
          </span>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Recurring amount</dt>
          <dd className="mt-1 text-lg font-bold text-white">
            {formatCurrency(subscription.amount, subscription.currency)}
          </dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Cadence</dt>
          <dd className="mt-1 text-lg font-bold text-white">
            {subscription.cadence === "MONTHLY" ? "Monthly" : "Annual"}
          </dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Monthly equivalent</dt>
          <dd className="mt-1 text-lg font-bold text-cyan-300">
            {formatCurrency(subscription.monthlyEquivalent, subscription.currency)}
          </dd>
        </div>
      </dl>

      <dl className="mb-8 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Provider</dt><dd className="text-right text-white">{subscription.vendor}</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Currency</dt><dd className="text-right text-white">{subscription.currency}</dd></div>
        {subscription.category && <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Category</dt><dd className="text-right text-white">{subscription.category}</dd></div>}
        {subscription.renewalDate && <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Renewal date</dt><dd className="text-right text-white">{formatDate(subscription.renewalDate)}</dd></div>}
        {subscription.createdAt && <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Created</dt><dd className="text-right text-white">{subscription.createdAt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })}</dd></div>}
        {subscription.notes && <div className="py-3"><dt className="text-zinc-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-white">{subscription.notes}</dd></div>}
      </dl>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Payment / transaction history
      </h2>
      {subscription.payments.length === 0 ? (
        <p className="text-sm text-zinc-600">No payments recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {subscription.payments.map((payment) => (
            <article key={payment.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{payment.category}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(payment.date)} · {payment.type}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-red-400">
                  -{formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>
              {payment.notes && <p className="mt-2 text-xs text-zinc-500">{payment.notes}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
