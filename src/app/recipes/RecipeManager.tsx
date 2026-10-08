"use client";

import {
  addDeliveryRecipeStep,
  createDeliveryRecipe,
  moveDeliveryRecipeStep,
  setDeliveryRecipeStepEnabled,
} from "@/modules/delivery-recipes/actions";
import { DELIVERY_RECIPE_GATES, DELIVERY_RECIPE_GATE_LABELS } from "@/modules/delivery-recipes/config";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type RecipeManagerRecipe = {
  id: number;
  name: string;
  applicability: string;
  isActive: boolean;
  steps: Array<{
    id: number;
    label: string;
    gate: (typeof DELIVERY_RECIPE_GATES)[number];
    position: number;
    qualityStandard: string | null;
    enabled: boolean;
  }>;
};

export function RecipeManager({ recipes }: { recipes: RecipeManagerRecipe[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

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
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          run(async () => {
            const result = await createDeliveryRecipe({ name: data.get("name"), applicability: data.get("applicability") });
            if (result.success) form.reset();
            return result;
          });
        }}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">New reusable Recipe</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <input name="name" required maxLength={120} placeholder="Long-form editorial" className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
          <input name="applicability" required maxLength={240} placeholder="When this Recipe applies" className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
          <button disabled={pending} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-40">Create</button>
        </div>
      </form>

      {recipes.length === 0 && (
        <section className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">No Recipes yet.</section>
      )}

      {recipes.map((recipe) => (
        <section key={recipe.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Delivery Recipe</p>
            <h2 className="mt-1 text-lg font-black text-white">{recipe.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{recipe.applicability}</p>
          </div>

          <ol className="mt-4 space-y-2">
            {recipe.steps.map((step, index) => (
              <li key={step.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${step.enabled ? "border-zinc-800 bg-zinc-950/55" : "border-zinc-900 bg-zinc-950/25 opacity-60"}`}>
                <div>
                  <p className="text-sm font-black text-white">{index + 1}. {step.label}</p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">{DELIVERY_RECIPE_GATE_LABELS[step.gate]}</p>
                  {step.qualityStandard && <p className="mt-1 text-xs text-zinc-500">{step.qualityStandard}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={pending || index === 0} onClick={() => run(() => moveDeliveryRecipeStep(step.id, "UP"))} className="min-h-9 rounded-lg border border-zinc-700 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-30">↑</button>
                  <button type="button" disabled={pending || index === recipe.steps.length - 1} onClick={() => run(() => moveDeliveryRecipeStep(step.id, "DOWN"))} className="min-h-9 rounded-lg border border-zinc-700 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-30">↓</button>
                  <button type="button" disabled={pending} onClick={() => run(() => setDeliveryRecipeStepEnabled(step.id, !step.enabled))} className="min-h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-300 disabled:opacity-30">
                    {step.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <form
            className="mt-4 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-[1fr_auto_1.2fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              run(async () => {
                const result = await addDeliveryRecipeStep({
                  recipeId: recipe.id,
                  label: data.get("label"),
                  gate: data.get("gate"),
                  qualityStandard: data.get("qualityStandard"),
                });
                if (result.success) form.reset();
                return result;
              });
            }}
          >
            <input name="label" required maxLength={120} placeholder="Step name" className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
            <select name="gate" className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white">
              {DELIVERY_RECIPE_GATES.map((gate) => <option key={gate} value={gate}>{DELIVERY_RECIPE_GATE_LABELS[gate]}</option>)}
            </select>
            <input name="qualityStandard" maxLength={300} placeholder="Completion standard (optional)" className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
            <button disabled={pending} className="min-h-10 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 text-xs font-black text-violet-200 hover:bg-violet-500/20 disabled:opacity-40">Add step</button>
          </form>
        </section>
      ))}

      {feedback && <p role="status" className="text-sm font-bold text-emerald-300">{feedback}</p>}
      {error && <p role="alert" className="text-sm font-bold text-red-300">{error}</p>}
    </div>
  );
}
