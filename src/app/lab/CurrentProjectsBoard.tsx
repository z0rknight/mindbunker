type BoardVideo = {
  id: number;
  title: string;
  coverUrl: string | null;
  tags: string[];
  videoKind: string;
  lifecycleStage: string | null;
  nextAction: string | null;
  waitingOn: string | null;
  openCommitment: { description: string; dueAt: Date | null } | null;
  trackedSessionCount: number;
  lastQaResult: string | null;
  lastDelivery: { version: number } | null;
  hasOpenBlocker: boolean;
  frictionCount: number;
  publishedUrl: string | null;
};
type BoardProject = { project: { id: number; name: string }; videos: BoardVideo[] };
type BoardClient = { client: { id: number; name: string }; projects: BoardProject[] };

function VideoCard({ v }: { v: BoardVideo }) {
  return (
    <div className="min-w-[220px] max-w-[220px] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1">
      <div className="h-24 w-full rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
        {v.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-zinc-600">no cover</span>
        )}
      </div>
      <p className="text-xs font-semibold text-white truncate" title={v.title}>{v.title}</p>
      <div className="flex flex-wrap gap-1">
        {v.videoKind !== "CLIENT_WORK" && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">{v.videoKind}</span>}
        {v.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">{t}</span>)}
      </div>
      <p className="text-[10px] text-zinc-500">{v.lifecycleStage ?? "no lifecycle events"}</p>
      {v.nextAction && <p className="text-[10px] text-zinc-400 truncate">Next: {v.nextAction}</p>}
      {v.waitingOn && v.waitingOn !== "NONE" && <p className="text-[10px] text-amber-400">Waiting: {v.waitingOn}</p>}
      {v.openCommitment && (
        <p className="text-[10px] text-violet-400 truncate">
          Due: {v.openCommitment.dueAt ? new Date(v.openCommitment.dueAt).toISOString().slice(0, 10) : "—"}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        <span className="text-zinc-500">{v.trackedSessionCount} session{v.trackedSessionCount === 1 ? "" : "s"}</span>
        {v.lastQaResult && <span className={v.lastQaResult === "PASS" ? "text-emerald-400" : "text-red-400"}>QA {v.lastQaResult}</span>}
        {v.lastDelivery && <span className="text-blue-400">v{v.lastDelivery.version} delivered</span>}
        {v.hasOpenBlocker && <span className="text-red-400">BLOCKED</span>}
        {v.frictionCount > 0 && <span className="text-orange-400">{v.frictionCount} friction</span>}
      </div>
      {v.publishedUrl && (
        <a href={v.publishedUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 underline">SEE LIVE CONTENT</a>
      )}
    </div>
  );
}

export function CurrentProjectsBoard({ board }: { board: BoardClient[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <p className="text-sm font-semibold text-white">Current Projects</p>
      {board.map(({ client, projects }) => (
        <div key={client.id} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{client.name}</p>
          {projects.map(({ project, videos }) => (
            <div key={project.id} className="space-y-1.5">
              <p className="text-[11px] text-zinc-400">{project.name}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {videos.map((v) => <VideoCard key={v.id} v={v} />)}
                {videos.length === 0 && <p className="text-[11px] text-zinc-600">No videos yet.</p>}
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-[11px] text-zinc-600">No projects yet.</p>}
        </div>
      ))}
      {board.length === 0 && <p className="text-xs text-zinc-500">No active clients.</p>}
    </div>
  );
}
