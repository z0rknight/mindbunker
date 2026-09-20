"use client";

import { StatusTransition } from "@/components/os";

/**
 * The existing client status pill (same classes, same canonical label from the
 * server) with a restrained label/colour transition when the server later
 * sends a different status. It renders truth; it never decides it.
 */
export function ClientStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className: string;
}) {
  return (
    <span className={`${className} os-color-fade`} data-status={status}>
      <StatusTransition variant="inline" marker="none" label={label} status={status} />
    </span>
  );
}
