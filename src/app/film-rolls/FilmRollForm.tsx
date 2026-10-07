"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFilmRoll } from "@/modules/film-rolls/actions";
import { FILM_ROLL_STATUSES, FILM_ROLL_STATUS_LABELS } from "@/modules/film-rolls/config";

export function FilmRollForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const field = "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none";
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-red-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-red-600">+ New Film Roll</button>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
      <form ref={formRef} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-5 sm:max-w-xl sm:rounded-2xl" onSubmit={(event) => {
        event.preventDefault(); setError(null);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createFilmRoll(data);
          if (!result.success) return setError(result.error);
          formRef.current?.reset(); setOpen(false); router.refresh();
        });
      }}>
        <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-red-400">Inventory, not hosting</p><h2 className="mt-1 text-lg font-black text-white">New Film Roll</h2></div><button type="button" onClick={() => setOpen(false)} className="text-2xl text-zinc-500">×</button></div>
        <div className="space-y-4">
          <label className="block text-xs text-zinc-400">Name<input name="name" required className={`${field} mt-1`} placeholder="October coffee / 35mm warm" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Captured from<input name="capturedFrom" type="date" required className={`${field} mt-1`} /></label><label className="text-xs text-zinc-400">Captured to<input name="capturedTo" type="date" className={`${field} mt-1`} /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Status<select name="status" className={`${field} mt-1`}>{FILM_ROLL_STATUSES.map((status) => <option key={status} value={status}>{FILM_ROLL_STATUS_LABELS[status]}</option>)}</select></label><label className="text-xs text-zinc-400">Rating<select name="rating" className={`${field} mt-1`}>{[0,1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label></div>
          <label className="block text-xs text-zinc-400">Aesthetic<input name="aesthetic" className={`${field} mt-1`} placeholder="Soft daylight, handheld, warm grain" /></label>
          <label className="block text-xs text-zinc-400">Tags<input name="tags" className={`${field} mt-1`} placeholder="coffee, backstage, morning, 35mm" /></label>
          <label className="block text-xs text-zinc-400">Subject inventory<textarea name="subjects" rows={4} className={`${field} mt-1`} placeholder={'coffee: 12\nwalking: 6\nediting desk: 9'} /><span className="mt-1 block text-[10px] text-zinc-600">One subject per line as “label: count”.</span></label>
          <label className="block text-xs text-zinc-400">Soundtrack / rhythm note<input name="soundtrack" className={`${field} mt-1`} /></label>
          <label className="block text-xs text-zinc-400">NAS / external location<input name="storageReference" className={`${field} mt-1`} placeholder="NAS / Film Rolls / 2026-10 / Roll 03" /></label>
          <label className="block text-xs text-zinc-400">Notes<textarea name="notes" rows={3} className={`${field} mt-1`} /></label>
        </div>
        {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={pending} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save Film Roll"}</button></div>
      </form>
    </div>}
  </>;
}
