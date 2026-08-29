import Link from "next/link";
import type { CustodyProjection } from "@/modules/custody/core";
import { formatQuoteAmount } from "@/modules/quotes/core";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency } from "@/utils/date";

const VIDEO_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  READY_FOR_REVIEW: "Ready for review",
  CHANGES_REQUESTED: "Changes requested",
  DONE: "Delivered",
};

function Step({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/55 p-3.5">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">{eyebrow}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-zinc-700" aria-hidden="true">
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </div>
  );
}

export function ChainOfCustodyPanel({
  custody,
  focusProjectId,
}: {
  custody: CustodyProjection;
  focusProjectId?: number;
}) {
  const focusedProjects = focusProjectId
    ? custody.projects.filter((project) => project.id === focusProjectId)
    : custody.projects;
  const visibleProjects = focusProjectId ? focusedProjects : focusedProjects.slice(0, 4);
  const focusedVideoIds = new Set(focusedProjects.flatMap((project) => project.videos.map((video) => video.id)));
  const relevantQuotes = focusProjectId
    ? custody.quotes.filter(
        (quote) => quote.projectId === focusProjectId || (quote.videoId !== null && focusedVideoIds.has(quote.videoId)),
      )
    : custody.quotes;

  return (
    <section className="mb-7 rounded-2xl border border-cyan-900/50 bg-cyan-950/10 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Chain of custody</p>
          <h2 className="mt-1 text-lg font-black text-white">Commercial fact → production → evidence</h2>
        </div>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
          Derived · read-only
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,0.7fr)_auto_minmax(0,1.25fr)_auto_minmax(0,1.4fr)_auto_minmax(0,1fr)]">
        <Step eyebrow="Relationship">
          <Link href={`/crm/${custody.client.id}`} className="block font-black text-white hover:text-cyan-300">
            {custody.client.name}
          </Link>
          <p className="text-xs text-zinc-500">
            {custody.client.status === "lead"
              ? "Lead / prospect"
              : custody.client.status === "active"
                ? "Active client"
                : "Inactive client"}
          </p>
        </Step>

        <Arrow />

        <Step eyebrow="Commercial">
          {relevantQuotes.map((quote) => (
            <Link
              key={`quote-${quote.id}`}
              href={`/crm/${custody.client.id}#quote-${quote.id}`}
              className="block rounded-lg bg-zinc-900/80 p-2.5 transition hover:bg-zinc-800"
            >
              <p className="text-xs font-black text-white">{quote.contentTypeLabel}</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {formatQuoteAmount(quote.amountCents, quote.currency)} · {quote.status === "APPROVED" ? "Accepted" : quote.status}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
                {quote.commercialState === "PIPELINE"
                  ? "Pipeline · not closed"
                  : quote.commercialState === "CLOSED"
                    ? "Commercial commitment"
                    : "Declined"}
                {quote.projectId !== null || quote.videoId !== null ? " · direct production link" : ""}
              </p>
            </Link>
          ))}

          {custody.contracts.map((contract) => (
            <div key={`contract-${contract.id}`} className="rounded-lg bg-zinc-900/80 p-2.5">
              <Link href={`/finance/contracts/${contract.id}`} className="text-xs font-black text-white hover:text-cyan-300">
                {contract.platform} contract
              </Link>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {contract.billingType === "HOURLY" && contract.hourlyRate !== null
                  ? `${formatCurrency(contract.hourlyRate, contract.currency)}/hour`
                  : `${contract.billingType} · ${contract.currency}`}
                {` · ${contract.status}`}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-amber-500/80">
                Client-level commercial context
              </p>
              {contract.externalUrl && (
                <a
                  href={contract.externalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                >
                  Open external contract ↗
                </a>
              )}
            </div>
          ))}

          {relevantQuotes.length === 0 && custody.contracts.length === 0 && (
            <p className="text-xs text-zinc-600">No canonical quote or contract yet.</p>
          )}
        </Step>

        <Arrow />

        <Step eyebrow="Production">
          {visibleProjects.map((project) => {
            const visibleVideos = project.videos.slice(0, focusProjectId ? 6 : 2);
            return (
            <div key={project.id} className="rounded-lg bg-zinc-900/80 p-2.5">
              <Link href={`/projects/${project.id}`} className="text-xs font-black text-white hover:text-cyan-300">
                {project.name}
              </Link>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">Project · {project.status}</p>
              <div className="mt-2 space-y-1.5">
                {visibleVideos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/productivity?video=${video.id}&returnTo=${encodeURIComponent(`/projects/${project.id}`)}`}
                    className="block rounded-md border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-300 hover:border-violet-700 hover:text-violet-200"
                  >
                    <span className="font-bold">{video.title}</span>
                    <span className="block text-[9px] uppercase tracking-wide text-zinc-600">
                      {VIDEO_STATUS_LABELS[video.status] ?? video.status.replaceAll("_", " ")}
                      {video.sessionCount > 0
                        ? ` · ${formatClosedDuration(video.closedSeconds)} · ${video.sessionCount} session${video.sessionCount === 1 ? "" : "s"}`
                        : " · no tracked work"}
                    </span>
                  </Link>
                ))}
                {project.videos.length > visibleVideos.length && (
                  <Link href={`/projects/${project.id}`} className="block text-[10px] font-bold text-zinc-500 hover:text-cyan-300">
                    + {project.videos.length - visibleVideos.length} more video{project.videos.length - visibleVideos.length === 1 ? "" : "s"}
                  </Link>
                )}
                {project.videos.length === 0 && <p className="text-[11px] text-zinc-600">No videos yet.</p>}
              </div>
            </div>
            );
          })}
          {focusedProjects.length > visibleProjects.length && (
            <Link href="/projects" className="inline-flex text-[10px] font-bold text-cyan-400 hover:text-cyan-300">
              + {focusedProjects.length - visibleProjects.length} more project{focusedProjects.length - visibleProjects.length === 1 ? "" : "s"} →
            </Link>
          )}
          {focusedProjects.length === 0 && <p className="text-xs text-zinc-600">No linked project yet.</p>}
        </Step>

        <Arrow />

        <Step eyebrow="Billing / Finance">
          {custody.billingByContract.map((row) => (
            <Link
              key={`${row.contractId}-${row.currency}`}
              href={`/finance/contracts/${row.contractId}`}
              className="block rounded-lg bg-zinc-900/80 p-2.5 hover:bg-zinc-800"
            >
              <p className="text-xs font-black text-white">Billing evidence</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {formatCurrency(row.grossAmount, row.currency)} · {row.count} record{row.count === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-600">Billed · not cash by itself</p>
            </Link>
          ))}
          {custody.financeIncomeByCurrency.map((row) => (
            <Link key={row.currency} href="/finance" className="block rounded-lg bg-zinc-900/80 p-2.5 hover:bg-zinc-800">
              <p className="text-xs font-black text-emerald-300">Finance income recorded</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {formatCurrency(row.amount, row.currency)} · {row.count} movement{row.count === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
          {custody.clientOnlyIncomeCount > 0 && (
            <p className="text-[9px] leading-4 text-amber-500/80">
              {custody.clientOnlyIncomeCount} income movement{custody.clientOnlyIncomeCount === 1 ? " is" : "s are"} linked to the client only, not a specific quote or contract.
            </p>
          )}
          {custody.contractLinkedIncomeCount > 0 && (
            <p className="text-[9px] leading-4 text-emerald-500/80">
              {custody.contractLinkedIncomeCount} income movement{custody.contractLinkedIncomeCount === 1 ? " has" : "s have"} contract or billing-evidence provenance.
            </p>
          )}
          {custody.billingByContract.length === 0 && custody.financeIncomeByCurrency.length === 0 && (
            <p className="text-xs text-zinc-600">No billing or Finance income evidence linked yet.</p>
          )}
        </Step>
      </div>
    </section>
  );
}
