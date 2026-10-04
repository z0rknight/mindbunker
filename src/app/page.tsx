import { DashboardOperatingReality } from "@/components/operating-reality/DashboardOperatingReality";
import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { PixelIcon } from "@/components/ui/PixelVisuals";
import { getOperatingReality } from "@/modules/operating-reality/data";
import { currentMonthKey, currentMonthName, OPERATOR_TIME_ZONE } from "@/utils/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const reality = await getOperatingReality();
  const now = new Date(reality.generatedAt);
  const operatorHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATOR_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
  const greeting = operatorHour < 12
    ? "Good morning"
    : operatorHour < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-system-label flex items-center gap-2 text-zinc-500">
            <PixelIcon name="shield" className="h-3.5 w-3.5" /> Operator system · observational
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">{greeting} · Operating Reality</h1>
          <p className="mt-1 text-sm text-zinc-500">{currentMonthName(now)} {currentMonthKey(now).slice(0, 4)} · one fact, one owner, many views</p>
        </div>
        <p className="max-w-md text-right text-xs leading-5 text-zinc-600">
          This surface answers how the operation is doing. Execution stays in War Room; structure, money, time and relationships stay with their canonical owners.
        </p>
      </header>

      <DashboardOperatingReality reality={reality} />
    </div>
  );
}
