import Link from "next/link";
import type { EquipmentOwnership } from "@/modules/equipment/config";

// Plain Link-based tabs (no client component / no JS needed) -- same
// "query param drives the filtered server render" shape as
// finance/debts/ClientFilter.tsx, just rendered as tabs instead of a
// select since there are only 3 fixed values (Wave 1 brief §4:
// "[ALL][PERSONAL][RMEDIA] filter tabs").
const TABS: Array<{ value: EquipmentOwnership | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PERSONAL", label: "Personal" },
  { value: "RMEDIA", label: "RMedia" },
];

export function OwnershipTabs({
  active,
  basePath,
}: {
  active: EquipmentOwnership | "ALL";
  basePath: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        const href = tab.value === "ALL" ? basePath : `${basePath}?ownership=${tab.value}`;
        return (
          <Link
            key={tab.value}
            href={href}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              isActive
                ? "bg-violet-600/20 text-violet-300 border border-violet-600/30"
                : "text-zinc-500 hover:text-white border border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
