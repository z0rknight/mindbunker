import type { getLabTimeline, TimelineEntry } from "./timeline-data";

type Timeline = Awaited<ReturnType<typeof getLabTimeline>>;

function Section({ title, entries }: { title: string; entries: TimelineEntry[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-zinc-600">Nothing.</p>
      ) : (
        <ul className="text-xs text-zinc-300 space-y-0.5">
          {entries.slice(0, 15).map((e, i) => (
            <li key={i}>{new Date(e.at).toLocaleTimeString()} · {e.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TimelinePanel({ timeline }: { timeline: Timeline }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Timeline — what changed today?</p>
      <Section title="Today" entries={timeline.today} />
      <Section title="Yesterday" entries={timeline.yesterday} />
      <Section title="Older" entries={timeline.older} />
    </div>
  );
}
