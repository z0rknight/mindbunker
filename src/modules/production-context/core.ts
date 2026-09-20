// Production Context (Production Operations Consolidation, Sep 19).
//
// A READ-ONLY view that gathers, in one place, the facts an editor needs to
// restart a job -- all of which ALREADY exist as canonical fields:
//   batch notes      -> production_orders.notes
//   project notes    -> projects.notes (where source / cut-sheet links live today)
//   source media     -> source_media_references (project level)
//   review / delivery-> video_logs.review_url / delivery_url / published_url
//   reusable formats -> client_production_memory (names only; details stay in
//                       their own read-only surfaces)
// Nothing here is stored, copied or duplicated: the builder only selects and
// labels what the caller derived. A fact that is not recorded produces NO row
// (no empty placeholders); if there is no source/notes context at all, the
// block says so once, honestly. There is no "cut sheet" row on purpose: no
// field means "cut sheet", so pretending one exists would invent a fact.

export type ContextSourceReference = {
  id: number;
  location: string | null;
  profile: string | null;
  approxSizeLabel: string | null;
  sourceUrl: string | null;
  notes: string | null;
};

export type ProductionContextInput = {
  batch: { id: number; label: string; notes: string | null } | null;
  project: { id: number; name: string; notes: string | null } | null;
  sources: ContextSourceReference[];
  /** Video scope only. Order scope passes null (deliverables carry their own). */
  video: { reviewUrl: string | null; deliveryUrl: string | null; publishedUrl: string | null } | null;
  formatNames: string[];
};

export type ProductionContextRow =
  | { key: "batch-notes"; label: "Batch notes"; text: string }
  | { key: "project-notes"; label: "Project notes"; text: string }
  | { key: "source"; label: "Source"; references: ContextSourceReference[] }
  | { key: "review"; label: "Review"; url: string }
  | { key: "delivery"; label: "Delivery"; url: string }
  | { key: "published"; label: "Published"; url: string }
  | { key: "formats"; label: "Formats"; names: string[] };

export type ProductionContext = {
  rows: ProductionContextRow[];
  /** True when there is no source/notes context at all (block says so once). */
  noSourceContext: boolean;
};

function present(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function buildProductionContext(input: ProductionContextInput): ProductionContext {
  const rows: ProductionContextRow[] = [];

  const batchNotes = present(input.batch?.notes);
  if (batchNotes) rows.push({ key: "batch-notes", label: "Batch notes", text: batchNotes });

  const projectNotes = present(input.project?.notes);
  if (projectNotes) rows.push({ key: "project-notes", label: "Project notes", text: projectNotes });

  const references = input.sources.filter(
    (ref) => present(ref.location) || present(ref.sourceUrl) || present(ref.profile) || present(ref.approxSizeLabel) || present(ref.notes),
  );
  if (references.length > 0) rows.push({ key: "source", label: "Source", references });

  if (input.video) {
    const review = present(input.video.reviewUrl);
    if (review) rows.push({ key: "review", label: "Review", url: review });
    const delivery = present(input.video.deliveryUrl);
    if (delivery) rows.push({ key: "delivery", label: "Delivery", url: delivery });
    const published = present(input.video.publishedUrl);
    if (published) rows.push({ key: "published", label: "Published", url: published });
  }

  const formatNames = input.formatNames.map((name) => name.trim()).filter(Boolean);
  if (formatNames.length > 0) rows.push({ key: "formats", label: "Formats", names: formatNames });

  const noSourceContext = !rows.some((row) => row.key === "batch-notes" || row.key === "project-notes" || row.key === "source");
  return { rows, noSourceContext };
}

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_PATTERN = /https:\/\/[^\s<>"']+/gu;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/u;

/**
 * Makes the https links that already sit in free-text notes clickable, without
 * changing the text. Only well-formed HTTPS URLs without credentials become
 * links; everything else stays plain text.
 */
export function linkifyText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const candidate = trailing ? raw.slice(0, -trailing.length) : raw;
    let href: string | null = null;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && url.hostname && !url.username && !url.password) href = url.toString();
    } catch {
      href = null;
    }
    if (!href) continue;
    if (start > cursor) parts.push({ type: "text", value: text.slice(cursor, start) });
    parts.push({ type: "link", value: candidate, href });
    cursor = start + candidate.length;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

/** A safe link from a video workspace to its Production Order that returns to that video. */
export function batchLinkFromVideo(orderId: number, videoWorkspaceHref: string): string {
  return `/productivity/orders/${orderId}?returnTo=${encodeURIComponent(videoWorkspaceHref)}`;
}
