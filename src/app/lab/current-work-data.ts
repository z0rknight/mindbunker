import "server-only";
import { getWorkSessionOverview } from "@/modules/work-sessions/data";
import { getVideoWorkbenchData } from "./video-workbench-actions";

// Wave 4B: Current Work Mode -- one focused read combining the active
// session with just enough video context (next action, waiting on,
// deadline, input readiness) to avoid jumping across five Lab cards while
// editing. Reuses getWorkSessionOverview (Wave 1) and getVideoWorkbenchData
// (Wave 3) rather than re-querying anything new.
export async function getCurrentWorkContext() {
  const overview = await getWorkSessionOverview();
  if (!overview.openSession) return { openSession: null, elapsedSeconds: 0, stale: false, video: null };

  const workbench = await getVideoWorkbenchData(overview.openSession.videoId);
  const nextCommitment = workbench.commitments.find((c) => c.status === "OPEN") ?? null;

  return {
    openSession: overview.openSession,
    elapsedSeconds: overview.openSessionElapsedSeconds,
    stale: overview.openSessionStale,
    video: {
      nextAction: workbench.video?.nextAction ?? null,
      waitingOn: workbench.video?.waitingOn ?? null,
      readyToProduce: workbench.readyToProduce,
      assetChecklist: workbench.assetChecklist,
      nextCommitment,
    },
  };
}
