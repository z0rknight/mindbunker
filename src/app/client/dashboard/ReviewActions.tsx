"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useTransition } from "react";
import { useAction } from "@/components/os";
import { transitionVideoStatusAsClient } from "@/modules/productivity/actions";
import type { VideoStatus } from "@/modules/productivity/config";
import {
  INITIAL_REVIEW_STATE,
  REVIEW_ERROR_FALLBACK,
  isAcknowledged,
  reviewReducer,
  type ReviewTarget,
} from "@/modules/client-portal/review-flow";
import { ReviewActionsView } from "./ReviewActionsView";

/**
 * Client review controls (M2). The canonical mutation is unchanged:
 * `transitionVideoStatusAsClient` (READY_FOR_REVIEW -> DONE / CHANGES_REQUESTED).
 * The UI never shows an outcome before the server answers: `submitting` is a
 * pending state only, "Approved" appears from `result.success`, and a failure
 * returns to the ready state with the server's message beside the buttons.
 * Renders nothing unless the SERVER says the video is READY_FOR_REVIEW, or this
 * component already holds a server-confirmed outcome (so the acknowledgement
 * survives the revalidation that turns the video DONE).
 *
 * `holdRefreshMs`: dashboard cards leave the "Needs your attention" list once
 * revalidated, so they hold the refresh briefly to let the acknowledgement be
 * seen; the detail page refreshes immediately.
 */
export function ReviewActions({
  videoId,
  status,
  holdRefreshMs = 0,
  showHint = false,
}: {
  videoId: number;
  status: VideoStatus;
  holdRefreshMs?: number;
  showHint?: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [state, dispatch] = useReducer(reviewReducer, INITIAL_REVIEW_STATE);
  const decide = useAction((target: ReviewTarget) => transitionVideoStatusAsClient(videoId, target));
  const ackRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acknowledged = isAcknowledged(state);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  // The buttons unmount on success: move focus to the acknowledgement instead of dropping it.
  useEffect(() => {
    if (acknowledged) ackRef.current?.focus({ preventScroll: true });
  }, [acknowledged]);

  async function onDecide(target: ReviewTarget) {
    if (busy.current || state.phase !== "ready") return;
    busy.current = true;
    dispatch({ type: "submit", target });
    let result: Awaited<ReturnType<typeof transitionVideoStatusAsClient>>;
    try {
      result = await decide.run(target);
    } catch {
      busy.current = false;
      dispatch({ type: "failed", error: REVIEW_ERROR_FALLBACK });
      return;
    }
    if (!result.success) {
      busy.current = false;
      dispatch({ type: "failed", error: result.error || REVIEW_ERROR_FALLBACK });
      return;
    }
    dispatch({ type: "succeeded" });
    const refresh = () => startRefresh(() => router.refresh());
    if (holdRefreshMs > 0) refreshTimer.current = setTimeout(refresh, holdRefreshMs);
    else refresh();
  }

  if (!acknowledged && status !== "READY_FOR_REVIEW") return null;
  return <ReviewActionsView state={state} showHint={showHint} onDecide={onDecide} ackRef={ackRef} />;
}
