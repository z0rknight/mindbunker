import { getFinanceHealthActionItems, type FinanceHealth } from "@/modules/finance/health";
import Link from "next/link";

const STYLE = {
  GREEN: "border-emerald-900/60 bg-emerald-950/25 text-emerald-300",
  YELLOW: "border-amber-900/60 bg-amber-950/25 text-amber-300",
  RED: "border-red-900/60 bg-red-950/25 text-red-300",
} as const;

export function FinanceHealthPanel({ health }: { health: FinanceHealth }) {
  const actionItems = getFinanceHealthActionItems(health);
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${STYLE[health.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
            Finance Health · deterministic checks
          </p>
          <p className="mt-1 text-lg font-black">{health.status}</p>
          <p className="text-xs opacity-80">{health.reason}</p>
        </div>
        <p className="text-2xl font-black tabular-nums">
          {health.reconciledPockets}/{health.expectedPockets}
          <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-60">pockets</span>
        </p>
      </div>
      {health.status !== "GREEN" && (
        <div className="mt-3 border-t border-current/15 pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
            Action queue · {health.actionableItems}
          </p>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            {actionItems.map((item) => (
              <Link key={item.key} href={item.href} className="rounded-lg border border-current/20 px-3 py-2 hover:bg-white/5">
                {item.label} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
