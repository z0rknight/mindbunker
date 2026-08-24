// Monday Local Intelligence Lab §C — lightweight SVG/CSS visuals rendered
// ABOVE the existing All History table. Plain server component (no client
// JS needed): every bar/line is computed from data already fetched by the
// page, and hover tooltips use native <title> elements. No chart library
// added. Every hard rule the table already honors still applies here: a
// year with unknown data is rendered as an explicit "no data" placeholder,
// never a zero-height bar; nothing here interpolates or fabricates a
// cross-source number that wasn't actually computed from hist_facts.

import {
  computeCumulativeRevenue,
  computeYoYRevenueChange,
} from "@/modules/historical/core";
import type { AllHistoryYearRow } from "@/modules/historical/data";

const COVERAGE_SOURCE_LABELS: Record<string, string> = {
  upwork_weekly_summary: "Upwork",
  clockify_detailed_export: "Clockify",
  activitywatch_afk: "AFK",
};

function formatUsdShort(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function BarColumn({
  year,
  value,
  maxValue,
  formatValue,
  colorClass,
  suffix,
}: {
  year: number;
  value: number | null;
  maxValue: number;
  formatValue: (v: number) => string;
  colorClass: string;
  suffix?: string;
}) {
  const pct = value !== null && maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div className="flex h-28 w-full items-end justify-center">
        {value !== null ? (
          <div
            className={`w-7 rounded-t sm:w-9 ${colorClass}`}
            style={{ height: `${pct}%` }}
            title={`${year}: ${formatValue(value)}${suffix ?? ""}`}
          />
        ) : (
          <div
            className="flex h-full w-7 items-center justify-center rounded border border-dashed border-zinc-700 sm:w-9"
            title={`${year}: no data`}
          >
            <span className="text-xs text-zinc-600">?</span>
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium text-zinc-500">{year}</span>
    </div>
  );
}

export function AllHistoryVisuals({ rows }: { rows: AllHistoryYearRow[] }) {
  if (rows.length === 0) return null;

  const maxRevenue = Math.max(
    0,
    ...rows.map((r) => r.revenueUsd).filter((v): v is number => v !== null),
  );
  const maxBilledHours = Math.max(
    0,
    ...rows.map((r) => r.billedHours).filter((v): v is number => v !== null),
  );
  const maxTrackedHours = Math.max(
    0,
    ...rows.map((r) => r.trackedHours).filter((v): v is number => v !== null),
  );

  const yoy = computeYoYRevenueChange(rows);
  const cumulative = computeCumulativeRevenue(rows);
  const cumulativeKnown = cumulative.filter((c) => c.cumulativeUsd !== null);
  const cumulativeBroken = cumulativeKnown.length < cumulative.length;
  const maxCumulative = Math.max(
    0,
    ...cumulativeKnown.map((c) => c.cumulativeUsd as number),
  );

  // SVG polyline points for the cumulative-revenue line -- only the leading
  // contiguous run of known years is plotted (see computeCumulativeRevenue).
  const svgWidth = 100;
  const svgHeight = 60;
  const points = cumulativeKnown.map((c, i) => {
    const x =
      cumulativeKnown.length > 1
        ? (i / (cumulativeKnown.length - 1)) * svgWidth
        : svgWidth / 2;
    const y =
      maxCumulative > 0
        ? svgHeight - (c.cumulativeUsd! / maxCumulative) * (svgHeight - 8) - 4
        : svgHeight / 2;
    return `${x},${y}`;
  });

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Annual revenue */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Annual Revenue
          </h3>
          <div className="flex gap-2">
            {rows.map((row) => (
              <BarColumn
                key={row.year}
                year={row.year}
                value={row.revenueUsd}
                maxValue={maxRevenue}
                formatValue={formatUsdShort}
                colorClass="bg-emerald-600"
              />
            ))}
          </div>
        </div>

        {/* Annual Upwork billed hours */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Annual Upwork Billed Hours
          </h3>
          <div className="flex gap-2">
            {rows.map((row) => (
              <BarColumn
                key={row.year}
                year={row.year}
                value={row.billedHours}
                maxValue={maxBilledHours}
                formatValue={(v) => v.toFixed(0)}
                suffix="h"
                colorClass="bg-blue-600"
              />
            ))}
          </div>
        </div>

        {/* Tracked hours, only where coverage exists */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Tracked Hours (Clockify, where covered)
          </h3>
          <div className="flex gap-2">
            {rows.map((row) => (
              <BarColumn
                key={row.year}
                year={row.year}
                value={row.trackedHours}
                maxValue={maxTrackedHours}
                formatValue={(v) => v.toFixed(0)}
                suffix="h"
                colorClass="bg-cyan-600"
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            &ldquo;?&rdquo; = no Clockify coverage that year, shown as unknown,
            never as zero.
          </p>
        </div>

        {/* YoY revenue change */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            YoY Revenue Change
          </h3>
          <div className="flex flex-wrap gap-2">
            {yoy.map((entry) => (
              <div
                key={entry.year}
                className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <span className="text-[10px] text-zinc-600">{entry.year}</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    entry.changePct === null
                      ? "text-zinc-600"
                      : entry.changePct > 0
                        ? "text-emerald-400"
                        : entry.changePct < 0
                          ? "text-red-400"
                          : "text-zinc-400"
                  }`}
                >
                  {entry.changePct === null
                    ? "—"
                    : `${entry.changePct > 0 ? "+" : ""}${entry.changePct}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cumulative revenue */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Cumulative Revenue
        </h3>
        {points.length >= 2 ? (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="h-20 w-full"
            preserveAspectRatio="none"
          >
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="#34d399"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <p className="text-xs text-zinc-600">Not enough known years to draw a line yet.</p>
        )}
        <div className="mt-2 flex justify-between text-[11px] text-zinc-600">
          {cumulativeKnown.map((c) => (
            <span key={c.year}>
              {c.year}: {formatUsdShort(c.cumulativeUsd as number)}
            </span>
          ))}
        </div>
        {cumulativeBroken && (
          <p className="mt-2 text-[11px] text-amber-500">
            Cumulative total stops at{" "}
            {cumulativeKnown[cumulativeKnown.length - 1]?.year ?? "—"} because
            a later year has unknown revenue — shown as a gap, never assumed
            to be $0.
          </p>
        )}
      </div>

      {/* Source coverage per year */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Source Coverage per Year
        </h3>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.year}>
              <p className="mb-1 text-xs font-semibold text-zinc-400">{row.year}</p>
              <div className="space-y-1">
                {row.coverage.map((c) => {
                  const pct = c.monthsTotal > 0 ? (c.monthsPresent / c.monthsTotal) * 100 : 0;
                  return (
                    <div key={c.source} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[10px] text-zinc-500">
                        {COVERAGE_SOURCE_LABELS[c.source] ?? c.source}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${pct}%` }}
                          title={`${c.monthsPresent}/${c.monthsTotal} months`}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-zinc-600">
                        {c.monthsPresent}/{c.monthsTotal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
