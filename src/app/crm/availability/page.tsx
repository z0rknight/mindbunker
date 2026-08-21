import Link from "next/link";
import { getAdminBookingConfiguration } from "@/modules/booking/data";
import { AvailabilityForm } from "./AvailabilityForm";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const configuration = await getAdminBookingConfiguration();

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:p-8">
      <Link href="/crm" className="inline-flex min-h-11 items-center text-sm text-zinc-500 transition hover:text-zinc-300">
        ← Back to CRM
      </Link>
      <div className="mb-6 mt-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Client Gateway</p>
        <h1 className="mt-2 text-2xl font-black text-white">Call availability</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          These windows create the choices shown in private Gateway links. Existing bookings are automatically removed from the list.
        </p>
      </div>
      <AvailabilityForm
        initialSettings={configuration.settings}
        initialWindows={configuration.windows}
      />
    </div>
  );
}

