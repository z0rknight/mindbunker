// Delivery presentation state (Train M2). Delivery is its own fact -- a
// delivery link exists -- and is neither implied by approval (DONE) nor does
// it imply approval. This only decides whether the client detail page shows
// the delivery panel and which link it owns; it derives no status.

import type { VideoStatus } from "../productivity/config.ts";

export function deliveryPanelState(input: {
  status: VideoStatus;
  publishedUrl: string | null;
  /** The href of the page's generic primary link (review > published > delivery), if any. */
  primaryHref: string | null;
  deliveryUrl: string | null;
}): { show: boolean; href: string | null } {
  // Only for completed videos, and only when a published link is not already the primary action.
  if (input.status !== "DONE" || input.publishedUrl) return { show: false, href: null };
  if (input.primaryHref !== null && input.primaryHref !== input.deliveryUrl) return { show: false, href: null };
  return { show: true, href: input.deliveryUrl && input.primaryHref === input.deliveryUrl ? input.deliveryUrl : null };
}
