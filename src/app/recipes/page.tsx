import { OPERATOR_WORKSPACE_CLASS } from "@/components/layout/workspace";
import { getRecipeManagement } from "@/modules/delivery-recipes/actions";
import Link from "next/link";
import { RecipeManager } from "./RecipeManager";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await getRecipeManagement();
  return (
    <div className={OPERATOR_WORKSPACE_CLASS}>
      <header className="mb-7 border-b border-zinc-800 pb-5">
        <Link href="/war-room" className="inline-flex min-h-10 items-center text-sm font-bold text-zinc-500 hover:text-zinc-300">← War Room</Link>
        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Quality custody</p>
        <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Delivery Recipes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Reusable standards that snapshot onto a Video. Template edits never rewrite historical execution.</p>
      </header>
      <RecipeManager recipes={recipes} />
    </div>
  );
}
