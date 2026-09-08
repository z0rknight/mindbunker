"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS: Array<{ value: "attention" | "recent"; label: string }> = [
  { value: "attention", label: "SORT: ATTENTION" },
  { value: "recent", label: "SORT: RECENTLY ACTIVE" },
];

export function SortToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") === "recent" ? "recent" : "attention";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "attention") params.set("sort", value);
    else params.delete("sort");
    router.push(`/projects${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-cyan-500"
      aria-label="Sort projects"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
