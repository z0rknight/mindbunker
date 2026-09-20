"use client";

import { useDepartures } from "./hooks";

/**
 * Acknowledges items that left a queue after the operator resolved them, so a
 * row that disappears is never silent: a polite live-region message (always
 * mounted so it is reliably announced) plus a brief visible line with a check.
 * Wording is neutral because the queue only knows the item is gone.
 */
export function DepartureNotice({ ids, noun }: { ids: readonly string[]; noun: string }) {
  const count = useDepartures(ids);
  const text = count > 0 ? `${count} ${noun}${count === 1 ? "" : "s"} resolved` : "";
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {text}
      </p>
      {count > 0 && (
        <p className="os-arrive mt-3 flex items-center gap-2 text-xs font-bold text-emerald-300" data-enter="true">
          <svg className="os-ck" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
          {text}
        </p>
      )}
    </>
  );
}
