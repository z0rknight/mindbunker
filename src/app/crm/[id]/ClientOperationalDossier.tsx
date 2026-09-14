import { formatCurrency, formatDate } from "@/utils/date";
import { formatCommercialRelationship } from "@/modules/crm/spatial-composition";

function formatInteraction(value: string | null) {
  if (!value) return "No interaction recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function ClientOperationalDossier({
  status,
  lastInteractionAt,
  nextAction,
  nextActionDate,
  contract,
  portalPasswordSetAt,
  recentNote,
}: {
  status: string;
  lastInteractionAt: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  contract: { platform: string; billingType: "HOURLY" | "FIXED"; hourlyRate: number | null; currency: string } | null;
  portalPasswordSetAt: string | null;
  recentNote: { videoTitle: string; body: string; createdAt: string } | null;
}) {
  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4 sm:p-5" data-testid="client-operational-dossier">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Operational dossier</p>
          <h2 className="mt-1 font-black text-white">Relationship now</h2>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-300">
          {status}
        </span>
      </div>

      <dl className="space-y-4">
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Next action</dt>
          <dd className="mt-1 text-sm font-black text-white">{nextAction || "No next action set"}</dd>
          {nextActionDate && <p className="mt-0.5 text-[11px] font-bold text-cyan-300">Due {formatDate(nextActionDate)}</p>}
        </div>
        <DossierFact label="Last interaction" value={formatInteraction(lastInteractionAt)} />
        <DossierFact
          label="Commercial relationship"
          value={formatCommercialRelationship(contract, (amount) => formatCurrency(amount, contract?.currency))}
        />
        <DossierFact
          label="Portal access"
          value={portalPasswordSetAt ? `Active — set ${formatInteraction(portalPasswordSetAt)}` : "Not set up"}
        />
        {recentNote && (
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">
              Recent note · {recentNote.videoTitle}
            </dt>
            <dd className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{recentNote.body}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function DossierFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd className="mt-1 text-sm font-black text-zinc-200">{value}</dd>
    </div>
  );
}
