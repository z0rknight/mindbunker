"use client";

import { useEffect, useState, useTransition } from "react";
import { getFxRateForMonthByScope } from "@/modules/fx/actions";
import { currentMonthKey, shiftMonthKey, formatMonthKey } from "@/utils/date";
import type { FxRateResolution } from "@/modules/fx/core";

const SOURCE_LABEL: Record<FxRateResolution["source"], string> = {
  OBSERVED: "Observed",
  MANUAL: "Manual rate",
  FALLBACK: "Fallback",
};

const SOURCE_ACCENT: Record<FxRateResolution["source"], string> = {
  OBSERVED: "text-emerald-400",
  MANUAL: "text-amber-400",
  FALLBACK: "text-zinc-500",
};

function ScopedRateRow({ label, resolution }: { label: string; resolution: FxRateResolution }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="text-right">
        <p className="text-sm font-bold text-white">R${resolution.rate.toFixed(4)}</p>
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${SOURCE_ACCENT[resolution.source]}`}>
          {SOURCE_LABEL[resolution.source]}
          {resolution.source === "OBSERVED" &&
            ` · ${resolution.observedConversionCount} conversion${resolution.observedConversionCount === 1 ? "" : "s"}`}
        </p>
      </div>
    </div>
  );
}

// Sprint C1 §68, extended by FX + Business Operating Cash Patch §4/§18:
// narrow month-navigation switcher, scoped to this one panel -- picks a
// month and shows the resolved rate for it, following the OBSERVED ->
// MANUAL -> FALLBACK provenance hierarchy computed server-side by
// resolveFxRateForMonth. Now renders all three scoped views (Business,
// Personal, All Observed) side by side so it's never ambiguous which one
// is driving Business Finance -- Personal must never silently blend into
// Business here. Does not touch the rest of the Finance UI.
export function FxMonthRatePanel() {
  const [month, setMonth] = useState(currentMonthKey());
  const [byScope, setByScope] = useState<Awaited<ReturnType<typeof getFxRateForMonthByScope>> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getFxRateForMonthByScope(month);
      setByScope(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="text-sm font-semibold text-white min-w-[9rem] text-center">{formatMonthKey(month)}</p>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
            aria-label="Next month"
          >
            →
          </button>
        </div>
        {month !== currentMonthKey() && (
          <button
            type="button"
            onClick={() => setMonth(currentMonthKey())}
            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>
      {isPending || !byScope ? (
        <p className="text-zinc-600 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2 divide-y divide-zinc-800">
          <ScopedRateRow label="Business" resolution={byScope.business} />
          <div className="pt-2">
            <ScopedRateRow label="Personal" resolution={byScope.personal} />
          </div>
          <div className="pt-2">
            <ScopedRateRow label="All Observed" resolution={byScope.all} />
          </div>
        </div>
      )}
    </div>
  );
}
