import type { FinanceHealth } from "@/modules/finance/health";

const STYLE = {
  GREEN: "border-emerald-900/60 bg-emerald-950/25 text-emerald-300",
  YELLOW: "border-amber-900/60 bg-amber-950/25 text-amber-300",
  RED: "border-red-900/60 bg-red-950/25 text-red-300",
} as const;

export function FinanceHealthPanel({ health }: { health: FinanceHealth }) {
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${STYLE[health.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
            Finance Health · deterministic checks
          </p>
          <p className="mt-1 text-lg font-black">{health.status}</p>
          <p className="text-xs opacity-80">{health.reason}</p>
        </div>
        <p className="text-2xl font-black tabular-nums">
          {health.reconciledPockets}/{health.expectedPockets}
          <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-60">pockets</span>
        </p>
      </div>
      {health.status !== "GREEN" && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-75">
          <span>Attribution pending: {health.unresolvedAttribution}</span>
          <span>Evidence-only: {health.ambiguousEvidence}</span>
          <span>Duplicate IDs: {health.duplicateExternalIdentities}</span>
          <span>Malformed FX: {health.malformedFx}</span>
        </div>
      )}
    </section>
  );
}
