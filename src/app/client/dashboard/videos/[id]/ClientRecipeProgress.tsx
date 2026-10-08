import type { ClientRecipeStage } from "@/modules/delivery-recipes/core";

const MARK = { DONE: "✓", ACTIVE: "●", UP_NEXT: "○", NOT_STARTED: "○" } as const;

export function ClientRecipeProgress({ stages }: { stages: ClientRecipeStage[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Production progress</p>
      <ol className="mt-3 space-y-2">
        {stages.map((stage) => (
          <li key={stage.key} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-2.5">
            <span className="text-sm font-bold text-zinc-200">{stage.label}</span>
            <span className={`text-xs font-black uppercase tracking-wider ${stage.state === "DONE" ? "text-emerald-300" : stage.state === "ACTIVE" ? "text-violet-300" : "text-zinc-600"}`}>
              <span aria-hidden="true">{MARK[stage.state]} </span>{stage.state === "UP_NEXT" ? "Next" : stage.state.replaceAll("_", " ")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
