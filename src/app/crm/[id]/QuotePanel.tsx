"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createProductionFromQuote,
  updateQuoteStatus,
} from "@/modules/quotes/actions";
import { QuoteCreateForm } from "@/components/crm/QuoteCreateForm";
import { QuickFollowUpForm } from "@/components/crm/QuickFollowUpForm";
import { createVideoCommitment } from "@/modules/video-operations/actions";

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

// Tuesday Patch Completion Round §E: "schedule a call with a lead about a
// quote" -- the resulting action must preserve enough context that it
// isn't just "Call Shelley." If the quote already has production (a
// video), the call is scoped to that video via the existing commitments
// primitive (same as §D) -- it then shows up on that video's own Promise
// & delivery list and the cross-surface commitment card for free. Before
// production exists there is no video to attach a commitment to, so this
// falls back to the client-level next-action fact (QuickFollowUpForm),
// with the quote's own content type + amount baked into the prefilled
// text so the context survives even in that single-value field.
function ScheduleQuoteCall({
  quote,
  clientId,
  clientName,
  currentStage,
  currentServiceInterest,
  currentQualificationNotes,
  onDone,
}: {
  quote: QuotePanelRow;
  clientId: number;
  clientName: string;
  currentStage: string;
  currentServiceInterest: string | null;
  currentQualificationNotes: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const quoteContext = `${quote.contentTypeLabel} (${formatAmount(quote.amountCents, quote.currency)})`;

  if (quote.videoId !== null) {
    return (
      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <p className="text-xs text-zinc-400">Call about: {clientName} — {quoteContext}</p>
        <input
          aria-label="Call due date"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-white outline-none focus:border-violet-500"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending || !dueAt}
            onClick={() => {
              setError("");
              const parsed = new Date(dueAt);
              if (Number.isNaN(parsed.getTime())) {
                setError("Choose a valid date and time.");
                return;
              }
              startTransition(async () => {
                const result = await createVideoCommitment({
                  videoId: quote.videoId!,
                  title: `Call ${clientName} — ${quoteContext}`,
                  dueAt: parsed.toISOString(),
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                router.refresh();
                onDone();
              });
            }}
            className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Schedule call"}
          </button>
          <button type="button" disabled={isPending} onClick={onDone} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <QuickFollowUpForm
      clientId={clientId}
      currentStage={currentStage}
      currentServiceInterest={currentServiceInterest}
      currentQualificationNotes={currentQualificationNotes}
      initialNextAction={`Call about quote — ${quoteContext}`}
      onDone={() => {
        router.refresh();
        onDone();
      }}
      onCancel={onDone}
    />
  );
}

function QuoteRow({
  quote,
  clientId,
  clientName,
  currentStage,
  currentServiceInterest,
  currentQualificationNotes,
}: {
  quote: QuotePanelRow;
  clientId: number;
  clientName: string;
  currentStage: string;
  currentServiceInterest: string | null;
  currentQualificationNotes: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);

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
    <li id={`quote-${quote.id}`} className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
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
          {quote.status !== "DECLINED" && (
            <button
              type="button"
              onClick={() => setShowScheduleCall((prev) => !prev)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-zinc-800"
            >
              📞 Schedule call
            </button>
          )}
        </div>
      </div>

      {showScheduleCall && (
        <div className="mt-2">
          <ScheduleQuoteCall
            quote={quote}
            clientId={clientId}
            clientName={clientName}
            currentStage={currentStage}
            currentServiceInterest={currentServiceInterest}
            currentQualificationNotes={currentQualificationNotes}
            onDone={() => setShowScheduleCall(false)}
          />
        </div>
      )}

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

export function QuotePanel({
  clientId,
  clientName,
  currentStage,
  currentServiceInterest,
  currentQualificationNotes,
  quotes,
}: {
  clientId: number;
  clientName: string;
  currentStage: string;
  currentServiceInterest: string | null;
  currentQualificationNotes: string | null;
  quotes: QuotePanelRow[];
}) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);

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
        <div className="mt-3">
          <QuoteCreateForm
            clientId={clientId}
            onDone={() => {
              setShowCreateForm(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {quotes.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-600">No quotes logged for this client yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {quotes.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              clientId={clientId}
              clientName={clientName}
              currentStage={currentStage}
              currentServiceInterest={currentServiceInterest}
              currentQualificationNotes={currentQualificationNotes}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
