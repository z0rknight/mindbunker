import { notFound } from "next/navigation";
import { getPublicOffer } from "@/modules/commercial-operating/data";
import { offerLabel } from "@/modules/commercial-operating/core";
import { parseScopeLines } from "@/modules/quotes/core";

export const dynamic = "force-dynamic";

function money(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export default async function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getPublicOffer(token);
  if (!offer) notFound();
  const continuePath = `/start?entry=offer&offer_ref=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-zinc-100 sm:py-16">
      <article className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl shadow-black/40">
        <header className="border-b border-zinc-800 bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-950 p-6 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-400">RMEDIA · Commercial Offer</p>
          <p className="mt-8 text-sm text-zinc-500">Prepared for</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">{offer.clientName}</h1>
          <p className="mt-4 text-lg font-semibold text-zinc-200">{offerLabel(offer.offerType)}</p>
          {offer.summary && <p className="mt-3 max-w-xl leading-7 text-zinc-400">{offer.summary}</p>}
        </header>

        <div className="space-y-8 p-6 sm:p-10">
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Scope</h2>
            <ul className="mt-4 space-y-3">
              {parseScopeLines(offer.scopeText).map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-6 text-zinc-200">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <dl className="grid gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
            <div className="bg-zinc-950 p-4"><dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Investment</dt><dd className="mt-2 font-black text-white">{money(offer.amountCents, offer.currency)}</dd></div>
            <div className="bg-zinc-950 p-4"><dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Timing assumption</dt><dd className="mt-2 font-black text-white">{offer.turnaroundLabel}</dd></div>
            <div className="bg-zinc-950 p-4"><dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Revision rounds</dt><dd className="mt-2 font-black text-white">{offer.revisionsIncluded}</dd></div>
          </dl>

          <p className="text-xs leading-5 text-zinc-500">
            Valid until {offer.expiresAt?.toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" })}. Payment activity is confirmed separately; opening an external payment link does not mark this Offer as paid or accepted.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            {offer.paymentUrl && (
              <a href={offer.paymentUrl} rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-500">
                {offer.paymentLabel || "Pay with Wise"} ↗
              </a>
            )}
            <a href={continuePath} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-zinc-700 px-5 text-sm font-black text-white transition hover:bg-zinc-800">
              Continue with Emmanuel
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
