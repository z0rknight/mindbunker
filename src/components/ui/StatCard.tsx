interface StatCardProps {
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: "violet" | "green" | "red" | "blue" | "amber" | "zinc";
  icon?: string;
}

const valueAccentMap = {
  violet: "text-violet-400",
  green: "text-emerald-400",
  red: "text-red-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  zinc: "text-white",
};

export function StatCard({ label, value, sub, accent = "zinc", icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        {icon && <span className="text-lg grayscale opacity-70">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${valueAccentMap[accent]}`}>
        {value === null || value === undefined ? "—" : value}
      </p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
