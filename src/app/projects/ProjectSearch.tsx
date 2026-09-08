"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ProjectSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  // Debounced query-param push -- same filter-via-URL pattern as
  // ClientFilter/StatusFilter, just with a short delay so typing doesn't
  // trigger a server round-trip per keystroke.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value === current) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value);
      else params.delete("q");
      router.push(`/projects${params.toString() ? `?${params.toString()}` : ""}`);
    }, 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Search projects…"
      aria-label="Search projects"
      className="min-h-9 w-full max-w-[220px] rounded-full border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-bold text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cyan-500"
    />
  );
}
