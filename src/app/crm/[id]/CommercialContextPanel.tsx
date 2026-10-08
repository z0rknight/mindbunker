"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCommercialOffer } from "@/modules/commercial-operating/actions";
import { COMMERCIAL_OFFER_LABELS, COMMERCIAL_OFFER_TYPES, type CommercialOfferType } from "@/modules/quotes/config";

type Intake = {
  referralSource: string | null;
  acquisitionContext?: { entryContext: string | null; landingSource: string | null; offerContext: string | null; offerRef: string | null; rawRef: string | null };
  whatTheyWant: string;
  relationshipShape: string;
  readiness: string;
  timing: string;
  approvalOwner?: string;
  budgetReadiness?: string;
  desiredOutcome?: string | null;
  suggestedOffer?: string;
  leadIntentEvidence: string[];
};

export function CommercialContextPanel({ clientId, intake, decision }: {
  clientId: number;
  intake: Intake | null;
  decision: { offerType: CommercialOfferType; reason: string | null; decidedAt: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [offerType, setOfferType] = useState<CommercialOfferType>(decision?.offerType ?? "NEEDS_DISCOVERY");
  const [reason, setReason] = useState(decision?.reason ?? "");
  const [feedback, setFeedback] = useState("");

  const acquisition = intake?.acquisitionContext;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Commercial reading</p>
          <h2 className="mt-1 text-lg font-black text-white">Evidence → suggestion → human decision</h2>
        </div>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
          {decision ? "Human confirmed" : "Awaiting decision"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Acquisition context</p>
          <p className="mt-2 text-sm font-bold text-zinc-200">{acquisition?.landingSource || acquisition?.entryContext || intake?.referralSource || "Unknown entry"}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Offer context: {acquisition?.offerContext || "not supplied"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">User evidence</p>
          <p className="mt-2 text-sm font-bold text-zinc-200">{intake?.desiredOutcome || intake?.whatTheyWant || "No guided intake yet"}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{intake ? `${intake.relationshipShape} · ${intake.readiness} · ${intake.timing}` : "Outcome, readiness and timing remain unknown."}</p>
          {intake && <p className="mt-1 text-xs leading-5 text-zinc-500">Budget: {intake.budgetReadiness || "not asked"} · Approval: {intake.approvalOwner || "unknown"}</p>}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Derived suggestion</p>
          <p className="mt-2 text-sm font-bold text-zinc-200">{intake?.suggestedOffer || "Needs discovery"}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">A suggestion is evidence support, never the commercial decision.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        <select value={offerType} onChange={(event) => setOfferType(event.target.value as CommercialOfferType)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white">
          {COMMERCIAL_OFFER_TYPES.map((value) => <option key={value} value={value}>{COMMERCIAL_OFFER_LABELS[value]}</option>)}
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Why this fits / what is still unknown (optional)" className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600" />
        <button type="button" disabled={isPending} onClick={() => {
          setFeedback("");
          startTransition(async () => {
            const result = await confirmCommercialOffer(clientId, offerType, reason);
            setFeedback(result.success ? result.message : result.error);
            if (result.success) router.refresh();
          });
        }} className="min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-black text-white hover:bg-cyan-500 disabled:opacity-60">{isPending ? "Saving…" : "Confirm Offer fit"}</button>
      </div>
      {decision && <p className="mt-3 text-xs text-zinc-500">Latest human decision: {COMMERCIAL_OFFER_LABELS[decision.offerType]} · {new Date(decision.decidedAt).toLocaleString()}</p>}
      {feedback && <p className="mt-2 text-xs text-zinc-400">{feedback}</p>}
    </section>
  );
}
