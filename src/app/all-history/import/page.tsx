import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-server";
import { importHistoricalArtifact } from "@/modules/historical/actions";
import { ImportActivityWatchPanel } from "./ImportActivityWatchPanel";

const ARTIFACT_FINGERPRINT =
  "932047bd8bdbf0f3b14672ce7fa9bf88a18e83e4de76e25fa30df3f74d987390";

export const dynamic = "force-dynamic";

export default async function HistoricalImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; result?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;

  // Unchanged from before this round -- the canonical, fingerprinted
  // artifact re-run. Preserved exactly as-is, just given its own labeled
  // section below alongside the new ActivityWatch importer, per the
  // brief: "Não destrua esse comportamento; preserve-o como uma seção
  // separada chamada Canonical import."
  async function runImport() {
    "use server";
    const result = await importHistoricalArtifact();
    if (!result.success) {
      throw new Error(result.error);
    }
    const outcome = result.skipped ? "skipped" : "imported";
    redirect(`/all-history/import?result=${outcome}&batch=${result.batchId}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="text-xl font-bold text-white">All History import</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Authenticated operator control for bringing historical evidence into
        MindBunker. Two independent tools, kept clearly separate below.
      </p>

      <div className="mt-6 space-y-6">
        <ImportActivityWatchPanel />

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Canonical import / maintenance
          </p>
          <p className="mt-1.5 text-sm text-zinc-400">
            The canonical, fingerprinted reference artifact. Re-running the same
            artifact content is an idempotent no-op.
          </p>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Fingerprint
            </p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-300">
              {ARTIFACT_FINGERPRINT}
            </p>
          </div>

          {params.result && params.batch && (
            <p
              role="status"
              className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200"
            >
              Batch #{params.batch}: {params.result === "skipped" ? "already active — no changes made" : "imported and activated"}.
            </p>
          )}

          <form action={runImport} className="mt-4">
            <button
              type="submit"
              className="min-h-12 w-full rounded-xl bg-amber-400 px-4 font-bold text-zinc-950 hover:bg-amber-300"
            >
              Run canonical import
            </button>
          </form>
        </section>
      </div>

      <a
        href="/mindbunker/all-history"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-zinc-400 hover:text-white"
      >
        ← Back to All History
      </a>
    </div>
  );
}
