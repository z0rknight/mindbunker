import { PRODUCTION_MEMORY_STATUS_LABELS } from "@/modules/production-memory/config";
import { templateLocationHref } from "@/modules/production-memory/core";
import type { ProductionMemoryRecord } from "@/modules/production-memory/data";

// Read-only rendering of ONE production memory, shared by the CRM dossier and
// the Project / Production Order hot-path so the two can never disagree.
// Every absent value is shown as "Not recorded" (never a placeholder value),
// so a missing template or reference is visibly unknown, not silently blank.

const STATUS_TONE: Record<string, string> = {
  CLIENT_APPROVED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  OPERATOR_CONVENTION: "border-cyan-800/60 bg-cyan-950/30 text-cyan-300",
  OBSERVED: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  HISTORICAL: "border-zinc-700 bg-zinc-900 text-zinc-400",
};

export function ProductionMemoryStatusBadge({ status }: { status: ProductionMemoryRecord["status"] }) {
  if (!status) {
    return (
      <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">
        Status not recorded
      </span>
    );
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_TONE[status]}`}>
      {PRODUCTION_MEMORY_STATUS_LABELS[status]}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-xs text-zinc-300">{children}</dd>
    </div>
  );
}

const NOT_RECORDED = <span className="text-zinc-600">Not recorded</span>;

export function ProductionMemoryDetails({ memory }: { memory: ProductionMemoryRecord }) {
  const templateHref = templateLocationHref(memory.templateLocation);
  return (
    <dl className="space-y-2.5">
      <Row label="Use it for">{memory.useCase ?? NOT_RECORDED}</Row>
      <Row label="Client preference">{memory.preferenceNotes ?? NOT_RECORDED}</Row>
      <Row label="How it's produced">{memory.recipeNotes ?? NOT_RECORDED}</Row>
      <Row label="Approval">{memory.approvalEvidence ?? NOT_RECORDED}</Row>
      <Row label="Approved example">
        {memory.referenceVideo ? (
          memory.referenceVideo.href ? (
            <a href={memory.referenceVideo.href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
              {memory.referenceVideo.title ?? `Video #${memory.referenceVideo.id}`} ↗
            </a>
          ) : (
            <>{memory.referenceVideo.title ?? `Video #${memory.referenceVideo.id}`}</>
          )
        ) : memory.referenceUrl ? (
          <a href={memory.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
            {memory.referenceUrl} ↗
          </a>
        ) : (
          NOT_RECORDED
        )}
      </Row>
      <Row label="Template / project location">
        {memory.templateLocation ? (
          templateHref ? (
            <a href={templateHref} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
              {memory.templateLocation} ↗
            </a>
          ) : (
            <span className="font-mono">{memory.templateLocation}</span>
          )
        ) : (
          NOT_RECORDED
        )}
      </Row>
    </dl>
  );
}
