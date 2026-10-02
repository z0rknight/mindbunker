import { formatCurrency, formatMonthKey } from "@/utils/date";
import type { MonthlyReality } from "@/modules/reality/data";

function duration(seconds: number | null) {
  if (seconds === null) return "Not separately captured";
  return `${(seconds / 3600).toFixed(2)}h`;
}

function StatusDot({ status }: { status: "GREEN" | "YELLOW" | "RED" }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${status === "GREEN" ? "bg-emerald-400" : status === "YELLOW" ? "bg-amber-400" : "bg-red-400"}`} />;
}

export function MonthlyRealityPanel({ reality, current = false }: { reality: MonthlyReality; current?: boolean }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Monthly reality · {current ? "current" : "closed fixture"}</p>
        <h2 className="mt-1 text-lg font-bold text-white">{formatMonthKey(reality.monthKey)}</h2>
        <p className="mt-1 text-xs text-zinc-600">Cash, revenue, billing and costs stay separate. Currencies never mix.</p>
      </div>

      <div className="mt-4 space-y-3">
        {reality.finance.map((row) => (
          <div key={row.currency} className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-3">
            <p className="mb-2 text-xs font-black text-zinc-400">{row.currency}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs md:grid-cols-3 lg:grid-cols-5">
              <Metric label="Cash received" value={formatCurrency(row.cashReceived, row.currency)} />
              <Metric label="Reconciled revenue" value={formatCurrency(row.reconciledRevenue, row.currency)} />
              <Metric label="Unattributed paid" value={formatCurrency(row.unattributedPaid, row.currency)} />
              <Metric label="Billed / requested" value={formatCurrency(row.billedRequested, row.currency)} />
              <Metric label="Registered billing" value={formatCurrency(row.registeredBilling, row.currency)} />
              <Metric label="Operating cost" value={formatCurrency(row.operatingCost, row.currency)} />
              <Metric label="Personal excluded" value={formatCurrency(row.personalExcluded, row.currency)} />
              <Metric label="Unknown cost" value={formatCurrency(row.unknownCost, row.currency)} />
              <Metric label="Management operating result" value={formatCurrency(row.managementOperatingResult, row.currency)} emphasize />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/45 p-3">
        <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Current operating reality</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:grid-cols-6">
          <Metric label="Active clients" value={String(reality.operations.activeClients)} />
          <Metric label="Active projects" value={String(reality.operations.activeProjects)} />
          <Metric label="Open orders" value={String(reality.operations.openProductionOrders)} />
          <Metric label="New leads" value={String(reality.operations.newLeads)} />
          <Metric label="System Inbound" value={`${reality.operations.systemInboundTotal} total · ${reality.operations.systemInboundNew} new`} />
          <Metric label="Unresolved sessions" value={String(reality.operations.unresolvedSessions)} />
          <Metric label="Unclassified finance" value={String(reality.operations.unclassifiedFinancialMovements)} />
          <Metric label="External registered" value={duration(reality.operations.externalRegisteredMinutes * 60)} />
          <Metric label="Open commercial" value={reality.operations.openCommercial.length ? reality.operations.openCommercial.map((row) => formatCurrency(row.amount, row.currency)).join(" · ") : "None"} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Intentional operating time</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label="Raw session" value={duration(reality.time.rawSeconds)} />
            <Metric label="Reconciled" value={duration(reality.time.reconciledSeconds)} />
            <Metric label="Client" value={duration(reality.time.clientSeconds)} />
            <Metric label="Internal" value={duration(reality.time.internalSeconds)} />
            <Metric label="Admin" value={duration(reality.time.adminSeconds)} />
            <Metric label="Lead" value={duration(reality.time.leadSeconds)} />
            <Metric label="Excluded total" value={`${duration(reality.time.excludedSeconds)} · ${reality.time.excludedCount} rows`} />
            <Metric label="Implausible / unresolved" value={`${duration(reality.time.implausibleSeconds)} · ${reality.time.implausibleCount} rows`} />
            <Metric label="Synthetic fixture" value={duration(reality.time.syntheticFixtureSeconds)} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Sensor coverage</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Metric label="Sensor intentional" value={duration(reality.sensor.intentionalSeconds)} />
            <Metric label="Observed portion" value={duration(reality.sensor.telemetrySeconds)} />
            <Metric label="Active inside sessions" value={duration(reality.sensor.activeSeconds)} />
            <Metric label="Idle inside sessions" value={duration(reality.sensor.idleSeconds)} />
            <Metric label="No telemetry" value={duration(reality.sensor.noTelemetrySeconds)} />
            <Metric label="Manual / offsite" value={duration(reality.sensor.manualOffsiteSeconds)} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {reality.coverage.map((item) => (
          <div key={item.key} className="rounded-lg border border-zinc-800 bg-zinc-950/55 px-3 py-2">
            <p className="flex items-center gap-2 text-[10px] font-black tracking-wide text-zinc-400"><StatusDot status={item.status} />{item.key.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className={`mt-0.5 font-semibold ${emphasize ? "text-emerald-300" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}
