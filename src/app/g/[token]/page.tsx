import type { Metadata } from "next";
import { BriefingForm } from "./BriefingForm";
import { GatewayOpenTracker } from "./GatewayOpenTracker";
import { getPublicGatewayView } from "@/modules/gateway/data";
import { BookingPanel } from "./BookingPanel";
import { getAvailableBookingSlots } from "@/modules/booking/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Client Gateway | RMedia",
  description: "A private next step for your RMedia project.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function GatewayFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-sm font-black text-violet-300">
              RM
            </div>
            <div>
              <p className="text-sm font-black tracking-wide text-white">RMEDIA</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                Client Gateway
              </p>
            </div>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-zinc-500">
            Private link
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function GatewayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gateway = await getPublicGatewayView(token);

  if (gateway.status === "unavailable") {
    return (
      <GatewayFrame>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-400">
            ↗
          </div>
          <h1 className="text-2xl font-black text-white">Link unavailable</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
            This private invitation is invalid, expired, or has been replaced.
            Ask Emmanuel for a new link.
          </p>
        </section>
      </GatewayFrame>
    );
  }

  const availability = await getAvailableBookingSlots(token, "UTC");

  return (
    <GatewayFrame>
      <GatewayOpenTracker token={token} />
      <section className="mb-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl shadow-black/30">
        <div className="border-b border-zinc-800 bg-gradient-to-br from-violet-500/12 via-transparent to-cyan-500/5 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
            Welcome, {gateway.clientName}
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
            Let&apos;s make the next step obvious.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            A short project briefing gives Emmanuel enough context to respond
            without a long back-and-forth.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-zinc-800 px-2 py-3 text-center">
          <div className="px-2">
            <p className="text-xs font-black text-violet-300">01</p>
            <p className="mt-1 text-[10px] text-zinc-500">Brief</p>
          </div>
          <div className="px-2 opacity-55">
            <p className="text-xs font-black text-zinc-500">02</p>
            <p className="mt-1 text-[10px] text-zinc-600">Call if useful</p>
          </div>
          <div className="px-2 opacity-55">
            <p className="text-xs font-black text-zinc-500">03</p>
            <p className="mt-1 text-[10px] text-zinc-600">Next step</p>
          </div>
        </div>
      </section>

      <div className="space-y-5">
      {gateway.briefingSubmitted ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-7">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
            ✓
          </div>
          <h2 className="text-xl font-black text-white">Brief received</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Emmanuel will review it and contact you with the clearest next step.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-black text-white">Project briefing</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Three essentials first. Extra context stays optional.
            </p>
          </div>
          <BriefingForm
            token={token}
            defaultServiceInterest={gateway.serviceInterest}
          />
        </section>
      )}
      <BookingPanel
        key={gateway.booking?.startsAt ?? "new-booking"}
        token={token}
        initialBooking={gateway.booking}
        initialSlots={availability.success ? availability.slots : []}
        initialError={availability.success ? "" : availability.error}
        initialTimezone={
          availability.success ? availability.operatorTimezone : "UTC"
        }
      />
      </div>
    </GatewayFrame>
  );
}
