// Wave 3B: Activity Sensor Overlay. Never authoritative -- always labeled
// OBSERVED / DERIVED / EXPERIMENTAL. No judgment calls (no "you
// procrastinated", no Safari=waste assumption).
export const PRODUCTION_TOOLS = ["Premiere Pro", "After Effects", "DaVinci Resolve", "Photoshop", "Audition"];

export type ObservationRow = { appName: string; startedAt: Date; endedAt: Date };

export type ActivityOverlay = {
  appSwitchCount: number;
  productionToolRatio: number | null; // seconds in PRODUCTION_TOOLS / total observed seconds
  contextDriftMinutes: number; // minutes observed OUTSIDE PRODUCTION_TOOLS during an intentional session
  coverageSeconds: number; // total observed seconds overlapping the session
  byApp: Record<string, number>;
};

export function computeActivityOverlay(observations: ObservationRow[]): ActivityOverlay {
  const byApp: Record<string, number> = {};
  let total = 0;
  let productionSeconds = 0;
  for (const o of observations) {
    const seconds = Math.max(0, (o.endedAt.getTime() - o.startedAt.getTime()) / 1000);
    byApp[o.appName] = (byApp[o.appName] ?? 0) + seconds;
    total += seconds;
    if (PRODUCTION_TOOLS.includes(o.appName)) productionSeconds += seconds;
  }
  // app-switch count: consecutive observations with a different app name.
  let switches = 0;
  for (let i = 1; i < observations.length; i++) {
    if (observations[i].appName !== observations[i - 1].appName) switches += 1;
  }
  return {
    appSwitchCount: switches,
    productionToolRatio: total > 0 ? productionSeconds / total : null,
    contextDriftMinutes: Math.round((total - productionSeconds) / 60),
    coverageSeconds: total,
    byApp,
  };
}
