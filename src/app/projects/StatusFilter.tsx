"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/modules/projects/config";

// Tuesday Patch Priority 2: same query-param filter pattern as
// ClientFilter -- no new state management, no separate Projects surface.
export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`/projects${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-cyan-500"
      aria-label="Filter projects by status"
    >
      <option value="">ALL STATUSES</option>
      {PROJECT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {PROJECT_STATUS_LABELS[status].toUpperCase()}
        </option>
      ))}
    </select>
  );
}
