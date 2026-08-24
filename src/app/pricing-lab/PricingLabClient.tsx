"use client";

import { useMemo, useState } from "react";
import {
  computePackagePricing,
  computeALaCarteHourlyEstimate,
  centsToDollarsString,
  buildPackageSummaryText,
  type PricingConfig,
  type ProductQuantities,
  type ALaCarteHourlyConfig,
} from "@/modules/pricing/core";
import {
  A_LA_CARTE_CONTENT_TYPES,
  A_LA_CARTE_COMPLEXITY_LEVELS,
  A_LA_CARTE_INCLUDED_REVISION_ROUNDS,
  A_LA_CARTE_HOURLY_RATE_CENTS,
  A_LA_CARTE_RUSH_SURCHARGE_RATE,
  A_LA_CARTE_REVISION_ROUND_HOURS,
  A_LA_CARTE_THUMBNAIL_UNIT_PRICE_CENTS,
} from "@/modules/pricing/config";

const MAX_QUANTITY = 99;
const MAX_REVISION_ROUNDS = 10;
const MAX_THUMBNAILS = 20;

type Tab = "a-la-carte" | "monthly-package";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
        active
          ? "bg-violet-600 text-white"
          : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function QuantityStepper({
  label,
  unitPriceCents,
  quantity,
  onChange,
  max = MAX_QUANTITY,
  accent = "violet",
}: {
  label: string;
  unitPriceCents?: number;
  quantity: number;
  onChange: (next: number) => void;
  max?: number;
  accent?: "violet" | "amber";
}) {
  const accentClasses =
    accent === "amber"
      ? "border-amber-700/60 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30"
      : "border-violet-700/60 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30";
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {unitPriceCents !== undefined && (
          <p className="text-xs text-zinc-500">
            {centsToDollarsString(unitPriceCents)} each
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity <= 0}
          aria-label={`Decrease ${label}`}
          className="flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          −
        </button>
        <span className="w-8 text-center text-base font-semibold text-white tabular-nums">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, quantity + 1))}
          disabled={quantity >= max}
          aria-label={`Increase ${label}`}
          className={`flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-lg border disabled:opacity-30 ${accentClasses}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ALaCarteHourlyCalculator({
  hourlyConfig,
}: {
  hourlyConfig: ALaCarteHourlyConfig;
}) {
  const [contentTypeId, setContentTypeId] = useState<string>(
    A_LA_CARTE_CONTENT_TYPES[0].id,
  );
  const [customHours, setCustomHours] = useState("5");
  const [complexityId, setComplexityId] = useState<string>("standard");
  const [includeRush, setIncludeRush] = useState(false);
  const [extraRevisionRounds, setExtraRevisionRounds] = useState(0);
  const [thumbnailCount, setThumbnailCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const contentType = A_LA_CARTE_CONTENT_TYPES.find(
    (c) => c.id === contentTypeId,
  )!;
  const complexity = A_LA_CARTE_COMPLEXITY_LEVELS.find(
    (c) => c.id === complexityId,
  )!;
  const estimatedHours =
    contentType.id === "custom"
      ? Number(customHours) || 0
      : contentType.estimatedHours;

  const breakdown = useMemo(
    () =>
      computeALaCarteHourlyEstimate(hourlyConfig, {
        estimatedHours,
        complexityMultiplier: complexity.multiplier,
        includeRush,
        extraRevisionRounds,
        thumbnailCount,
      }),
    [
      hourlyConfig,
      estimatedHours,
      complexity.multiplier,
      includeRush,
      extraRevisionRounds,
      thumbnailCount,
    ],
  );

  const handleCopy = async () => {
    const lines = [
      "À la carte estimate (EXPERIMENTAL, internal target only)",
      "",
      `Content type: ${contentType.label}`,
      `Base estimate: ${breakdown.baseHours}h`,
      `Complexity: ${complexity.label} (×${breakdown.complexityMultiplier})`,
      `Adjusted hours: ${breakdown.adjustedHours.toFixed(2)}h`,
    ];
    if (breakdown.extraRevisionRounds > 0) {
      lines.push(
        `Extra revision rounds beyond the included ${A_LA_CARTE_INCLUDED_REVISION_ROUNDS}: ${breakdown.extraRevisionRounds} (+${breakdown.revisionHours.toFixed(2)}h)`,
      );
    }
    lines.push(`Total estimated hours: ${breakdown.totalHours.toFixed(2)}h`);
    lines.push(
      `Labor (@ ${centsToDollarsString(hourlyConfig.hourlyRateCents)}/h internal target): ${centsToDollarsString(breakdown.laborCents)}`,
    );
    if (breakdown.includeRush) {
      lines.push(`Rush surcharge: ${centsToDollarsString(breakdown.rushSurchargeCents)}`);
    }
    if (breakdown.thumbnailCount > 0) {
      lines.push(
        `Thumbnails ×${breakdown.thumbnailCount}: ${centsToDollarsString(breakdown.thumbnailCents)}`,
      );
    }
    lines.push("");
    lines.push(`Suggested price: ${centsToDollarsString(breakdown.totalCents)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <p className="mb-4 rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
        EXPERIMENTAL CONFIG. Built around a{" "}
        <strong>{centsToDollarsString(hourlyConfig.hourlyRateCents)}/effective-production-hour</strong>{" "}
        internal target -- this is a cost model, NOT a client-facing hourly
        rate. The output below is one suggested flat price with a
        transparent breakdown, not an hourly invoice.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Content type
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {A_LA_CARTE_CONTENT_TYPES.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => setContentTypeId(ct.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  contentTypeId === ct.id
                    ? "border-violet-600 bg-violet-600/20 text-violet-200"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="block font-semibold text-white">{ct.label}</span>
                <span className="text-zinc-500">
                  {ct.id === "custom" ? "custom hours" : `~${ct.estimatedHours}h baseline`}
                </span>
              </button>
            ))}
          </div>
          {contentType.id === "custom" && (
            <div className="mt-2">
              <label className="mb-1 block text-xs text-zinc-500">
                Estimated hours
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Complexity (experimental adjustment)
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {A_LA_CARTE_COMPLEXITY_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => setComplexityId(level.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  complexityId === level.id
                    ? "border-violet-600 bg-violet-600/20 text-violet-200"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {level.label}
                <span className="ml-1 text-zinc-500">×{level.multiplier}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <span className="text-sm font-medium text-white">
              Rush (+25% surcharge)
            </span>
            <input
              type="checkbox"
              checked={includeRush}
              onChange={(e) => setIncludeRush(e.target.checked)}
              className="h-5 w-5 accent-amber-500"
            />
          </label>
          <QuantityStepper
            label="Thumbnails"
            unitPriceCents={hourlyConfig.thumbnailUnitPriceCents}
            quantity={thumbnailCount}
            onChange={setThumbnailCount}
            max={MAX_THUMBNAILS}
            accent="amber"
          />
        </div>

        <QuantityStepper
          label={`Extra revision rounds (${A_LA_CARTE_INCLUDED_REVISION_ROUNDS} included)`}
          quantity={extraRevisionRounds}
          onChange={setExtraRevisionRounds}
          max={MAX_REVISION_ROUNDS}
        />
      </div>

      {/* Breakdown + suggested price */}
      <div className="mt-6 rounded-xl border border-violet-700/40 bg-violet-950/20 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-300">
          Transparent breakdown
        </h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">Base estimate ({contentType.label})</dt>
            <dd className="text-zinc-300 tabular-nums">{breakdown.baseHours}h</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">Complexity adjustment</dt>
            <dd className="text-zinc-300 tabular-nums">
              ×{breakdown.complexityMultiplier} → {breakdown.adjustedHours.toFixed(2)}h
            </dd>
          </div>
          {breakdown.extraRevisionRounds > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">
                +{breakdown.extraRevisionRounds} extra revision round
                {breakdown.extraRevisionRounds > 1 ? "s" : ""}
              </dt>
              <dd className="text-zinc-300 tabular-nums">
                +{breakdown.revisionHours.toFixed(2)}h
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-violet-800/40 pt-1.5">
            <dt className="text-zinc-400">Total estimated hours</dt>
            <dd className="font-medium text-white tabular-nums">
              {breakdown.totalHours.toFixed(2)}h
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">
              Labor @ {centsToDollarsString(hourlyConfig.hourlyRateCents)}/h
            </dt>
            <dd className="text-zinc-300 tabular-nums">
              {centsToDollarsString(breakdown.laborCents)}
            </dd>
          </div>
          {breakdown.includeRush && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Rush surcharge</dt>
              <dd className="text-amber-400 tabular-nums">
                +{centsToDollarsString(breakdown.rushSurchargeCents)}
              </dd>
            </div>
          )}
          {breakdown.thumbnailCount > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">
                Thumbnails ×{breakdown.thumbnailCount}
              </dt>
              <dd className="text-zinc-300 tabular-nums">
                +{centsToDollarsString(breakdown.thumbnailCents)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-violet-800/40 pt-2">
            <dt className="text-base font-semibold text-white">Suggested price</dt>
            <dd className="text-xl font-bold text-white tabular-nums">
              {centsToDollarsString(breakdown.totalCents)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {copied ? "Copied ✓" : "Copy Estimate"}
        </button>
      </div>
    </div>
  );
}

export function PricingLabClient({ config }: { config: PricingConfig }) {
  const [tab, setTab] = useState<Tab>("a-la-carte");
  const [quantities, setQuantities] = useState<ProductQuantities>({});
  const [copied, setCopied] = useState(false);

  const hourlyConfig: ALaCarteHourlyConfig = useMemo(
    () => ({
      hourlyRateCents: A_LA_CARTE_HOURLY_RATE_CENTS,
      thumbnailUnitPriceCents:
        config.products.find((p) => p.id === "thumbnail")?.unitPriceCents ??
        A_LA_CARTE_THUMBNAIL_UNIT_PRICE_CENTS,
      rushSurchargeRate: A_LA_CARTE_RUSH_SURCHARGE_RATE,
      revisionRoundHours: A_LA_CARTE_REVISION_ROUND_HOURS,
    }),
    [config.products],
  );

  const result = useMemo(
    () => computePackagePricing(config, quantities),
    [config, quantities],
  );

  const setQuantity = (productId: string, next: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: next }));
    setCopied(false);
  };

  const handleCopy = async () => {
    const summary = buildPackageSummaryText(result);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context). Fail
      // quietly rather than throwing in front of Emmanuel mid-call -- the
      // summary text is still visible on screen either way.
      setCopied(false);
    }
  };

  const discountPct = Math.round(result.discountRate * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🧪 Pricing Lab</h1>
        <p className="mt-1 text-sm text-zinc-500">
          À la carte hourly estimator + Monthly Package Builder -- internal
          tool, not a client-facing surface.
        </p>
      </div>

      <div className="mb-6 flex gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5">
        <TabButton active={tab === "a-la-carte"} onClick={() => setTab("a-la-carte")}>
          À la carte
        </TabButton>
        <TabButton
          active={tab === "monthly-package"}
          onClick={() => setTab("monthly-package")}
        >
          Monthly Package
        </TabButton>
      </div>

      {tab === "a-la-carte" && (
        <ALaCarteHourlyCalculator hourlyConfig={hourlyConfig} />
      )}

      {tab === "monthly-package" && (
        <div>
          <p className="mb-4 rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
            EXPERIMENTAL CONFIGURATION. Unit prices and the {discountPct}%
            package discount are local dogfooding config, not validated
            commercial truth. This tool answers &ldquo;what would this scope
            cost right now&rdquo; -- not &ldquo;should we sell it at this
            price.&rdquo;
          </p>

          <div className="mb-6 space-y-2">
            {config.products.map((product) => (
              <QuantityStepper
                key={product.id}
                label={product.label}
                unitPriceCents={product.unitPriceCents}
                quantity={quantities[product.id] ?? 0}
                onChange={(next) => setQuantity(product.id, next)}
              />
            ))}
          </div>

          <section className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-violet-300">
              Custom Monthly Package
            </h2>

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Retail value</dt>
                <dd className="font-medium text-white tabular-nums">
                  {centsToDollarsString(result.retailSubtotalCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Package discount ({discountPct}%)</dt>
                <dd className="font-medium text-emerald-400 tabular-nums">
                  −{centsToDollarsString(result.discountAmountCents)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-violet-800/40 pt-2">
                <dt className="text-base font-semibold text-white">
                  Monthly package
                </dt>
                <dd className="text-xl font-bold text-white tabular-nums">
                  {centsToDollarsString(result.packageTotalCents)}
                </dd>
              </div>
            </dl>

            {!result.hasAnySelection && (
              <p className="mt-3 text-xs text-zinc-500">
                Select at least one deliverable above to build a package.
              </p>
            )}

            <p className="mt-4 text-xs text-zinc-500">
              Need a lower price? Remove scope above -- the discount stays
              fixed at {discountPct}%, the math stays honest.
            </p>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!result.hasAnySelection}
              className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied ✓" : "Copy Package Summary"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
