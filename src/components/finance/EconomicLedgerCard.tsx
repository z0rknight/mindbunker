import { formatCurrency } from "@/utils/date";

export function EconomicLedgerCard({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}) {
  return (
    <article className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Economic Ledger Net
          </p>
          <p className="mt-1 text-[11px] font-semibold text-zinc-600">
            Recorded economic history · not Wise cash
          </p>
        </div>
        {/* Tuesday Patch Priority 5 (metric semantics): this figure is a
            lifetime sum, not a this-month/active-window number -- the
            original complaint was literally "at least make it say ALL TIME
            HISTORY so it's unambiguous in seconds." A prominent badge, not
            a caption, because that's the one fact someone glancing at a
            large number needs first. */}
        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
          All time history
        </span>
      </div>
      <p className={`mt-3 font-mono text-2xl font-black ${amount >= 0 ? "text-zinc-100" : "text-red-300"}`}>
        {formatCurrency(amount, currency)}
      </p>
    </article>
  );
}
