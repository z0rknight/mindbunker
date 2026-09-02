"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelDecision,
  recordDecision,
  recordDecisionResult,
  type OpenDecisionRow,
} from "@/modules/decisions/actions";

// Operator Intelligence Patch Phase 5: SIGNAL -> DECISION -> RESULT.
// "Record decision" pre-fills the signal's own factual context (video,
// client, project) -- the operator still types the decision itself; this
// never auto-writes one from the signal text.
export function RecordDecisionButton({
  signalType,
  context,
}: {
  signalType: string;
  context: { videoId?: number; clientId?: number; projectId?: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState("");
  const [reviewAt, setReviewAt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await recordDecision({
        signalType,
        videoId: context?.videoId ?? null,
        clientId: context?.clientId ?? null,
        projectId: context?.projectId ?? null,
        decision,
        reviewAt: reviewAt || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDecision("");
      setReviewAt("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-center text-xs font-bold text-zinc-400 hover:border-violet-500 hover:text-violet-200"
      >
        Record decision
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-lg border border-violet-700/40 bg-zinc-950/70 p-3 sm:w-72">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Decision
      </label>
      <textarea
        value={decision}
        onChange={(event) => setDecision(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder="What are you going to do about this?"
        className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-500"
        autoFocus
      />
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Review on
      </label>
      <input
        type="date"
        value={reviewAt}
        onChange={(event) => setReviewAt(event.target.value)}
        className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-500"
      />
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !decision.trim()}
          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function OpenDecisionCard({ decision }: { decision: OpenDecisionRow }) {
  const router = useRouter();
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submitResult(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const outcome = await recordDecisionResult(decision.id, result);
      if (!outcome.success) {
        setError(outcome.error);
        return;
      }
      router.refresh();
    });
  }

  function cancel() {
    setError("");
    startTransition(async () => {
      const outcome = await cancelDecision(decision.id);
      if (!outcome.success) setError(outcome.error);
      else router.refresh();
    });
  }

  const context = [decision.clientName, decision.projectName, decision.videoTitle].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {decision.signalType && (
          <span className="rounded-full border border-violet-700/40 bg-violet-950/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-300">
            {decision.signalType}
          </span>
        )}
        {decision.reviewAt && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Review {new Date(decision.reviewAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-bold text-white">{decision.decision}</p>
      {context && <p className="mt-0.5 text-xs text-zinc-500">{context}</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      {resultOpen ? (
        <form onSubmit={submitResult} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={result}
            onChange={(event) => setResult(event.target.value)}
            maxLength={1000}
            placeholder="What happened?"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={isPending || !result.trim()}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            Save result
          </button>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setResultOpen(true)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-violet-500 hover:text-violet-200"
          >
            Record result
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:border-red-700 hover:text-red-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
