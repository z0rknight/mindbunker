import Link from "next/link";
import { getFxConversions, getFxMonthSummaries } from "@/modules/fx/actions";
import { formatDate } from "@/utils/date";
import { EFFECTIVE_USD_TO_BRL_RATE } from "@/modules/finance/config";
import { RecordFxConversionButton } from "./RecordFxConversionButton";
import { SetManualRateButton } from "./SetManualRateButton";
import { FxMonthRatePanel } from "./FxMonthRatePanel";
import { EditFxConversionButton } from "./EditFxConversionButton";
import { DeleteFxConversionButton } from "./DeleteFxConversionButton";
import type { FxRateResolution } from "@/modules/fx/core";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  OBSERVED: "Observed",
  MANUAL: "Manual",
  FALLBACK: "Fallback",
};

const SCOPE_LABEL: Record<string, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  UNCLASSIFIED: "Unclassified",
};

const SCOPE_ACCENT: Record<string, string> = {
  BUSINESS: "text-indigo-400",
  PERSONAL: "text-sky-400",
  UNCLASSIFIED: "text-amber-400",
};

const PURPOSE_LABEL: Record<string, string> = {
  OPERATING_COST: "Operating cost",
  TAX_RESERVE: "Tax reserve",
  OWNER_TRANSFER: "Owner transfer",
  OTHER: "Other",
};

function MonthScopeCell({ label, resolution }: { label: string; resolution: FxRateResolution }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="text-white text-sm font-bold">R${resolution.rate.toFixed(4)}</p>
      <p className="text-zinc-500 text-[10px]">
        {SOURCE_LABEL[resolution.source]}
        {resolution.source === "OBSERVED" && ` · ${resolution.observedConversionCount}`}
      </p>
    </div>
  );
}

// Sprint C1 §66: FX observed-rate ledger. Real BRL<->USD conversions are
// recorded here as they happen; every currency ledger elsewhere in the app
// (Finance, War Room, Client Intelligence) still keeps its own currency
// separate -- this page is purely a record of what conversions actually
// happened and what rate they imply, never a trigger for any conversion
// math anywhere else.
//
// FX + Business Operating Cash Patch §4/§15: every month now shows three
// rates side by side (Business/Personal/All Observed) instead of one
// combined figure, and every conversion in the history list carries its
// Scope and, for BUSINESS rows, its Purpose -- so it's never ambiguous
// which money a given row belongs to.
export default async function FxLedgerPage() {
  const [conversions, monthSummaries] = await Promise.all([
    getFxConversions(),
    getFxMonthSummaries(),
  ]);
  const recentConversions = [...conversions].reverse().slice(0, 50);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/finance" className="text-zinc-500 text-xs hover:text-white">← Finance</Link>
          <h1 className="text-2xl font-bold text-white mt-1">💱 FX Ledger</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Observed BRL↔USD conversions. Currency ledgers stay separate everywhere else — this is context, never a mutation.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SetManualRateButton />
          <RecordFxConversionButton />
        </div>
      </div>

      <FxMonthRatePanel />

      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">App-wide Fallback</p>
          <p className="mt-0.5 text-sm font-bold text-white">1 USD ≈ R${EFFECTIVE_USD_TO_BRL_RATE.toFixed(2)}</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">temporary / manual</span>
      </div>

      <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2 mt-8">Rate by Month</h2>
      {monthSummaries.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center mb-8">
          <p className="text-zinc-500 text-sm">
            No conversions or manual rates recorded yet. The app-wide fallback rate applies everywhere until you record one.
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {monthSummaries.map((m) => (
            <div key={m.month} className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <p className="text-white text-sm font-semibold shrink-0">{m.month}</p>
              <div className="flex items-center gap-4">
                <MonthScopeCell label="Business" resolution={m.business} />
                <MonthScopeCell label="Personal" resolution={m.personal} />
                <MonthScopeCell label="All" resolution={m.all} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">Recorded Conversions</h2>
      {recentConversions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-500 text-sm">No conversions recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentConversions.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white text-sm font-semibold">
                    R${c.brlAmount.toFixed(2)} → ${c.usdAmount.toFixed(2)}
                  </p>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${SCOPE_ACCENT[c.scope]}`}>
                    {SCOPE_LABEL[c.scope]}
                  </span>
                  {c.scope === "BUSINESS" && c.purpose && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      · {PURPOSE_LABEL[c.purpose] ?? c.purpose}
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs">{formatDate(c.date)}{c.notes ? ` · ${c.notes}` : ""}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-3">
                <p className="text-zinc-400 text-xs font-semibold whitespace-nowrap">R${(c.brlAmount / c.usdAmount).toFixed(4)}/USD</p>
                <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
                  <EditFxConversionButton conversion={c} />
                  <DeleteFxConversionButton id={c.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
