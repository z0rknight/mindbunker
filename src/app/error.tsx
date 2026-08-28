"use client";

import { useEffect } from "react";

// Reality Closure (26 Aug 2026) P0: this repo had NO error boundary
// anywhere under src/app before this. Next.js's default behavior for an
// uncaught render error in production (no error.tsx) is to unmount the
// tree client-side and show effectively nothing -- exactly the "renders
// blank" symptom reported for /client and /client/login. Whether or not
// that specific report traces to a since-fixed bug, a visible failure
// state belongs here regardless: "blank" must never be an acceptable
// failure mode for any route, public or authenticated. This is a plain,
// honest error screen -- no attempt to auto-recover into a broken state,
// no swallowing of the actual error.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("MindBunker route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-white">
      <p className="text-4xl" aria-hidden="true">⚠️</p>
      <h1 className="text-lg font-black">Something went wrong.</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        This page hit an unexpected error instead of loading. Try again, or
        reload the page. If this keeps happening, it&apos;s worth reporting
        exactly what page you were on.
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
    </main>
  );
}
