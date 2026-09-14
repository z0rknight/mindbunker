function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/35 px-3 py-2.5 text-center">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
    </div>
  );
}

export function ClientMetricStrip({
  totalProjectsCount,
  activeProjectsCount,
  completedVideosCount,
  revisionCount,
}: {
  totalProjectsCount: number;
  activeProjectsCount: number;
  completedVideosCount: number;
  revisionCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="client-metric-strip">
      <MetricTile label="Total projects" value={totalProjectsCount} />
      <MetricTile label="Active now" value={activeProjectsCount} />
      <MetricTile label="Completed videos" value={completedVideosCount} />
      <MetricTile label="Revisions requested" value={revisionCount} />
    </div>
  );
}
