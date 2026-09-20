import Link from "next/link";
import { getProductionOrders } from "@/modules/production-orders/data";
import { PRODUCTION_ORDER_TONE_CLASSES } from "@/modules/production-orders/config";
import { describeProductionOrderStatus } from "@/modules/production-orders/core";
import { formatCurrency } from "@/utils/date";

export const dynamic = "force-dynamic";

export default async function ProductionOrdersPage() {
  const orders = await getProductionOrders();
  const open = orders.filter((o) => o.state === "OPEN");
  const other = orders.filter((o) => o.state !== "OPEN");

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100 sm:px-8">
      {/* Sep 17 Morning Production QA Patch: operator-requested, verbatim
          "se ficar LEVEMENTE maior ficaria perfeita" -- one Tailwind step
          wider on all three LET'S COOK pages (list/new/detail), same
          proportions and typography, just more board footprint on a wide
          screen. Not a redesign. */}
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-500">
              PRODUCTION ORDERS
            </p>
            <h1 className="font-mono text-xl font-black text-emerald-300">LET&apos;S COOK 🔥</h1>
          </div>
          <Link
            href="/productivity/orders/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-mono text-xs font-black uppercase tracking-widest text-black hover:bg-emerald-500"
          >
            + New order
          </Link>
        </div>

        <Section title={`OPEN (${open.length})`} orders={open} emptyText="No open orders. Fire one above." />
        {other.length > 0 && (
          <Section title={`CLOSED / CANCELLED (${other.length})`} orders={other} emptyText="" muted />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  orders,
  emptyText,
  muted,
}: {
  title: string;
  orders: Awaited<ReturnType<typeof getProductionOrders>>;
  emptyText: string;
  muted?: boolean;
}) {
  return (
    <section className="mb-8">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600">{title}</p>
      {orders.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-sm text-zinc-600">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/productivity/orders/${order.id}`}
              className={`flex flex-col gap-1 rounded-xl border p-4 font-mono transition-colors sm:flex-row sm:items-center sm:justify-between ${
                muted
                  ? "border-zinc-800 bg-zinc-950 opacity-70 hover:opacity-100"
                  : "border-emerald-900/40 bg-zinc-950 hover:border-emerald-600"
              }`}
            >
              <div className="min-w-0">
                {(() => {
                  const status = describeProductionOrderStatus({
                    state: order.state,
                    phase: order.phase,
                    activeCount: order.activeItemCount,
                    doneCount: order.doneItemCount,
                  });
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${PRODUCTION_ORDER_TONE_CLASSES[status.tone]}`}
                      >
                        {status.headline}
                      </span>
                      {status.detail && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{status.detail}</span>
                      )}
                    </div>
                  );
                })()}
                <p className="mt-1 truncate text-sm font-bold text-emerald-100">{order.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {order.clientName} · {order.projectName} · {order.receivedAt}
                </p>
                <p className={`mt-1 text-[11px] ${order.contractLabel ? "text-cyan-400" : "text-zinc-700"}`}>
                  {order.contractLabel ? `Contract · ${order.contractLabel}` : "No contract recorded"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-zinc-400">
                <p>
                  {order.activeItemCount} active
                  {order.cancelledItemCount > 0 ? ` · ${order.cancelledItemCount} cancelled` : ""}
                </p>
                <p>{order.doneItemCount} done</p>
                {order.expectedValueCents != null && order.currency && (
                  <p className="text-zinc-600">
                    Expected {formatCurrency(order.expectedValueCents / 100, order.currency)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
