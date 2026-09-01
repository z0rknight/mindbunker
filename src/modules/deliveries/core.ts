// Wave 2D: Delivery Ledger prototype.
export type PromiseAccuracy = {
  sampleCount: number;
  onTimeCount: number;
  lateCount: number;
  avgDeltaSeconds: number | null; // positive = late on average
};

// deltas: deliveredAt - dueAt in seconds, one per (commitment, delivery)
// pair where both exist. Deliberately does NOT compute a percentage when
// the sample is tiny -- callers must show sampleCount alongside any rate
// (see brief: "do not make percentage claims with tiny samples without
// showing raw counts").
export function computePromiseAccuracy(deltasSeconds: number[]): PromiseAccuracy {
  const onTimeCount = deltasSeconds.filter((d) => d <= 0).length;
  const lateCount = deltasSeconds.filter((d) => d > 0).length;
  const avgDeltaSeconds = deltasSeconds.length
    ? deltasSeconds.reduce((a, b) => a + b, 0) / deltasSeconds.length
    : null;
  return { sampleCount: deltasSeconds.length, onTimeCount, lateCount, avgDeltaSeconds };
}
