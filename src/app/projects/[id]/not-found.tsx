import Link from "next/link";

// Global Health Audit — route resilience (Section 12-13): a nonexistent or
// malformed project id used to fall through to Next.js's own bare default
// not-found render (no app chrome, effectively a blank body in
// html#__next_error__). page.tsx already calls notFound() for both a
// malformed id and a missing row; this boundary is what was actually
// missing -- an intentional, on-brand "not found" state instead of the
// framework default. Styled to match the equivalent state already shipped
// on the Productivity page for a missing video.
export default function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:p-6">
      <section
        aria-labelledby="project-not-found-title"
        className="mb-7 rounded-2xl border border-red-900/50 bg-red-950/10 p-6 text-center"
      >
        <h2 id="project-not-found-title" className="text-lg font-black text-red-200">
          Project not found
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          This project does not exist, or the id in the link is malformed.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/projects"
            className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-black text-zinc-200 hover:border-violet-500/60"
          >
            Back to Projects
          </Link>
          <Link
            href="/productivity"
            className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-black text-zinc-200 hover:border-violet-500/60"
          >
            Back to Productivity
          </Link>
        </div>
      </section>
    </div>
  );
}
