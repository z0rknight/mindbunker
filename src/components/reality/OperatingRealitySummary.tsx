import type { MonthlyReality } from "@/modules/reality/data";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency, formatMonthKey } from "@/utils/date";

function moneySummary(reality: MonthlyReality) {
  const cash = reality.finance.filter((row) => row.cashReceived !== 0);
  return cash.length > 0
    ? cash.map((row) => formatCurrency(row.cashReceived, row.currency)).join(" · ")
    : "No cash evidence";
}

function Status({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" }) {
  return <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${tone === "green" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{children}</span>;
}

export function DashboardRealitySummary({ reality }: { reality: MonthlyReality }) {
  const partial = reality.coverage.some((item) => item.status !== "GREEN");
  return (
    <section className="mb-6 rounded-2xl border border-cyan-900/50 bg-cyan-950/10 p-4 sm:p-5" aria-labelledby="monthly-reality-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Operating reality · {formatMonthKey(reality.monthKey)}</p>
          <h2 id="monthly-reality-title" className="mt-1 text-base font-black text-white">Month in one honest read</h2>
        </div>
        <Status tone={partial ? "amber" : "green"}>{partial ? "Partial" : "Reconciled"}</Status>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Intentional time" value={formatClosedDuration(reality.time.reconciledSeconds)} note={reality.time.excludedSeconds > 0 ? `${formatClosedDuration(reality.time.excludedSeconds)} excluded` : "No excluded interval"} />
        <Metric label="Client production" value={formatClosedDuration(reality.time.clientSeconds)} note={`${formatClosedDuration(reality.time.internalSeconds + reality.time.adminSeconds)} internal + admin`} />
        <Metric label="Cash received" value={moneySummary(reality)} note="Currency-safe evidence" />
        <Metric label="Open commercial" value={reality.operations.openCommercial.length ? reality.operations.openCommercial.map((row) => formatCurrency(row.amount, row.currency)).join(" · ") : "None"} note={`${reality.operations.newLeads} new leads · ${reality.operations.openProductionOrders} open orders`} />
      </div>
    </section>
  );
}

export function ProductivityRealitySummary({ reality }: { reality: MonthlyReality }) {
  const coverage = reality.sensor.intentionalSeconds > 0
    ? Math.round((reality.sensor.telemetrySeconds / reality.sensor.intentionalSeconds) * 100)
    : null;
  return (
    <section className="mb-6 rounded-2xl border border-violet-900/50 bg-violet-950/10 p-4 sm:p-5" aria-labelledby="productivity-reality-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Time + context · {formatMonthKey(reality.monthKey)}</p>
          <h2 id="productivity-reality-title" className="mt-1 text-base font-black text-white">Reconciled operating time</h2>
        </div>
        <Status tone={reality.time.excludedCount > 0 ? "amber" : "green"}>{reality.time.excludedCount > 0 ? "Reconciled with exclusions" : "Reconciled"}</Status>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total" value={formatClosedDuration(reality.time.reconciledSeconds)} note={`${reality.time.excludedCount} excluded rows`} />
        <Metric label="Client" value={formatClosedDuration(reality.time.clientSeconds)} note="Canonical work sessions" />
        <Metric label="Internal + admin" value={formatClosedDuration(reality.time.internalSeconds + reality.time.adminSeconds)} note={`Admin ${formatClosedDuration(reality.time.adminSeconds)}`} />
        <Metric label="Sensor coverage" value={coverage === null ? "Unknown" : `${coverage}%`} note={`${formatClosedDuration(reality.sensor.noTelemetrySeconds)} without telemetry`} />
      </div>
      <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <summary className="cursor-pointer text-xs font-black text-zinc-400">Sensor context and top applications</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="text-xs leading-5 text-zinc-500">
            <p>Observed inside intentional sessions: <strong className="text-zinc-200">{formatClosedDuration(reality.sensor.telemetrySeconds)}</strong></p>
            <p>Manual/offsite coverage: <strong className="text-zinc-200">Unknown</strong></p>
            <p>Lead context: <strong className="text-zinc-200">{formatClosedDuration(reality.time.leadSeconds)}</strong></p>
          </div>
          <div className="space-y-1.5 text-xs">
            {reality.sensor.topApplications.length > 0 ? reality.sensor.topApplications.map((app) => (
              <div key={app.appKey} className="flex justify-between gap-3 text-zinc-500"><span>{app.label}</span><strong className="text-zinc-200">{formatClosedDuration(app.seconds)}</strong></div>
            )) : <p className="text-zinc-600">No attributable application telemetry.</p>}
          </div>
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 text-sm font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] leading-4 text-zinc-600">{note}</p></div>;
}
