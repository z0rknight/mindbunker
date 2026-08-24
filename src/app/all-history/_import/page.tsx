import { importHistoricalArtifact } from "@/modules/historical/actions";

export default function HistoricalImportDevPage() {
  async function runImport() {
    "use server";
    await importHistoricalArtifact();
  }

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold text-white">Historical Import — LOCAL QA</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Development-only trigger for Sprint 1.2 P0.
      </p>

      <form action={runImport} className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-black"
        >
          Import historical artifact
        </button>
      </form>
    </div>
  );
}
