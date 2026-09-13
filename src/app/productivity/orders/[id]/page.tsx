import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductionOrderDetail } from "@/modules/production-orders/data";
import {
  PRODUCTION_ORDER_PHASE_LABELS,
  PRODUCTION_ORDER_STATE_LABELS,
} from "@/modules/production-orders/config";
import { VIDEO_STATUS_LABELS } from "@/modules/productivity/config";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency } from "@/utils/date";
import { CancelItemButton, OrderLifecycleActions } from "./OrderDetailActions";

export const dynamic = "force-dynamic";

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const order = await getProductionOrderDetail(orderId);
  if (!order) notFound();

  const activeItems = order.items.filter((item) => item.cancelledAt === null);
  const cancelledItems = order.items.filter((item) => item.cancelledAt !== null);

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/productivity/orders" className="font-mono text-xs text-zinc-500 hover:text-emerald-400">
            ← Orders
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-900/40 bg-zinc-950 p-5 font-mono sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                {PRODUCTION_ORDER_PHASE_LABELS[order.phase]}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {PRODUCTION_ORDER_STATE_LABELS[order.state]}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-black text-emerald-100">{order.label}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {order.clientName} · {order.projectName} · Received {order.receivedAt}
              {order.channel ? ` · ${order.channel}` : ""}
            </p>
            <p className={`mt-2 text-xs font-bold ${order.contractLabel ? "text-cyan-300" : "text-zinc-600"}`}>
              Contract · {order.contractLabel ?? "No contract recorded"}
            </p>
          </div>
          {order.state === "OPEN" && <OrderLifecycleActions orderId={order.id} />}
        </div>

        {/* Commercial */}
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-zinc-600">COMMERCIAL</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Contract"
              value={order.contractLabel ?? "—"}
              hint={order.contractLabel ? "Selected explicitly when this batch started." : "No commercial contract recorded for this batch."}
            />
            <Metric
              label="Expected"
              value={
                order.expectedValueCents != null && order.currency
                  ? formatCurrency(order.expectedValueCents / 100, order.currency)
                  : "—"
              }
              hint="Stated expectation only — never billed value."
            />
            <Metric
              label="Billed"
              value={
                order.billedByCurrency.length > 0
                  ? order.billedByCurrency
                      .map((row) => formatCurrency(row.amount, row.currency))
                      .join(" · ")
                  : "—"
              }
              hint="Derived from confirmed billing evidence allocated to this order's container."
            />
            <Metric
              label="Variance"
              value={
                order.variance.varianceCents != null
                  ? formatCurrency(order.variance.varianceCents / 100, order.currency ?? "USD")
                  : "—"
              }
              hint="Billed − expected, same currency only."
            />
          </div>
        </section>

        {/* Time — mixed tracking, always shown separately (locked semantics) */}
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">TIME TRACKED</p>
          <p className="mb-3 text-[11px] text-zinc-600">
            Batch time and per-video time are never added together — they can legitimately overlap and
            double-counting them would misrepresent real, simultaneous work.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric
              label="Batch-equivalent (container)"
              value={formatClosedDuration(order.timeBreakdown.containerSeconds)}
            />
            <Metric
              label="Precise per-video total"
              value={formatClosedDuration(order.timeBreakdown.itemSecondsTotal)}
            />
          </div>
          {order.timeBreakdown.items.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-zinc-900 pt-3">
              {order.timeBreakdown.items.map((row) => {
                const item = order.items.find((i) => i.videoId === row.videoId);
                return (
                  <div key={row.videoId} className="flex justify-between text-xs text-zinc-500">
                    <span>{item?.title ?? `Video #${row.videoId}`}</span>
                    <span>{formatClosedDuration(row.seconds)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deliverables */}
        <section className="mb-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            DELIVERABLES ({activeItems.length} active
            {cancelledItems.length > 0 ? `, ${cancelledItems.length} cancelled` : ""})
          </p>
          <div className="space-y-2">
            {activeItems.map((item) => (
              <div
                key={item.videoId}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-100">{item.title ?? `Video #${item.videoId}`}</p>
                  <p className="text-xs text-zinc-500">{VIDEO_STATUS_LABELS[item.status]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/productivity?video=${item.videoId}`}
                    className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
                  >
                    Open →
                  </Link>
                  {order.state === "OPEN" && <CancelItemButton videoId={item.videoId} />}
                </div>
              </div>
            ))}
            {cancelledItems.map((item) => (
              <div
                key={item.videoId}
                className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/50 p-3 font-mono opacity-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-400 line-through">
                    {item.title ?? `Video #${item.videoId}`}
                  </p>
                  <p className="text-xs text-zinc-600">Cancelled · history preserved</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {order.notes && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-400">
            {order.notes}
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-emerald-200">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-700">{hint}</p>}
    </div>
  );
}
