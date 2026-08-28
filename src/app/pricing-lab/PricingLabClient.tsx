"use client";

import { useMemo, useState } from "react";
import {
  computePackagePricing,
  computeALaCarteHourlyEstimate,
  centsToDollarsString,
  buildPackageSummaryText,
  buildClientQuoteText,
  buildClientQuoteMarkdown,
  type PricingConfig,
  type ProductQuantities,
  type ALaCarteHourlyConfig,
  type ClientQuotePresentation,
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

// Client Service Reality Patch (25 Aug 2026) -- presentation-only choices
// for the "client presentation" view (brief §4/§5). None of these feed
// the price calculation above; they only describe it. ETA is free text
// (a few common presets, or type your own) since turnaround isn't a
// concept the calculation engine has ever tracked.
const ETA_PRESETS = ["24h", "48h", "3 days", "1 week"];
const DEFAULT_SCOPE_OPTIONS = [
  "Color correction",
  "Audio adjustment",
  "Captions",
  "Music",
  "Graphics / titles",
  "Export & delivery",
];

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

// Quick Morning Reality Patch (26 Aug 2026) §10: the actual "showroom" --
// a real branded card, always visible (not hidden behind a preview
// toggle), built to be screenshotted and sent as-is. Renders exactly the
// same client-safe fields buildClientQuoteText/buildClientQuoteMarkdown
// already produce -- this is a visual rendering of that same data, never
// a second source of truth for it. No internal hours, labor rate,
// complexity math, or margin appears anywhere on this card.
function ShowroomCard({ presentation }: { presentation: ClientQuotePresentation }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-700/40 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-xl shadow-black/40">
      <div className="border-b border-violet-900/40 bg-violet-950/20 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">RMEDIA</p>
        <p className="mt-0.5 text-lg font-black text-white">Video Production Quote</p>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Content</p>
          <p className="mt-0.5 text-sm font-bold text-white">{presentation.contentTypeLabel}</p>
        </div>

        {presentation.scopeLines.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Includes</p>
            <ul className="mt-1.5 space-y-1">
              {presentation.scopeLines.map((line, index) => (
                <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm text-zinc-200">
                  <span className="mt-0.5 text-emerald-400" aria-hidden="true">✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Delivery</p>
            <p className="mt-0.5 text-sm font-bold text-white">{presentation.turnaroundLabel}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Revisions</p>
            <p className="mt-0.5 text-sm font-bold text-white">{presentation.revisionsIncluded}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Investment</p>
          <p className="mt-0.5 text-2xl font-black text-white tabular-nums">
            {centsToDollarsString(presentation.investmentCents)}
          </p>
        </div>

        <p className="text-center text-sm font-semibold text-zinc-400">Sounds good?</p>
      </div>
    </div>
  );
}

function ClientPresentationPanel({
  contentTypeLabel,
  complexityLabel,
  baseRevisionsIncluded,
  extraRevisionRounds,
  investmentCents,
}: {
  contentTypeLabel: string;
  complexityLabel: string;
  baseRevisionsIncluded: number;
  extraRevisionRounds: number;
  investmentCents: number;
}) {
  // Client Service Reality Patch (25 Aug 2026, brief §4/§5) -- presentation-
  // only state. ETA and scope never feed the price; investmentCents is
  // passed straight through from the one calculation engine
  // (computeALaCarteHourlyEstimate in the parent). Isolated in its own
  // component so this interactive state can't perturb
  // ALaCarteHourlyCalculator's existing breakdown memoization.
  const [eta, setEta] = useState(ETA_PRESETS[0]);
  const [selectedScope, setSelectedScope] = useState<string[]>([
    DEFAULT_SCOPE_OPTIONS[0],
    DEFAULT_SCOPE_OPTIONS[1],
  ]);
  const [customScopeLine, setCustomScopeLine] = useState("");
  const [customScopeLines, setCustomScopeLines] = useState<string[]>([]);
  const [clientCopied, setClientCopied] = useState<"text" | "markdown" | null>(null);

  const toggleScopeOption = (option: string) => {
    setSelectedScope((prev) =>
      prev.includes(option)
        ? prev.filter((existing) => existing !== option)
        : [...prev, option],
    );
  };

  const addCustomScopeLine = () => {
    const line = customScopeLine.trim();
    if (!line) return;
    setCustomScopeLines((prev) => [...prev, line]);
    setCustomScopeLine("");
  };

  const removeCustomScopeLine = (index: number) => {
    setCustomScopeLines((prev) => prev.filter((_, i) => i !== index));
  };

  const scopeLines = [
    ...DEFAULT_SCOPE_OPTIONS.filter((option) => selectedScope.includes(option)),
    ...customScopeLines,
  ];
  const clientPresentation = {
    contentTypeLabel,
    turnaroundLabel: eta,
    complexityLabel,
    revisionsIncluded: baseRevisionsIncluded + extraRevisionRounds,
    scopeLines,
    investmentCents,
  };
  const clientQuoteText = buildClientQuoteText(clientPresentation);
  const clientQuoteMarkdown = buildClientQuoteMarkdown(clientPresentation);

  const handleCopyClientText = async () => {
    try {
      await navigator.clipboard.writeText(clientQuoteText);
      setClientCopied("text");
      setTimeout(() => setClientCopied(null), 2000);
    } catch {
      setClientCopied(null);
    }
  };

  const handleCopyClientMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(clientQuoteMarkdown);
      setClientCopied("markdown");
      setTimeout(() => setClientCopied(null), 2000);
    } catch {
      setClientCopied(null);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          ETA (shown to the client, not part of the calculation)
        </label>
        <div className="flex flex-wrap gap-2">
          {ETA_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setEta(preset)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                eta === preset
                  ? "border-violet-600 bg-violet-600/20 text-violet-200"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {preset}
            </button>
          ))}
          <input
            type="text"
            value={ETA_PRESETS.includes(eta) ? "" : eta}
            onChange={(e) => setEta(e.target.value)}
            placeholder="Custom ETA..."
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          What I will do (shown to the client)
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DEFAULT_SCOPE_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedScope.includes(option)}
                onChange={() => toggleScopeOption(option)}
                className="h-4 w-4 accent-violet-500"
              />
              {option}
            </label>
          ))}
        </div>
        {customScopeLines.length > 0 && (
          <ul className="mt-2 space-y-1">
            {customScopeLines.map((line, index) => (
              <li
                key={`${line}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300"
              >
                {line}
                <button
                  type="button"
                  onClick={() => removeCustomScopeLine(index)}
                  aria-label={`Remove ${line}`}
                  className="text-zinc-600 hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customScopeLine}
            onChange={(e) => setCustomScopeLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomScopeLine();
              }
            }}
            placeholder="Add another line..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustomScopeLine}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            Add
          </button>
        </div>
      </div>

      {/* Quick Morning Reality Patch §10: the showroom card is always
          visible now (no "Preview quote" toggle to click through) --
          screenshot-friendly by default, exactly what "Sounds good?" is
          answering. */}
      <ShowroomCard presentation={clientPresentation} />

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleCopyClientText}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {clientCopied === "text" ? "Copied ✓" : "Copy client quote"}
        </button>
        <button
          type="button"
          onClick={handleCopyClientMarkdown}
          className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          {clientCopied === "markdown" ? "Copied ✓" : "Copy as Markdown"}
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

  // Quick Morning Reality Patch (26 Aug 2026) §10: both views render
  // side by side now (see the grid below) -- no more toggle state needed
  // here. The presentation-only state (ETA, scope, copy) still lives
  // entirely in the separate ClientPresentationPanel component so it
  // can't perturb this component's existing memoization.

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

      {/* Quick Morning Reality Patch (26 Aug 2026) §10: "One engine. Two
          views" now means side by side, not a tab you have to click
          through -- Calculator | Client Quote on desktop, stacked
          Calculator then Client Quote on mobile (a plain responsive grid
          gives both for free). breakdown (computed above) still feeds
          both panels from the exact same numbers. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Calculator</p>
      <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-5">
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

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Client Quote</p>
        <ClientPresentationPanel
          contentTypeLabel={contentType.label}
          complexityLabel={complexity.label}
          baseRevisionsIncluded={A_LA_CARTE_INCLUDED_REVISION_ROUNDS}
          extraRevisionRounds={extraRevisionRounds}
          investmentCents={breakdown.totalCents}
        />
      </div>
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
