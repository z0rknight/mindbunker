export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <p className="text-2xl font-black text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}
