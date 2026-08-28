import {
  formatQuoteAmount,
  type ClientCommercialValueSummary,
} from "@/modules/quotes/core";
import { formatCurrency } from "@/utils/date";

export function ClientCommercialValuePanel({
  realizedRevenueByCurrency,
  commercialValue,
}: {
  realizedRevenueByCurrency: Array<{ currency: string; amount: number }>;
  commercialValue: ClientCommercialValueSummary;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Commercial truth
        </p>
        <h2 className="mt-1 font-black text-white">Cash and opportunity are different facts</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ValueCard
          label="Realized revenue"
          values={realizedRevenueByCurrency.map((row) => ({
            key: row.currency,
            label: formatCurrency(row.amount, row.currency),
          }))}
          valueClassName="text-emerald-300"
          note="Finance income recorded"
        />
        <ValueCard
          label="Pipeline value"
          values={commercialValue.pipelineByCurrency.map((row) => ({
            key: row.currency,
            label: formatQuoteAmount(row.totalAmountCents, row.currency),
          }))}
          valueClassName="text-amber-300"
          note="Draft or sent · not closed"
        />
        <ValueCard
          label="Value closed"
          values={commercialValue.closedByCurrency.map((row) => ({
            key: row.currency,
            label: formatQuoteAmount(row.totalAmountCents, row.currency),
          }))}
          valueClassName="text-cyan-300"
          note="Approved · not necessarily paid"
        />
      </div>
    </section>
  );
}

function ValueCard({
  label,
  values,
  valueClassName,
  note,
}: {
  label: string;
  values: Array<{ key: string; label: string }>;
  valueClassName: string;
  note: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-950/55 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">{label}</p>
      <div className={`mt-1 flex flex-wrap gap-x-2 text-xl font-black ${valueClassName}`}>
        {values.length === 0
          ? <span>—</span>
          : values.map((value) => <span key={value.key}>{value.label}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-zinc-600">{note}</p>
    </div>
  );
}
