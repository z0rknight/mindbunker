"use client";

import Link from "next/link";
import { VideoStatusBadge } from "@/components/ui/VideoStatusBadge";
import { formatDate } from "@/utils/date";
import type { VideoStatus } from "@/modules/productivity/config";
import { resolveCoverUrl } from "@/modules/media/core";
import { projectVideoCardHref } from "@/modules/productivity/core";
import type { CommercialTerms } from "@/modules/quotes/actions";

// Quick Morning Reality Patch (26 Aug 2026) §7: "make videos the comandas."
// The dense list (ProjectVideoList) is still there for bulk-edit, but the
// default operator view should read like production tickets, not rows in
// a task list -- a real cover, status, priority, commercial value, and
// tracked time, at a glance, per video.

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

function formatHourlyRate(rate: number, currency: string): string {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 2,
      }).format(rate) + "/h"
    );
  } catch {
    return `${currency} ${rate.toFixed(2)}/h`;
  }
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "0m";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Quick Morning Reality Patch §9: AGREED/EXPECTED is a real canonical fact
// (an approved quote, or a client's hourly contract rate). RECEIVED is
// deliberately never derived here -- neither `transactions` nor
// `billingEvidence` carries a per-video link, so attributing a payment to
// ONE video would mean guessing, which the brief explicitly forbids.
// Shown as "—" until a real per-video payment link exists; never inferred
// from status, never treated as revenue.
function CommercialValueLine({ terms }: { terms: CommercialTerms }) {
  if (terms.billingModel === "FIXED") {
    return (
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-zinc-500">
          Agreed <span className="font-black text-emerald-300">{formatQuoteCurrency(terms.agreedPriceCents, terms.currency)}</span>
        </span>
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-600">Received —</span>
      </div>
    );
  }
  if (terms.billingModel === "HOURLY") {
    return (
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-zinc-500">
          Rate <span className="font-black text-cyan-300">{formatHourlyRate(terms.hourlyRate, terms.currency)}</span>
        </span>
      </div>
    );
  }
  return null;
}

const ASPECT_CLASSES: Record<"LANDSCAPE" | "VERTICAL" | "SQUARE" | "UNKNOWN", string> = {
  LANDSCAPE: "aspect-video",
  VERTICAL: "aspect-[9/16] max-h-64",
  SQUARE: "aspect-square",
  UNKNOWN: "aspect-video",
};

export type WorkspaceVideoCardData = {
  id: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  revisionsCount: number;
  batchLabel: string | null;
  coverUrl: string | null;
  orientation: "LANDSCAPE" | "VERTICAL" | "SQUARE" | null;
  isPriority: boolean;
  commercialTerms: CommercialTerms | null;
  // Solo-Operator Health round: a cancelled Production Order item stays a
  // real card here (full history, still reachable) but must be visually
  // distinguishable from an ordinary PLANNED item -- it's excluded from
  // this page's own Completed/N count above, and without a marker here an
  // operator scanning this grid can't tell why.
  cancelledAt?: Date | string | null;
  // Sep 17 Morning Production QA Patch: a container is not a deliverable
  // and has no video workspace of its own -- see projectVideoCardHref.
  isOperationalContainer: boolean;
  productionOrderId: number | null;
};

export function ProjectVideoCards({
  projectId,
  videos,
  projectCoverUrl = null,
  clientDefaultCoverUrl = null,
  clientAvatarUrl = null,
  clientName = "",
}: {
  projectId: number;
  videos: WorkspaceVideoCardData[];
  projectCoverUrl?: string | null;
  clientDefaultCoverUrl?: string | null;
  clientAvatarUrl?: string | null;
  clientName?: string;
}) {
  const returnTo = `/projects/${projectId}`;

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
        <p className="font-black text-white">No videos planned yet</p>
        <p className="mt-1 text-sm text-zinc-500">Plan the first production unit inside this Project.</p>
      </div>
    );
  }

  return (
    // Sep 16 Operational Reality Patch: fixed sm/xl step (2/3) never grew
    // past 3 columns -- operator repro on a real 4K monitor ("sempre
    // ficam 3 videos por fileira ... torna a visualização bastante
    // ineficiente"). auto-fill/minmax adds columns as space allows
    // instead of a hardcoded per-breakpoint count.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {videos.map((video) => {
        const aspectKey = video.orientation ?? "UNKNOWN";
        const coverUrl = resolveCoverUrl(
          video.coverUrl,
          projectCoverUrl,
          clientDefaultCoverUrl,
          clientAvatarUrl,
        );
        const href = projectVideoCardHref(video, returnTo);
        return (
          <article
            key={video.id}
            className={`overflow-hidden rounded-2xl border bg-zinc-900/70 transition hover:border-violet-500/40 ${
              video.cancelledAt ? "opacity-60" : ""
            } ${video.isOperationalContainer ? "border-emerald-500/40" : video.isPriority ? "border-amber-400/50" : "border-zinc-800"}`}
          >
            <Link href={href} className={`relative block w-full overflow-hidden bg-zinc-950 ${ASPECT_CLASSES[aspectKey]}`}>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-700">
                  <span className="text-2xl" aria-hidden="true">🎬</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {clientName ? clientName.slice(0, 2).toUpperCase() : "No preview"}
                  </span>
                </div>
              )}
              <span className="absolute left-2.5 top-2.5">
                <VideoStatusBadge status={video.status} />
              </span>
              {video.isOperationalContainer && (
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200 backdrop-blur">
                  📦 Batch container
                </span>
              )}
              {video.cancelledAt && (
                <span className="absolute left-2.5 top-9 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300 backdrop-blur">
                  Cancelled
                </span>
              )}
              {video.isPriority && !video.isOperationalContainer && (
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 backdrop-blur">
                  ⭐ Priority
                </span>
              )}
              {video.batchLabel && (
                <span className="absolute bottom-2.5 left-2.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-fuchsia-300 backdrop-blur">
                  {video.batchLabel}
                </span>
              )}
            </Link>

            <div className="space-y-2 p-3.5">
              <Link href={href} className="block">
                <h3 className="truncate text-sm font-black text-white hover:text-violet-300" title={video.title ?? undefined}>
                  {video.title ?? `Video ${formatDate(video.date)}`}
                </h3>
              </Link>
              <p className="text-[11px] text-zinc-600">
                {formatDate(video.date)} · {video.revisionsCount} revision{video.revisionsCount === 1 ? "" : "s"}
              </p>

              {video.commercialTerms && video.commercialTerms.billingModel !== "NONE" && (
                <CommercialValueLine terms={video.commercialTerms} />
              )}

              {video.commercialTerms && video.commercialTerms.trackedSeconds > 0 && (
                <p className="text-[11px] text-zinc-600">
                  Tracked: <span className="font-bold text-zinc-400">{formatDuration(video.commercialTerms.trackedSeconds)}</span>
                </p>
              )}

              <Link
                href={href}
                className={`mt-1 inline-flex min-h-9 w-full items-center justify-center rounded-xl px-3 text-xs font-black text-white transition ${
                  video.isOperationalContainer ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"
                }`}
              >
                {video.isOperationalContainer ? "Open batch →" : "Open video →"}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
