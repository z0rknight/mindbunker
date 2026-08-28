"use client";

import { useEffect } from "react";

// Companion to error.tsx: error.tsx cannot catch an error thrown by the
// ROOT layout itself (e.g. AppShell/route-classification blowing up
// before any page renders) -- Next.js requires a separate global-error.tsx
// for that, which must render its own <html>/<body> since the root layout
// is exactly what failed. Same rationale as error.tsx: a visible failure
// beats an unmounted blank page.
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("MindBunker root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-white">
        <p className="text-4xl" aria-hidden="true">⚠️</p>
        <h1 className="text-lg font-black">Something went wrong.</h1>
        <p className="max-w-sm text-sm text-zinc-500">
          The app itself hit an unexpected error before this page could load.
        </p>
        {error.digest && (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-[11px] text-zinc-600">
            digest: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white hover:bg-violet-500"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
