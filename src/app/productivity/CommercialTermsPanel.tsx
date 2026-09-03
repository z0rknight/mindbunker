"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createManualApprovedQuoteForVideo,
  getCommercialTermsForVideo,
  getLinkableContractsForVideo,
  type CommercialTerms,
  type CommercialContractRow,
} from "@/modules/quotes/actions";
import { setVideoContract } from "@/modules/productivity/actions";
import {
  RECURRING_SCOPE_OPTIONS,
  computeOperationalEffectiveRateCents,
  toggleScopeLine,
} from "@/modules/quotes/core";
import { formatCurrency } from "@/utils/date";

function formatQuoteCurrency(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

// Post-Job Commercial + Delivery Sniper §4/§1: compact "Link contract"
// affordance for a video with no commercial terms yet but whose client
// already has an HOURLY contract on file (e.g. a second Meta Ads-style
// video for a client whose contract predates this column, or a client
// with more than one contract where the legacy single-active inference
// is ambiguous). Self-fetches the client's own contracts only --
// setVideoContract re-validates same-client server-side regardless.
function LinkContractControl({ videoId, onLinked }: { videoId: number; onLinked: () => void }) {
  const [contracts, setContracts] = useState<CommercialContractRow[] | null>(null);
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLinkableContractsForVideo(videoId).then((rows) => {
      if (active) setContracts(rows);
    });
    return () => {
      active = false;
    };
  }, [videoId]);

  if (!contracts || contracts.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
      >
        <option value="">Link an existing contract…</option>
        {contracts.map((contract) => (
          <option key={contract.id} value={contract.id}>
            {contract.platform} · {contract.billingType}
            {contract.billingType === "HOURLY" && contract.hourlyRate !== null
              ? ` (${contract.currency} ${contract.hourlyRate}/h)`
              : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setVideoContract(videoId, Number(selected));
            if (!result.success) {
              setError(result.error);
              return;
            }
            onLinked();
          })
        }
        className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-black text-white disabled:opacity-40"
      >
        Link
      </button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "0m";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Reality Closure (26 Aug 2026): Dave's fixed $100 landing page had its
// commercial agreement pasted into Notes -- wrong ownership. This panel
// is the structured replacement, covering both billing shapes the brief
// distinguishes: FIXED (backed by a `quotes` row) and HOURLY (backed by
// the client's commercial_contracts row + Upwork billing_evidence).
// Self-fetches on mount, same pattern as the panel it replaces
// (ApprovedQuotePanel) and VideoMemoryPanel before it.
function ManualTermsForm({ videoId, onDone }: { videoId: number; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contentTypeLabel, setContentTypeLabel] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [turnaroundLabel, setTurnaroundLabel] = useState("");
  const [revisionsIncluded, setRevisionsIncluded] = useState("2");
  const [scopeText, setScopeText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createManualApprovedQuoteForVideo(videoId, {
        contentTypeLabel,
        amountCents: Math.round((Number(amountDollars) || 0) * 100),
        currency: "USD",
        turnaroundLabel,
        revisionsIncluded: Number(revisionsIncluded) || 0,
        scopeText,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-3">
      <p className="text-[11px] text-zinc-500">
        Records this as an already-approved commercial agreement -- for a deal struck
        outside the quote flow. No lead, no draft/send step.
      </p>
      <input
        type="text"
        value={contentTypeLabel}
        onChange={(e) => setContentTypeLabel(e.target.value)}
        placeholder="Content type (e.g. Short-form video for landing page)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="Agreed price ($)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        <input
          type="text"
          value={turnaroundLabel}
          onChange={(e) => setTurnaroundLabel(e.target.value)}
          placeholder="ETA (e.g. 24h)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>
      <input
        type="number"
        value={revisionsIncluded}
        onChange={(e) => setRevisionsIncluded(e.target.value)}
        placeholder="Revisions included"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      {/* Quick Morning Reality Patch §8: recurring scope checkboxes --
          purely a convenience over the same scopeText field below. Each
          checkbox's checked state is derived straight from scopeText
          (is this exact line present?), so it can never drift out of sync
          with whatever's been typed by hand. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {RECURRING_SCOPE_OPTIONS.map((option) => {
          const checked = scopeText
            .split("\n")
            .some((line) => line.trim().toLowerCase() === option.toLowerCase());
          return (
            <label key={option} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setScopeText((current) => toggleScopeLine(current, option, e.target.checked))}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900"
              />
              {option}
            </label>
          );
        })}
      </div>
      <textarea
        value={scopeText}
        onChange={(e) => setScopeText(e.target.value)}
        placeholder={"What was agreed (one line per deliverable)\ne.g.\nColor correction\nAudio adjustment"}
        rows={3}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Record approved commercial terms"}
      </button>
    </div>
  );
}

export function CommercialTermsPanel({ videoId }: { videoId: number }) {
  const [terms, setTerms] = useState<CommercialTerms | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const refetch = () => {
    getCommercialTermsForVideo(videoId).then(setTerms);
  };

  useEffect(() => {
    let active = true;
    getCommercialTermsForVideo(videoId).then((result) => {
      if (active) setTerms(result);
    });
    return () => {
      active = false;
    };
  }, [videoId]);

  if (!terms) return null;

  if (terms.billingModel === "NONE") {
    return (
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Commercial terms
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
            >
              + Add commercial terms
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-600">No commercial terms recorded for this video yet.</p>
        <LinkContractControl
          videoId={videoId}
          onLinked={() => {
            refetch();
            router.refresh();
          }}
        />
        {showForm && (
          <ManualTermsForm videoId={videoId} onDone={() => setShowForm(false)} />
        )}
      </div>
    );
  }

  if (terms.billingModel === "FIXED") {
    // First Sale Economics (26 Aug 2026): call the same pure, tested
    // helper the rest of the app derives this from -- this panel used to
    // recompute the identical formula inline, a second copy of the same
    // math that could silently drift from the tested one. Never stored;
    // recomputed fresh from terms.trackedSeconds every render, which
    // itself comes fresh from getCommercialTermsForVideo on every fetch
    // -- so this updates automatically as tracked time grows, with
    // nothing to invalidate or cache.
    const effectiveRateCents = computeOperationalEffectiveRateCents(
      terms.agreedPriceCents,
      terms.trackedSeconds,
    );
    const scopeLines = terms.scopeText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return (
      <div className="mb-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
            Commercial terms · Fixed
          </span>
          <span className="text-xs text-zinc-500">Source: {terms.source}</span>
        </div>
        <p className="mt-2 text-sm font-bold text-white">
          Agreed price: {formatQuoteCurrency(terms.agreedPriceCents, terms.currency)}
        </p>
        {/* Quick Morning Reality Patch §9: RECEIVED is never derived here --
            transactions/billingEvidence carry no per-video link, so
            attributing a payment to this one video would mean guessing.
            Shown honestly as "—" rather than silently omitted, so nobody
            reads the missing line as "paid in full." */}
        <p className="text-xs text-zinc-500">Received: —</p>
        <p className="text-xs text-zinc-500">
          ETA {terms.turnaroundLabel} · {terms.revisionsIncluded} revision
          {terms.revisionsIncluded === 1 ? "" : "s"}
        </p>
        {scopeLines.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {scopeLines.map((line, index) => (
              <li key={index} className="text-xs text-zinc-400">
                &bull; {line}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-emerald-900/40 pt-3">
          <p className="text-xs text-zinc-500">
            Tracked production time: {formatDuration(terms.trackedSeconds)}
          </p>
          <p className="text-xs text-zinc-500">
            Operational effective rate:{" "}
            {effectiveRateCents === null
              ? "—"
              : formatQuoteCurrency(Math.round(effectiveRateCents), terms.currency) + "/h"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-700">
            Agreed price ÷ tracked time. Not revenue, not billed, not paid on its own.
          </p>
        </div>
      </div>
    );
  }

  // HOURLY -- Post-Job Commercial + Delivery Sniper §2: terms.estimatedAccruedValue
  // is now computed by the ONE canonical function (computeRateEquivalent,
  // modules/finance/core.ts) inside getCommercialTermsForVideo itself.
  // This panel used to recompute (trackedSeconds/3600)*hourlyRate inline
  // -- a second, unrounded copy of the same math that could silently
  // drift from the canonical one (e.g. never applying round2). Rendering
  // terms.estimatedAccruedValue directly closes that gap.
  return (
    <div className="mb-6 rounded-xl border border-cyan-700/40 bg-cyan-950/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-300">
          Commercial terms · Hourly
        </span>
        <span className="text-xs text-zinc-500">{terms.platform} contract</span>
        <span className="text-[10px] text-zinc-700">
          ({terms.attribution === "VIDEO_CONTRACT"
            ? "linked to this video"
            : terms.attribution === "PROJECT_CONTRACT"
              ? "linked to this project"
              : "inferred: client's only active contract"})
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-white">
        Contract rate: {formatCurrency(terms.hourlyRate, terms.currency)}/h
      </p>
      <div className="mt-3 border-t border-cyan-900/40 pt-3 space-y-1">
        <p className="text-xs text-zinc-500">
          Tracked production time: {formatDuration(terms.trackedSeconds)}
        </p>
        <p className="text-xs text-zinc-500">
          Estimated accrued value:{" "}
          <span className="font-bold text-emerald-300">
            {formatCurrency(terms.estimatedAccruedValue, terms.currency)}
          </span>
        </p>
        <p className="text-[10px] text-zinc-700">
          Tracked time x contract rate. Not revenue, not billed, not paid on its own.
        </p>
        {terms.upworkBilledTotal !== null ? (
          <>
            <p className="text-xs text-zinc-500">
              {terms.platform} billed (contract total on file, {terms.upworkEvidenceCount} period
              {terms.upworkEvidenceCount === 1 ? "" : "s"}):{" "}
              {formatCurrency(terms.upworkBilledTotal, terms.upworkBilledCurrency ?? terms.currency)}
            </p>
            <p className="text-[10px] text-zinc-700">
              Contract-level total, not scoped to this video alone -- an audit comparison, not a
              per-video reconciliation.
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-700">No {terms.platform} billing evidence on file yet.</p>
        )}
        <p className="mt-1 text-[10px] text-zinc-700">
          Operational time is tracked separately from billed/paid revenue -- neither figure above
          is automatically &quot;earned&quot;.
        </p>
      </div>
    </div>
  );
}
