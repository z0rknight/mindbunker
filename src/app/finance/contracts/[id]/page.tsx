import Link from "next/link";
import { notFound } from "next/navigation";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import {
  getCommercialContractById,
  getBillingEvidenceForContract,
  getContractReconciliation,
} from "@/modules/finance/actions";
import { formatMinutesAsHours } from "@/modules/finance/core";
import { formatCurrency, formatDate } from "@/utils/date";
import { RecordBillingEvidenceButton } from "../RecordBillingEvidenceButton";
import { LinkIncomeButton } from "../LinkIncomeButton";
import { parseHttpsExternalReference } from "@/modules/custody/core";
import { getEvidenceAttributionView } from "@/modules/finance/attribution-data";
import { AttributionPanel } from "./AttributionPanel";

export const dynamic = "force-dynamic";

const PROVENANCE_STYLE: Record<string, string> = {
  SOURCE_FACT: "bg-emerald-900/50 text-emerald-400",
  DERIVED: "bg-blue-900/50 text-blue-400",
  UNATTRIBUTED: "bg-zinc-800 text-zinc-500",
};

function ProvenanceTag({ provenance }: { provenance: string }) {
  return (
    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${PROVENANCE_STYLE[provenance] ?? "bg-zinc-800 text-zinc-500"}`}>
      {provenance.replace("_", " ")}
    </span>
  );
}

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evidence?: string | string[] }>;
}) {
  const { id } = await params;
  const contractId = Number(id);
  const query = await searchParams;

  const [contract, evidenceList] = await Promise.all([
    getCommercialContractById(contractId),
    getBillingEvidenceForContract(contractId),
  ]);

  if (!contract) notFound();
  const externalContractUrl = parseHttpsExternalReference(contract.externalReference);

  const requestedEvidenceId = Array.isArray(query.evidence) ? query.evidence[0] : query.evidence;
  const selectedEvidence =
    (requestedEvidenceId
      ? evidenceList.find((e) => String(e.id) === requestedEvidenceId)
      : evidenceList[0]) ?? null;

  const reconciliation = selectedEvidence
    ? await getContractReconciliation(contractId, selectedEvidence.periodStart, selectedEvidence.periodEnd)
    : null;

  const attributionView = selectedEvidence ? await getEvidenceAttributionView(selectedEvidence.id) : null;

  return (
    <div className={`${OPERATOR_WORKSPACE_CLASS} max-w-4xl`}>
      <Link href="/finance/contracts" className="text-zinc-500 text-xs hover:text-white">
        ← Contracts
      </Link>

      <div className="mt-1 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{contract.clientName} — {contract.platform}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {contract.billingType === "HOURLY"
              ? `HOURLY · ${contract.currency} ${contract.hourlyRate?.toFixed(2)}/hour`
              : `FIXED · ${contract.currency}`}
            {" · "}
            <span className={
              contract.status === "ACTIVE" ? "text-emerald-400" :
              contract.status === "PAUSED" ? "text-amber-400" : "text-zinc-500"
            }>
              {contract.status}
            </span>
          </p>
          {contract.externalReference && (
            externalContractUrl ? (
              <a
                href={externalContractUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex text-xs font-bold text-cyan-400 hover:text-cyan-300"
              >
                Open external contract ↗
              </a>
            ) : (
              <p className="mt-1 text-xs text-zinc-600">External reference: {contract.externalReference}</p>
            )
          )}
          {contract.notes && <p className="text-zinc-600 text-xs mt-1">{contract.notes}</p>}
        </div>
        <RecordBillingEvidenceButton contractId={contractId} defaultCurrency={contract.currency} />
      </div>

      {/* Reconciliation */}
      <div className="mb-8">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Reconciliation
        </h2>
        {!selectedEvidence || !reconciliation ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-500 text-sm">
              No billing evidence registered yet — register a period below to compare
              MindBunker&rsquo;s operational tracked time against what was actually billed.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-4">
              {formatDate(reconciliation.periodStart)} – {formatDate(reconciliation.periodEnd)}
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  Operational tracked
                  <ProvenanceTag provenance={reconciliation.operationalMinutes.provenance} />
                </dt>
                <dd className="text-white font-mono">{formatMinutesAsHours(reconciliation.operationalMinutes.value)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  {contract.platform} billed
                  <ProvenanceTag provenance={reconciliation.billedMinutes.provenance} />
                </dt>
                <dd className="text-white font-mono">
                  {reconciliation.billedMinutes.value !== null
                    ? formatMinutesAsHours(reconciliation.billedMinutes.value)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  Difference
                  <ProvenanceTag provenance={reconciliation.differenceMinutes.provenance} />
                </dt>
                <dd className={`font-mono font-bold ${
                  reconciliation.differenceMinutes.value === null ? "text-zinc-500" :
                  reconciliation.differenceMinutes.value === 0 ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {reconciliation.differenceMinutes.value !== null
                    ? `${reconciliation.differenceMinutes.value >= 0 ? "+" : "-"}${formatMinutesAsHours(Math.abs(reconciliation.differenceMinutes.value))}`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  Contract rate
                  <ProvenanceTag provenance={reconciliation.contractRate.provenance} />
                </dt>
                <dd className="text-white font-mono">
                  {reconciliation.contractRate.value !== null && reconciliation.currency
                    ? `${formatCurrency(reconciliation.contractRate.value, reconciliation.currency)} / billed hour`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  Gross billed
                  <ProvenanceTag provenance={reconciliation.grossBilled.provenance} />
                </dt>
                <dd className="text-white font-mono">
                  {reconciliation.grossBilled.value !== null && reconciliation.currency
                    ? formatCurrency(reconciliation.grossBilled.value, reconciliation.currency)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">
                  Gross / operational hour
                  <ProvenanceTag provenance={reconciliation.grossPerOperationalHour.provenance} />
                </dt>
                <dd className="text-white font-mono">
                  {reconciliation.grossPerOperationalHour.value !== null && reconciliation.currency
                    ? formatCurrency(reconciliation.grossPerOperationalHour.value, reconciliation.currency)
                    : "—"}
                </dd>
              </div>
            </dl>
            {reconciliation.openSessionCount > 0 && (
              <p className="text-amber-500 text-xs mt-4">
                ⚠ {reconciliation.openSessionCount} still-open session(s) in this window are excluded from
                operational tracked time until closed.
              </p>
            )}
            {reconciliation.billingEvidenceId !== null && reconciliation.grossBilled.value !== null && reconciliation.currency && (
              <div className="mt-4">
                <LinkIncomeButton
                  billingEvidenceId={reconciliation.billingEvidenceId}
                  suggestedAmount={reconciliation.grossBilled.value}
                  suggestedCurrency={reconciliation.currency}
                  clientLabel={`${contract.clientName} — ${contract.platform}`}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commercial Evidence train: which work the selected registered time
          belonged to (optional; unallocated is a valid state). */}
      {attributionView && (
        <div className="mb-8">
          <AttributionPanel view={attributionView} />
        </div>
      )}

      {/* Billing Evidence list */}
      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Billing Evidence ({evidenceList.length})
        </h2>
        {evidenceList.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-500 text-sm">None registered yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {evidenceList.map((e) => (
              <Link
                key={e.id}
                href={`/finance/contracts/${contractId}?evidence=${e.id}`}
                className={`block rounded-xl p-4 border transition-colors ${
                  selectedEvidence?.id === e.id
                    ? "border-cyan-700/60 bg-cyan-950/20"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-semibold">
                    {formatDate(e.periodStart)} – {formatDate(e.periodEnd)}
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400">
                    {e.source}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {formatMinutesAsHours(e.billableMinutes)} · {formatCurrency(e.grossAmount, e.currency)}
                  {e.externalReference ? ` · ${e.externalReference}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
