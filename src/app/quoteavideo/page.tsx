import type { Metadata } from "next";
import { resolveReferral } from "@/modules/referrals/core";
import { QuoteRequestForm } from "./QuoteRequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request a video | RMedia",
  description: "Request a quote for a video project with RMedia.",
};

// A page view only renders -- it never writes. A Lead exists only after an
// explicit form submission (submitQuoteRequest / submitPublicBookingRequest).
export default async function QuoteAVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const referral = resolveReferral(Array.isArray(ref) ? ref[0] : ref);
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-sm font-black text-violet-300">
            RM
          </div>
          <div>
            <p className="text-sm font-black tracking-wide text-white">RMEDIA</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
              Request a video
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
          {referral && (
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
              {referral.visitorLine}
            </p>
          )}
          <h1 className="text-2xl font-black text-white">Tell us about your video</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
            Fill this out and Emmanuel will follow up with a quote — no call
            required. If a scoped request needs more back-and-forth, he&apos;ll
            reach out to schedule one.
          </p>
          <div className="mt-6">
            <QuoteRequestForm referralKey={referral?.key} />
          </div>
        </section>
      </div>
    </main>
  );
}
