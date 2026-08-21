interface StatCardProps {
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: "violet" | "green" | "red" | "blue" | "amber" | "zinc";
  icon?: string;
}

const accentMap = {
  violet: "border-violet-600/30 bg-violet-600/5",
  green: "border-emerald-600/30 bg-emerald-600/5",
  red: "border-red-600/30 bg-red-600/5",
  blue: "border-blue-600/30 bg-blue-600/5",
  amber: "border-amber-600/30 bg-amber-600/5",
  zinc: "border-zinc-700 bg-zinc-800/50",
};

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
    <div className={`rounded-xl border p-4 ${accentMap[accent]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${valueAccentMap[accent]}`}>
        {value === null || value === undefined ? "—" : value}
      </p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
