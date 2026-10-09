"use client";

import {
  attachDeliveryRecipeToVideo,
  getVideoRecipeWorkspace,
  transitionDeliveryRecipeStep,
} from "@/modules/delivery-recipes/actions";
import { DELIVERY_RECIPE_GATE_LABELS, type DeliveryRecipeStepState } from "@/modules/delivery-recipes/config";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

type Workspace = Extract<Awaited<ReturnType<typeof getVideoRecipeWorkspace>>, { success: true }>["data"];

const STATE_MARK: Record<DeliveryRecipeStepState, string> = {
  NOT_STARTED: "○",
  ACTIVE: "●",
  DONE: "✓",
  N_A: "—",
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${remainder}m`;
}
function primaryTransition(state: DeliveryRecipeStepState): {
  label: string;
  target: DeliveryRecipeStepState;
} {
  if (state === "ACTIVE") return { label: "Done", target: "DONE" };
  if (state === "DONE") return { label: "Reopen", target: "ACTIVE" };
  if (state === "N_A") return { label: "Restore", target: "NOT_STARTED" };
  return { label: "Start", target: "ACTIVE" };
}

export function DeliveryRecipePanel({ videoId }: { videoId: number }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [recipeId, setRecipeId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const result = await getVideoRecipeWorkspace(videoId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setWorkspace(result.data);
    if (!recipeId && result.data.templates[0]) setRecipeId(String(result.data.templates[0].id));
  }

  useEffect(() => {
    let cancelled = false;
    void getVideoRecipeWorkspace(videoId).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setError(result.error);
        return;
      }
      setWorkspace(result.data);
      if (result.data.templates[0]) setRecipeId(String(result.data.templates[0].id));
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  function run(action: () => Promise<{ success: boolean; message?: string; error?: string }>) {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Recipe was not updated.");
        return;
      }
      setFeedback(result.message ?? "Saved.");
      await refresh();
    });
  }

  if (!workspace && !error) {
    return <section className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">Loading Delivery Recipe…</section>;
  }
  if (!workspace) {
    return <section className="rounded-2xl border border-red-900/50 bg-red-950/10 p-4 text-sm text-red-300">{error}</section>;
  }

  const instance = workspace.instance;
  const currentStep = instance?.summary.currentStep ?? null;
  const nextStep = instance?.summary.nextStep ?? null;
  return (
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/20 to-zinc-950/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Delivery Recipe</p>
          <h3 className="mt-1 text-lg font-black text-white">{instance?.recipeName ?? "No Recipe"}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {instance
              ? `${instance.summary.done}/${instance.summary.applicable} applicable steps complete`
              : "Attach a reusable quality path to this Video."}
          </p>
        </div>
        <Link href="/recipes" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:border-violet-500/50 hover:text-white">
          Manage Recipes
        </Link>
      </div>

      {!instance ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          {!workspace.video.mutable ? (
            <p className="text-xs font-bold text-amber-300">Historical Video · no Recipe snapshot was attached.</p>
          ) : workspace.templates.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={recipeId}
                onChange={(event) => setRecipeId(event.target.value)}
                disabled={!workspace.video.mutable || pending}
                className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-white"
              >
                {workspace.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.stepCount} steps
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!workspace.video.mutable || pending || !recipeId}
                onClick={() => run(() => attachDeliveryRecipeToVideo(videoId, Number(recipeId)))}
                className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Attach Recipe
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Create a Recipe with at least one enabled step first.</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="recipe-current-next">
            <div className={`rounded-xl border p-4 ${currentStep ? "border-violet-500/40 bg-violet-950/25" : "border-zinc-800 bg-zinc-950/45"}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Current step</p>
              <p className="mt-1 text-base font-black text-white">{currentStep?.label ?? (instance.summary.complete ? "Recipe complete" : "No active step")}</p>
              {currentStep?.qualityStandard && <p className="mt-1 text-xs leading-5 text-zinc-400">{currentStep.qualityStandard}</p>}
              {currentStep && (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={!workspace.video.mutable || pending} onClick={() => run(() => transitionDeliveryRecipeStep(videoId, currentStep.id, "N_A"))} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-400 hover:text-white disabled:opacity-40">N/A</button>
                  <button type="button" disabled={!workspace.video.mutable || pending} onClick={() => run(() => transitionDeliveryRecipeStep(videoId, currentStep.id, "DONE"))} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-40">Mark done</button>
                </div>
              )}
            </div>
            <div className={`rounded-xl border p-4 ${!currentStep && nextStep ? "border-cyan-500/35 bg-cyan-950/20" : "border-zinc-800 bg-zinc-950/45"}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Next step</p>
              <p className="mt-1 text-base font-black text-white">{nextStep?.label ?? "No next step"}</p>
              {nextStep?.qualityStandard && <p className="mt-1 text-xs leading-5 text-zinc-400">{nextStep.qualityStandard}</p>}
              {nextStep && !currentStep && (
                <button type="button" disabled={!workspace.video.mutable || pending} onClick={() => run(() => transitionDeliveryRecipeStep(videoId, nextStep.id, "ACTIVE"))} className="mt-3 min-h-10 rounded-lg bg-violet-600 px-4 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-40">Start next</button>
              )}
              {nextStep && currentStep && <p className="mt-3 text-[11px] font-bold text-zinc-600">Finish or reopen the current step before starting this one.</p>}
            </div>
          </div>

          <details className="group mt-4 rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
            <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-wider text-zinc-500">
              <span className="mr-1.5 inline-block transition group-open:rotate-90">▸</span>All Recipe steps · {instance.summary.done}/{instance.summary.applicable}
            </summary>
            <ol className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
              {instance.steps.map((step) => {
                const primary = primaryTransition(step.state);
                return (
                  <li key={step.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${step.state === "ACTIVE" ? "border-violet-500/35 bg-violet-950/20" : "border-zinc-800 bg-zinc-950/55"}`}>
                    <div className="flex min-w-0 gap-3">
                      <span className={`mt-0.5 text-base font-black ${step.state === "DONE" ? "text-emerald-300" : step.state === "ACTIVE" ? "text-violet-300" : "text-zinc-600"}`} aria-hidden="true">{STATE_MARK[step.state]}</span>
                      <div className="min-w-0"><p className="text-sm font-black text-white">{step.label}</p><p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">{DELIVERY_RECIPE_GATE_LABELS[step.gate]}</p>{step.qualityStandard && <p className="mt-1 text-xs text-zinc-500">{step.qualityStandard}</p>}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {(step.state === "NOT_STARTED" || step.state === "ACTIVE") && <button type="button" disabled={!workspace.video.mutable || pending} onClick={() => run(() => transitionDeliveryRecipeStep(videoId, step.id, "N_A"))} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-400 hover:text-white disabled:opacity-40">N/A</button>}
                      <button type="button" disabled={!workspace.video.mutable || pending} onClick={() => run(() => transitionDeliveryRecipeStep(videoId, step.id, primary.target))} className={`min-h-10 rounded-lg px-3 text-xs font-black disabled:opacity-40 ${step.state === "ACTIVE" ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-violet-600 text-white hover:bg-violet-500"}`}>{primary.label}</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </details>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-500">
            <p>
              Canonical Session time: <span className="font-black text-zinc-300">{formatDuration(instance.work.closedSeconds)}</span>
              {` · ${instance.work.sessionCount} session${instance.work.sessionCount === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1">Stage time: <span className="font-black text-zinc-300">UNKNOWN</span> · Recipe timestamps never pretend to be worked time.</p>
          </div>

          {instance.events.length > 0 && (
            <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-500">Recent transitions · {instance.events.length}</summary>
              <ul className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                {instance.events.map((event) => (
                  <li key={event.id} className="text-xs text-zinc-500">
                    <span className="font-bold text-zinc-300">{event.stepLabel}</span> · {event.previousState.replaceAll("_", " ")} → {event.newState.replaceAll("_", " ")} · {new Date(event.occurredAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {feedback && <p role="status" className="mt-3 text-xs font-bold text-emerald-300">{feedback}</p>}
      {error && <p role="alert" className="mt-3 text-xs font-bold text-red-300">{error}</p>}
    </section>
  );
}
