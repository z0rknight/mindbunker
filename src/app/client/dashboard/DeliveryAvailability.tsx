"use client";

import { useState } from "react";
import { StatusTransition, useUpdateFlash } from "@/components/os";

/**
 * Delivery is its own fact (a delivery link exists), separate from approval
 * and completion. Shown only for completed videos whose delivery link is the
 * primary link. When the server later reports the link, the state label
 * changes and the action appears once with a brief brand-tinted marker (never
 * the green approval treatment). Nothing animates on first load.
 */
export function DeliveryAvailability({
  href,
  label = "Watch",
}: {
  href: string | null;
  label?: string;
}) {
  const available = href !== null;
  const flash = useUpdateFlash(available, { tone: "brand" });
  const [previous, setPrevious] = useState(available);
  const [entering, setEntering] = useState(false);
  if (available !== previous) {
    setPrevious(available);
    setEntering(available);
  }
  return (
    <section
      className="os-flash rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
      data-flash={flash}
      aria-label="Delivery"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Delivery</p>
        <StatusTransition
          tone={available ? "brand" : "neutral"}
          label={available ? "Available" : "Not available yet"}
        />
      </div>
      {available ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-enter={entering ? "true" : undefined}
          onAnimationEnd={() => setEntering(false)}
          className="os-enter mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500"
        >
          {label}
        </a>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Your delivery link will appear here when RMEDIA adds it.
        </p>
      )}
    </section>
  );
}
