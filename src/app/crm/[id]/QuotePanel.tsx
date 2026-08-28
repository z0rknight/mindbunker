"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createProductionFromQuote,
  createQuote,
  updateQuoteStatus,
} from "@/modules/quotes/actions";

// Client Service Reality Patch (25 Aug 2026) -- Quote Approval (brief §6).
// V1 is manual: Emmanuel logs a quote from a Pricing Lab calculation he
// already ran, moves it DRAFT -> SENT -> APPROVED/DECLINED by hand, and
// -- once APPROVED -- clicks one action to create the linked
// Project/Video via the canonical creation actions
// (createProductionFromQuote). No e-signature, no client-facing approve
// button, no second pricing engine here: amountCents is typed in from
// what Pricing Lab already computed.

export type QuotePanelRow = {
  id: number;
  status: string;
  currency: string;
  amountCents: number;
  contentTypeLabel: string;
  turnaroundLabel: string;
  revisionsIncluded: number;
  scopeText: string;
  projectId: number | null;
  videoId: number | null;
  createdAt: string | null;
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  SENT: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  DECLINED: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatAmount(amountCents: number, currency: string): string {
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

function ProductionForm({ quoteId, onDone }: { quoteId: number; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projectName, setProjectName] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    startTransition(async () => {
      const result = await createProductionFromQuote(quoteId, { projectName, videoTitle });
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
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      <input
        type="text"
        value={videoTitle}
        onChange={(e) => setVideoTitle(e.target.value)}
        placeholder="Video title"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !projectName.trim() || !videoTitle.trim()}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Creating…" : "Create production work"}
      </button>
    </div>
  );
}

function QuoteRow({ quote }: { quote: QuotePanelRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showProductionForm, setShowProductionForm] = useState(false);

  const transition = (nextStatus: string) => {
    setError("");
    startTransition(async () => {
      const result = await updateQuoteStatus(quote.id, nextStatus);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const hasProduction = quote.projectId !== null && quote.videoId !== null;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_CLASSES[quote.status] ?? STATUS_CLASSES.DRAFT}`}
          >
            {quote.status}
          </span>
          <p className="mt-1.5 text-sm font-semibold text-white">{quote.contentTypeLabel}</p>
          <p className="text-xs text-zinc-500">
            {formatAmount(quote.amountCents, quote.currency)} · {quote.turnaroundLabel} · {quote.revisionsIncluded} revision
            {quote.revisionsIncluded === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quote.status === "DRAFT" && (
            <>
              <button
                type="button"
                onClick={() => transition("SENT")}
                disabled={isPending}
                className="rounded-lg border border-cyan-700/50 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
              >
                Mark sent
              </button>
              <button
                type="button"
                onClick={() => transition("DECLINED")}
                disabled={isPending}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}
          {quote.status === "SENT" && (
            <>
              <button
                type="button"
                onClick={() => transition("APPROVED")}
                disabled={isPending}
                className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
              >
                Mark approved
              </button>
              <button
                type="button"
                onClick={() => transition("DECLINED")}
                disabled={isPending}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}
        </div>
      </div>

      {quote.status === "APPROVED" && !hasProduction && (
        <div className="mt-2">
          {!showProductionForm ? (
            <button
              type="button"
              onClick={() => setShowProductionForm(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
            >
              Create production work
            </button>
          ) : (
            <ProductionForm quoteId={quote.id} onDone={() => setShowProductionForm(false)} />
          )}
        </div>
      )}

      {hasProduction && (
        <Link
          href={`/projects/${quote.projectId}`}
          className="mt-2 inline-block text-[11px] font-bold text-violet-300 hover:text-violet-200"
        >
          View production work →
        </Link>
      )}

      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </li>
  );
}

export function QuotePanel({ clientId, quotes }: { clientId: number; quotes: QuotePanelRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [amountDollars, setAmountDollars] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contentTypeLabel, setContentTypeLabel] = useState("");
  const [turnaroundLabel, setTurnaroundLabel] = useState("");
  const [revisionsIncluded, setRevisionsIncluded] = useState("2");
  const [summary, setSummary] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const submit = () => {
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
      setShowCreateForm(false);
      setAmountDollars("");
      setContentTypeLabel("");
      setTurnaroundLabel("");
      setRevisionsIncluded("2");
      setSummary("");
      setScopeText("");
      router.refresh();
    });
  };

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Quotes</p>
        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="min-h-9 rounded-xl border border-zinc-700 px-3 text-xs font-black text-zinc-300 transition hover:bg-zinc-800"
        >
          {showCreateForm ? "Cancel" : "+ Log a quote"}
        </button>
      </div>

      {showCreateForm && (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
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
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none sm:col-span-2"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              placeholder="Amount ($)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="Currency (USD)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
            <input
              type="text"
              value={turnaroundLabel}
              onChange={(e) => setTurnaroundLabel(e.target.value)}
              placeholder="ETA (e.g. 24h)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={revisionsIncluded}
              onChange={(e) => setRevisionsIncluded(e.target.value)}
              placeholder="Revisions included"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            placeholder={"What I will do (one line per deliverable)\ne.g.\nColor correction\nAudio adjustment\nCaptions"}
            rows={3}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary (optional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          {Object.values(errors).map((message, index) => (
            <p key={index} className="text-xs text-red-300">
              {message}
            </p>
          ))}
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isPending ? "Logging…" : "Log quote (DRAFT)"}
          </button>
        </div>
      )}

      {quotes.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-600">No quotes logged for this client yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {quotes.map((quote) => (
            <QuoteRow key={quote.id} quote={quote} />
          ))}
        </ul>
      )}
    </section>
  );
}
