type CurrentWork = { openSession: { videoId: number } | null; video: { nextAction: string | null; waitingOn: string | null } | null };
type ActionItem = { id: number; title: string; priority: string };
type Objective = { id: number; title: string; status: string; currentText: string | null };
type Facts = { cashReconciledStatus: string; debtsDueCount: number; openCommitmentCount: number };
type Factory = { blockedVideos: { id: number; title: string | null }[]; activeProjectCount: number };

// Wave 4P: War Room Strategy View -- CAPTURE/NOW/RADAR/OBJECTIVES/
// PRESSURE/FACTORY. Deliberately a read-only composite of surfaces that
// already exist elsewhere on the page (Current Work, Action Radar,
// Objectives, Business Pressure, Factory State) -- no new source records,
// no arbitrary scores, no general AI summarization. Each block links down
// to its full panel by anchor id.
export function WarRoomPanel({
  currentWork, radarTop, objectives, pressure, factory,
}: {
  currentWork: CurrentWork;
  radarTop: ActionItem[];
  objectives: Objective[];
  pressure: Facts;
  factory: Factory;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <p className="text-sm font-semibold text-white">War Room</p>
      <div className="grid grid-cols-2 gap-3 text-xs text-zinc-300">
        <div>
          <p className="font-semibold text-zinc-400 uppercase text-[10px] mb-1">Now</p>
          {currentWork.openSession ? (
            <p>Active on video #{currentWork.openSession.videoId}. Next: {currentWork.video?.nextAction ?? "—"}{currentWork.video?.waitingOn ? ` · waiting on ${currentWork.video.waitingOn}` : ""}</p>
          ) : (
            <p className="text-zinc-500">No active session. <a href="#current-work" className="underline decoration-dotted">Start one ↓</a></p>
          )}
        </div>
        <div>
          <p className="font-semibold text-zinc-400 uppercase text-[10px] mb-1">Radar (top {radarTop.length})</p>
          <ul>
            {radarTop.map((r) => <li key={r.id}>[{r.priority}] {r.title}</li>)}
            {radarTop.length === 0 && <li className="text-zinc-500">Clear.</li>}
          </ul>
          <a href="#action-radar" className="text-[10px] text-zinc-500 underline decoration-dotted">Full radar ↓</a>
        </div>
        <div>
          <p className="font-semibold text-zinc-400 uppercase text-[10px] mb-1">Objectives</p>
          <ul>
            {objectives.filter((o) => o.status === "ACTIVE").slice(0, 3).map((o) => (
              <li key={o.id}>{o.title}{o.currentText ? ` — ${o.currentText}` : ""}</li>
            ))}
            {objectives.filter((o) => o.status === "ACTIVE").length === 0 && <li className="text-zinc-500">None active.</li>}
          </ul>
          <a href="#objectives" className="text-[10px] text-zinc-500 underline decoration-dotted">Full objectives ↓</a>
        </div>
        <div>
          <p className="font-semibold text-zinc-400 uppercase text-[10px] mb-1">Pressure</p>
          <p>Cash: {pressure.cashReconciledStatus} · Debts due: {pressure.debtsDueCount} · Open commitments: {pressure.openCommitmentCount}</p>
          <a href="#business-pressure" className="text-[10px] text-zinc-500 underline decoration-dotted">Full pressure ↓</a>
        </div>
        <div className="col-span-2">
          <p className="font-semibold text-zinc-400 uppercase text-[10px] mb-1">Factory</p>
          <p>{factory.activeProjectCount} active project(s) · {factory.blockedVideos.length} blocked video(s){factory.blockedVideos.length > 0 ? `: ${factory.blockedVideos.map((v) => v.title ?? `#${v.id}`).join(", ")}` : ""}</p>
          <a href="#factory" className="text-[10px] text-zinc-500 underline decoration-dotted">Full factory state ↓</a>
        </div>
      </div>
    </div>
  );
}
