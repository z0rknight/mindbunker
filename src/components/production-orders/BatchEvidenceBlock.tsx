import type { BatchEvidence } from "@/modules/production-orders/evidence";
import { formatClosedDuration } from "@/modules/work-sessions/core";
import { formatCurrency } from "@/utils/date";

// Read-only "Evidence for this batch": what is known, and what is not.
// Presentational only (no hooks/state/writes). Answers one operator question:
// "How much evidence do I actually have for this batch?" -- and never
// computes a profit or hourly-rate figure.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-xs leading-5 text-zinc-300">{children}</dd>
    </div>
  );
}

const Unknown = ({ children }: { children: React.ReactNode }) => <span className="text-zinc-500">{children}</span>;

function sensorNote(sensorSeconds: number) {
  return sensorSeconds > 0 ? `Sensor-observed part: ${formatClosedDuration(sensorSeconds)}` : "Sensor-observed part: none";
}

export function BatchEvidenceBlock({ evidence }: { evidence: BatchEvidence }) {
  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono" data-testid="batch-evidence">
      <p className="mb-3 text-[10px] uppercase tracking-widest text-zinc-600">EVIDENCE FOR THIS BATCH</p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Row label="Deliverables">
          {evidence.deliverables.active} active · {evidence.deliverables.done} done
        </Row>

        <Row label="Tracked work">
          {evidence.tracking === "NONE" && <Unknown>No time tracked on this batch yet.</Unknown>}
          {evidence.batchLevel && (
            <div>
              Batch level: {formatClosedDuration(evidence.batchLevel.seconds)}
              <span className="block text-zinc-500">{sensorNote(evidence.batchLevel.sensorSeconds)}</span>
            </div>
          )}
          {evidence.perVideo && (
            <div className={evidence.batchLevel ? "mt-1.5" : ""}>
              Per video: {formatClosedDuration(evidence.perVideo.seconds)}
              <span className="block text-zinc-500">{sensorNote(evidence.perVideo.sensorSeconds)}</span>
            </div>
          )}
          {evidence.tracking === "MIXED" && (
            <span className="mt-1 block text-zinc-500">Batch-level and per-video time are separate records, never added together.</span>
          )}
        </Row>

        {evidence.batchEquivalentAverageSeconds !== null && (
          <Row label="Batch-equivalent average">
            ≈ {formatClosedDuration(evidence.batchEquivalentAverageSeconds)} per deliverable
            <span className="block text-zinc-500">
              Batch time ÷ active deliverables. Not the time spent on any one video; never written to a video.
            </span>
          </Row>
        )}

        <Row label="Billing evidence allocated">
          {evidence.billingAllocated.length > 0 ? (
            evidence.billingAllocated.map((row) => formatCurrency(row.amount, row.currency)).join(" · ")
          ) : (
            <Unknown>None allocated to this batch.</Unknown>
          )}
        </Row>

        <Row label="External registered time">
          <Unknown>Not attributed to this batch (Upwork time is reported weekly per contract).</Unknown>
        </Row>

        <Row label="Paid">
          <Unknown>Not tracked per batch.</Unknown>
        </Row>
      </dl>
      <p className="mt-3 text-[10px] leading-4 text-zinc-600">
        No profit figure is shown: registered time, billing and payment are not attributed to individual batches.
      </p>
    </section>
  );
}
