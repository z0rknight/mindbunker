"use client";

import { useState, useTransition } from "react";
import { createQuote } from "@/modules/quotes/actions";

// Extracted from crm/[id]/QuotePanel.tsx (Tuesday Patch Priority 3): the
// CRM list's mini workbench ("Create quote" quick action) needs the exact
// same compact log-a-quote form the client detail page already has --
// same fields, same createQuote action, same DRAFT-only semantics. One
// shared component instead of two copies of the same six inputs.
const inputClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none";

// House Cleaning Wave 2 §22 (RMEDIA_SYSTEM_SIMPLIFICATION_RESEARCH_2026_09.md):
// optional pre-fill, carried from Pricing Lab's "Create Quote from this
// calculation" bridge. Nothing here persists automatically -- the values
// only seed this form's own local state; the canonical quotes row is
// still only created when Emmanuel reviews and clicks Save Draft below,
// same as when he types these values in by hand.
export type QuoteCreateFormPrefill = {
  amountDollars?: string;
  currency?: string;
  contentTypeLabel?: string;
  turnaroundLabel?: string;
  revisionsIncluded?: string;
  scopeText?: string;
};

export function QuoteCreateForm({
  clientId,
  onDone,
  onCancel,
  prefill,
}: {
  clientId: number;
  onDone: () => void;
  onCancel?: () => void;
  prefill?: QuoteCreateFormPrefill;
}) {
  const [isPending, startTransition] = useTransition();
  const [amountDollars, setAmountDollars] = useState(prefill?.amountDollars ?? "");
  const [currency, setCurrency] = useState(prefill?.currency ?? "USD");
  const [contentTypeLabel, setContentTypeLabel] = useState(prefill?.contentTypeLabel ?? "");
  const [turnaroundLabel, setTurnaroundLabel] = useState(prefill?.turnaroundLabel ?? "");
  const [revisionsIncluded, setRevisionsIncluded] = useState(prefill?.revisionsIncluded ?? "2");
  const [summary, setSummary] = useState("");
  const [scopeText, setScopeText] = useState(prefill?.scopeText ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function submit() {
    setError("");
    setErrors({});
    const amountCents = Math.round((Number(amountDollars) || 0) * 100);
    startTransition(async () => {
      const result = await createQuote({
        clientId,
        amountCents,
        currency,
        contentTypeLabel,
        turnaroundLabel,
        revisionsIncluded: Number(revisionsIncluded) || 0,
        summary,
        scopeText,
      });
      if (!result.success) {
        setError(result.error);
        setErrors(result.errors ?? {});
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[10px] text-zinc-500">
        Log a quote you already calculated in Pricing Lab -- this doesn&apos;t compute a
        price, it just records one.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={contentTypeLabel}
          onChange={(e) => setContentTypeLabel(e.target.value)}
          placeholder="Content type (e.g. Short-form video for landing page)"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="Amount ($)"
          className={inputClass}
        />
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="Currency (USD)"
          className={inputClass}
        />
        <input
          type="text"
          value={turnaroundLabel}
          onChange={(e) => setTurnaroundLabel(e.target.value)}
          placeholder="ETA (e.g. 24h)"
          className={inputClass}
        />
        <input
          type="number"
          min="0"
          step="1"
          value={revisionsIncluded}
          onChange={(e) => setRevisionsIncluded(e.target.value)}
          placeholder="Revisions included"
          className={inputClass}
        />
      </div>
      <textarea
        value={scopeText}
        onChange={(e) => setScopeText(e.target.value)}
        placeholder={"What I will do (one line per deliverable)\ne.g.\nColor correction\nAudio adjustment\nCaptions"}
        rows={3}
        className={`w-full ${inputClass}`}
      />
      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary (optional)"
        className={`w-full ${inputClass}`}
      />
      {Object.values(errors).map((message, index) => (
        <p key={index} className="text-xs text-red-300">
          {message}
        </p>
      ))}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isPending ? "Logging…" : "Log quote (DRAFT)"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
