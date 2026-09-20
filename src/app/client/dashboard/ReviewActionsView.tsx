import type { Ref } from "react";
import { ActionButton, UpdateFlash } from "@/components/os";
import {
  isAcknowledged,
  reviewAcknowledgement,
  reviewAnnouncement,
  type ReviewState,
  type ReviewTarget,
} from "@/modules/client-portal/review-flow";

// Presentation for the client review controls (Train M2). It renders whatever
// state it is given; the container (ReviewActions) owns the canonical action.
// A persistent polite live region announces the outcome; the visible
// acknowledgement appears only after the server confirmed.
export function ReviewActionsView({
  state,
  showHint = false,
  onDecide,
  ackRef,
}: {
  state: ReviewState;
  showHint?: boolean;
  onDecide: (target: ReviewTarget) => void;
  ackRef?: Ref<HTMLDivElement>;
}) {
  const submitting = state.phase === "submitting";
  const ack = reviewAcknowledgement(state);
  const acknowledged = isAcknowledged(state);
  return (
    <UpdateFlash
      as="div"
      changeKey={acknowledged}
      tone="success"
      className="mt-1 space-y-1.5 rounded-xl"
      data-review-phase={state.phase}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {reviewAnnouncement(state)}
      </p>
      {ack ? (
        <div
          ref={ackRef}
          tabIndex={-1}
          className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left outline-none"
        >
          <svg className="os-ck mt-0.5 text-emerald-300" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
          <div>
            <p className="text-xs font-bold text-emerald-200">{ack.title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">{ack.detail}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <ActionButton
              onClick={() => onDecide("DONE")}
              pending={submitting && state.target === "DONE"}
              aria-disabled={submitting ? true : undefined}
              aria-describedby={showHint ? "review-hint" : undefined}
              className="min-h-10 flex-1 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-500"
            >
              Approve
            </ActionButton>
            <ActionButton
              onClick={() => onDecide("CHANGES_REQUESTED")}
              pending={submitting && state.target === "CHANGES_REQUESTED"}
              aria-disabled={submitting ? true : undefined}
              aria-describedby={showHint ? "review-hint" : undefined}
              className="min-h-10 flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-black text-amber-200 transition hover:bg-amber-500/20"
            >
              Request changes
            </ActionButton>
          </div>
          {showHint && (
            <p id="review-hint" className="text-[11px] text-zinc-500">
              Approving confirms this video is complete. Delivery is a separate step.
            </p>
          )}
          {state.error && (
            <p role="alert" className="text-[11px] text-red-300">
              {state.error}
            </p>
          )}
        </>
      )}
    </UpdateFlash>
  );
}
