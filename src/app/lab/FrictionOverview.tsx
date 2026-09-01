import { detectRepeatedFriction, frictionCountsByCategory, type FrictionEventRow } from "@/modules/friction/core";

export function FrictionOverview({ events }: { events: FrictionEventRow[] }) {
  const counts = frictionCountsByCategory(events);
  const repeated = detectRepeatedFriction(events, 3);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Friction (last {events.length})</p>
      <ul className="text-xs text-zinc-400 space-y-0.5">
        {Object.entries(counts).filter(([, c]) => c > 0).map(([cat, c]) => (
          <li key={cat}>{cat}: {c}</li>
        ))}
        {events.length === 0 && <li className="text-zinc-500">No friction logged yet.</li>}
      </ul>
      {repeated.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Repeated friction (not a recommendation)</p>
          <ul className="text-xs text-amber-400 space-y-0.5">
            {repeated.map((r, i) => (
              <li key={i}>{r.keyword ?? r.category} · {r.category} · {r.count} occurrences</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
