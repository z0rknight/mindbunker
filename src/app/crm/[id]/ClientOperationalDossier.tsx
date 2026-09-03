import { formatCurrency, formatDate } from "@/utils/date";

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
  realizedRevenue,
  activeProjectsCount,
  currentProductionCount,
  nextAction,
  nextActionDate,
}: {
  status: string;
  lastInteractionAt: string | null;
  realizedRevenue: Array<{ currency: string; amount: number }>;
  activeProjectsCount: number;
  currentProductionCount: number;
  nextAction: string | null;
  nextActionDate: string | null;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4 sm:p-5" data-testid="client-operational-dossier">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Operational dossier</p>
          <h2 className="mt-1 font-black text-white">Relationship now</h2>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-300">
          {status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <DossierFact label="Last interaction" value={formatInteraction(lastInteractionAt)} />
        <DossierFact
          label="Realized revenue"
          value={
            realizedRevenue.length > 0
              ? realizedRevenue.map((row) => formatCurrency(row.amount, row.currency)).join(" · ")
              : "No revenue recorded"
          }
        />
        <DossierFact label="Active projects" value={String(activeProjectsCount)} />
        <DossierFact label="Current production" value={`${currentProductionCount} in flight`} />
        <div className="col-span-2 sm:col-span-2">
          <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Next action</dt>
          <dd className="mt-1 text-sm font-black text-white">
            {nextAction || "No next action set"}
          </dd>
          {nextActionDate && (
            <p className="mt-0.5 text-[11px] font-bold text-cyan-300">Due {formatDate(nextActionDate)}</p>
          )}
        </div>
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
