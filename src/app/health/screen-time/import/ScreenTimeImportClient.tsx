"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importScreenTimeSnapshot } from "@/modules/screen-time/actions";

const EXAMPLE_PAYLOAD = `{
  "periodStart": "2026-08-17",
  "periodEnd": "2026-08-23",
  "device": "iPhone",
  "totalHours": 34.5,
  "categories": [
    { "name": "Social", "hours": 10.2 },
    { "name": "Productivity", "hours": 8.1 },
    { "name": "Entertainment", "hours": 6.0 }
  ],
  "apps": [
    { "name": "Instagram", "hours": 5.1, "category": "Social" },
    { "name": "Slack", "hours": 4.0, "category": "Productivity" },
    { "name": "Safari", "hours": 3.8, "category": "Productivity" }
  ]
}`;

type ResultState =
  | { kind: "success"; skipped: boolean; warnings: string[]; message: string }
  | { kind: "error"; errors: string[] }
  | null;

export function ScreenTimeImportClient() {
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<ResultState>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setResult({ kind: "error", errors: ["That isn't valid JSON — check for a stray comma or missing quote."] });
      return;
    }
    startTransition(async () => {
      const outcome = await importScreenTimeSnapshot(parsed);
      if (outcome.success) {
        setResult({
          kind: "success",
          skipped: outcome.skipped,
          warnings: outcome.warnings,
          message: outcome.message,
        });
        router.refresh();
      } else {
        setResult({ kind: "error", errors: outcome.errors });
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🖥️ Screen Time — Manual Import</h1>
        <p className="mt-2 rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          MANUAL APPLE SCREEN TIME SNAPSHOT. This paste-in prototype never
          reads your device automatically — there is no OCR and no
          background collector. Prepare the JSON externally (e.g. by asking
          an assistant to transcribe Apple&rsquo;s own Screen Time screens)
          and paste the result below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Snapshot JSON
          </label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder={EXAMPLE_PAYLOAD}
            rows={16}
            spellCheck={false}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setPayload(EXAMPLE_PAYLOAD)}
            className="mt-1.5 text-xs text-violet-400 hover:text-violet-300"
          >
            Fill with example payload
          </button>
        </div>

        <button
          type="submit"
          disabled={isPending || !payload.trim()}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Importing..." : "Import Snapshot"}
        </button>
      </form>

      {result?.kind === "success" && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            result.skipped
              ? "border-zinc-700 bg-zinc-900 text-zinc-300"
              : "border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          <p>{result.skipped ? "⏭️ " : "✅ "}{result.message}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠️ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-4 rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">
          <p className="font-semibold">Couldn&rsquo;t import:</p>
          <ul className="mt-1 space-y-0.5">
            {result.errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
