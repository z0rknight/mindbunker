"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Monday Real-Operation Pre-Freeze §8: a client filter near Active
// Projects so multiple clients' similarly-named projects stay
// distinguishable at 20+ projects. Deliberately just a query-param filter
// on the existing Projects page -- no separate Projects surface.
export function ClientFilter({
  clients,
}: {
  clients: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("client") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("client", value);
    else params.delete("client");
    router.push(`/projects${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-cyan-500"
      aria-label="Filter projects by client"
    >
      <option value="">ALL CLIENTS</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
