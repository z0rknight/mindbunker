// Batch evidence (Operating-Intelligence train, Sep 19): a READ-ONLY account
// of what MindBunker actually knows about a Production Order's time and money,
// and -- just as important -- what it does NOT know. Pure and derived at
// read time; nothing is stored or written back to any video.
//
// Semantics preserved (never collapsed into one another):
//   Work Session time (canonical) . Sensor-observed part of it (approved
//   Sensor sessions ARE the origin of some Work Sessions, so Sensor time is a
//   share OF tracked time, never added to it) . external registered time
//   (Upwork) . billing evidence allocated to this batch . payment.
// There is deliberately NO profit/margin/hourly-rate figure: registered time,
// billing and payment are not attributed per batch, so no honest number
// exists. The one per-video number offered is a BATCH-EQUIVALENT AVERAGE and
// says so.

import type { EvidenceAllocationForOrder } from "../finance/attribution.ts";

export type BatchEvidenceInput = {
  activeDeliverables: number;
  doneDeliverables: number;
  /** Canonical closed Work Session seconds on the operational container. */
  containerSeconds: number;
  /** Canonical closed Work Session seconds on the order's other videos. */
  itemSeconds: number;
  /** Portion of containerSeconds that came from approved Sensor sessions. */
  containerSensorSeconds: number;
  itemSensorSeconds: number;
  billedByCurrency: ReadonlyArray<{ currency: string; amount: number }>;
  /** Evidence rows with any attribution touching this batch, seen from the batch (see finance/attribution). */
  externalTime?: ReadonlyArray<EvidenceAllocationForOrder>;
};

export type ExternalTimeEvidence = {
  /** NONE = nothing attributed to this batch (the normal starting state). */
  attribution: "NONE" | "ATTRIBUTED";
  weeks: EvidenceAllocationForOrder[];
  /** Minutes the operator explicitly attributed to this batch, across all weeks. */
  explicitHereMinutes: number;
  /** Historical derived-proportion minutes that landed on this batch's videos (history, not a method). */
  derivedHereMinutes: number;
};

export type TrackingShape = "NONE" | "BATCH_LEVEL" | "PER_VIDEO" | "MIXED";

export type BatchEvidence = {
  deliverables: { active: number; done: number };
  tracking: TrackingShape;
  batchLevel: { seconds: number; sensorSeconds: number } | null;
  perVideo: { seconds: number; sensorSeconds: number } | null;
  /** batchLevel seconds / active deliverables; ONLY when time is tracked at batch level alone. */
  batchEquivalentAverageSeconds: number | null;
  billingAllocated: Array<{ currency: string; amount: number }>;
  /** Registered time is reported weekly per contract; only what the operator attributed shows here. */
  externalRegisteredTime: ExternalTimeEvidence;
  /** No per-batch payment link exists in the model. */
  paid: "NOT_TRACKED_PER_BATCH";
};

const clampSensor = (sensor: number, total: number) => Math.max(0, Math.min(sensor, total));

export function computeBatchEvidence(input: BatchEvidenceInput): BatchEvidence {
  const weeks = (input.externalTime ?? []).filter((w) => w.explicitHereMinutes > 0 || w.derivedHereMinutes > 0).map((w) => ({ ...w }));
  const containerSeconds = Math.max(0, input.containerSeconds);
  const itemSeconds = Math.max(0, input.itemSeconds);

  const batchLevel =
    containerSeconds > 0
      ? { seconds: containerSeconds, sensorSeconds: clampSensor(input.containerSensorSeconds, containerSeconds) }
      : null;
  const perVideo =
    itemSeconds > 0 ? { seconds: itemSeconds, sensorSeconds: clampSensor(input.itemSensorSeconds, itemSeconds) } : null;

  const tracking: TrackingShape = batchLevel && perVideo ? "MIXED" : batchLevel ? "BATCH_LEVEL" : perVideo ? "PER_VIDEO" : "NONE";

  // A per-video figure from batch-level time is an AVERAGE, not the time
  // actually spent on any video -- and it is only meaningful when ALL the
  // tracked time is at batch level. It is never written back to a video.
  const batchEquivalentAverageSeconds =
    tracking === "BATCH_LEVEL" && input.activeDeliverables > 0 && batchLevel
      ? Math.round(batchLevel.seconds / input.activeDeliverables)
      : null;

  return {
    deliverables: { active: input.activeDeliverables, done: input.doneDeliverables },
    tracking,
    batchLevel,
    perVideo,
    batchEquivalentAverageSeconds,
    billingAllocated: input.billedByCurrency.filter((row) => row.amount > 0).map((row) => ({ ...row })),
    externalRegisteredTime: {
      attribution: weeks.length > 0 ? "ATTRIBUTED" : "NONE",
      weeks,
      explicitHereMinutes: weeks.reduce((sum, w) => sum + w.explicitHereMinutes, 0),
      derivedHereMinutes: weeks.reduce((sum, w) => sum + w.derivedHereMinutes, 0),
    },
    paid: "NOT_TRACKED_PER_BATCH",
  };
}
