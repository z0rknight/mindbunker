"use client";

import { useMemo, useState } from "react";
import {
  computePackagePricing,
  centsToDollarsString,
  buildPackageSummaryText,
  type PricingConfig,
  type ProductQuantities,
} from "@/modules/pricing/core";

const MAX_QUANTITY = 99;

function QuantityStepper({
  label,
  unitPriceCents,
  quantity,
  onChange,
}: {
  label: string;
  unitPriceCents: number;
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">
          {centsToDollarsString(unitPriceCents)} each
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity <= 0}
          aria-label={`Decrease ${label} quantity`}
          className="flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          −
        </button>
        <span className="w-8 text-center text-base font-semibold text-white tabular-nums">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_QUANTITY, quantity + 1))}
          disabled={quantity >= MAX_QUANTITY}
          aria-label={`Increase ${label} quantity`}
          className="flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-lg border border-violet-700/60 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PricingLabClient({ config }: { config: PricingConfig }) {
  const [quantities, setQuantities] = useState<ProductQuantities>({});
  const [copied, setCopied] = useState(false);

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
          À la carte calculator + Monthly Package Builder -- internal tool,
          not a client-facing surface.
        </p>
        <p className="mt-2 rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          EXPERIMENTAL CONFIGURATION. Unit prices and the {discountPct}%
          package discount are local dogfooding config, not validated
          commercial truth. This tool answers &ldquo;what would this scope
          cost right now&rdquo; -- not &ldquo;should we sell it at this
          price.&rdquo;
        </p>
      </div>

      {/* À la carte */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          À la carte
        </h2>
        <div className="space-y-2">
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
      </section>

      {/* Custom Monthly Package */}
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
  );
}
