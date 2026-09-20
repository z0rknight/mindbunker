import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductionOrderDetail } from "@/modules/production-orders/data";
import { PRODUCTION_ORDER_TONE_CLASSES } from "@/modules/production-orders/config";
import { describeProductionOrderStatus } from "@/modules/production-orders/core";
import { VIDEO_STATUS_LABELS } from "@/modules/productivity/config";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency } from "@/utils/date";
import { isSafeInternalPath } from "@/utils/navigation";
import { CancelItemButton, OrderLifecycleActions } from "./OrderDetailActions";
import { FormatsForClient } from "@/components/production-memory/FormatsForClient";
import { getProductionMemoryForClient } from "@/modules/production-memory/data";
import { ProductionContextBlock } from "@/components/production-context/ProductionContextBlock";
import { getProductionContextForOrder } from "@/modules/production-context/data";
import { BatchEvidenceBlock } from "@/components/production-orders/BatchEvidenceBlock";
import { computeBatchEvidence } from "@/modules/production-orders/evidence";
import { getProductionOrderSensorSeconds } from "@/modules/production-orders/evidence-data";
import { getOrderExternalTimeEvidence } from "@/modules/finance/attribution-data";

export const dynamic = "force-dynamic";

export default async function ProductionOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const [order, query] = await Promise.all([getProductionOrderDetail(orderId), searchParams]);
  if (!order) notFound();

  // Sep 18 Morning Congruence Patch: a container card on a Project page
  // (projectVideoCardHref in modules/productivity/core.ts) now routes here
  // -- without this, "back" always landed on the generic Orders list
  // regardless of whether the operator actually came from a Project, the
  // same lost-context pattern reported for Sensor Activity. Same
  // isSafeInternalPath-validated pattern used throughout Productivity.
  const rawReturnTo = query.returnTo;
  const safeReturnTo =
    typeof rawReturnTo === "string" && isSafeInternalPath(rawReturnTo) ? rawReturnTo : undefined;

  const [productionMemories, productionContext, sensorSeconds, externalTime] = await Promise.all([
    getProductionMemoryForClient(order.clientId),
    getProductionContextForOrder(orderId),
    getProductionOrderSensorSeconds(orderId),
    getOrderExternalTimeEvidence(orderId),
  ]);
  const activeItems = order.items.filter((item) => item.cancelledAt === null);
  const status = describeProductionOrderStatus({
    state: order.state,
    phase: order.phase,
    activeCount: activeItems.length,
    doneCount: activeItems.filter((item) => item.status === "DONE").length,
  });
  const batchEvidence = computeBatchEvidence({
    activeDeliverables: activeItems.length,
    doneDeliverables: activeItems.filter((item) => item.status === "DONE").length,
    containerSeconds: order.timeBreakdown.containerSeconds,
    itemSeconds: order.timeBreakdown.itemSecondsTotal,
    containerSensorSeconds: sensorSeconds.containerSensorSeconds,
    itemSensorSeconds: sensorSeconds.itemSensorSeconds,
    billedByCurrency: order.billedByCurrency,
    externalTime,
  });
  const cancelledItems = order.items.filter((item) => item.cancelledAt !== null);
  // This exact order page (its own returnTo preserved) -- so a deliverable
  // opened from here returns to here, and from there the chain back to
  // wherever the operator originally started (e.g. a Project) still works.
  const orderSelfHref = `/productivity/orders/${orderId}${safeReturnTo ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : ""}`;

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100 sm:px-8">
      {/* Sep 17 Morning Production QA Patch: see orders/page.tsx's comment
          -- same one-step width bump, no other change. */}
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href={safeReturnTo ?? "/productivity/orders"} className="font-mono text-xs text-zinc-500 hover:text-emerald-400">
            {safeReturnTo ? "← Back" : "← Orders"}
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-900/40 bg-zinc-950 p-5 font-mono sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${PRODUCTION_ORDER_TONE_CLASSES[status.tone]}`}
              >
                {status.headline}
              </span>
              {status.detail && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{status.detail}</span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-black text-emerald-100">{order.label}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {/* Containment links up the hierarchy (client -> project). */}
              <Link href={`/crm/${order.clientId}`} className="hover:text-cyan-300">{order.clientName}</Link>
              {" · "}
              <Link href={`/projects/${order.projectId}`} className="hover:text-cyan-300">{order.projectName}</Link>
              {" · "}Received {order.receivedAt}
              {order.channel ? ` · ${order.channel}` : ""}
            </p>
            <p className={`mt-2 text-xs font-bold ${order.contractLabel ? "text-cyan-300" : "text-zinc-600"}`}>
              Contract · {order.contractLabel ?? "No contract recorded"}
            </p>
          </div>
          {order.state === "OPEN" && <OrderLifecycleActions orderId={order.id} />}
        </div>

        {/* Production Operations Consolidation: batch notes, project notes,
            project source media and the client's format names in one read-only
            block (replaces the notes that used to sit at the page bottom). */}
        {productionContext && (
          <div className="mb-6">
            <ProductionContextBlock context={productionContext} />
          </div>
        )}

        <FormatsForClient clientId={order.clientId} clientName={order.clientName} memories={productionMemories} />

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

        <BatchEvidenceBlock evidence={batchEvidence} />

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
                  <p className="text-xs text-zinc-500">
                    {VIDEO_STATUS_LABELS[item.status]}
                    {item.reviewUrl && (
                      <>
                        {" · "}
                        <a href={item.reviewUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-300">Review ↗</a>
                      </>
                    )}
                    {item.deliveryUrl && (
                      <>
                        {" · "}
                        <a href={item.deliveryUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-300">Delivery ↗</a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/productivity?video=${item.videoId}&returnTo=${encodeURIComponent(orderSelfHref)}`}
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
