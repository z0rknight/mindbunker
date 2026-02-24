"use client";

import { useState, useTransition } from "react";
import { updateAsset, deleteAsset } from "@/modules/investments/actions";

interface Asset {
  id: number;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
}

export function AssetActions({ id, asset }: { id: number; asset: Asset }) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(String(asset.currentPrice));
  const [amount, setAmount] = useState(String(asset.amount));

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateAsset(id, {
        currentPrice: Number(currentPrice),
        amount: Number(amount),
      });
      setEditOpen(false);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (!confirm("Delete this asset?")) return;
            startTransition(() => deleteAsset(id));
          }}
          disabled={isPending}
          className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40 cursor-pointer"
        >
          {isPending ? "..." : "✕"}
        </button>
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Update {asset.name}</h2>
              <button onClick={() => setEditOpen(false)} className="text-zinc-500 hover:text-white text-xl leading-none cursor-pointer">×</button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Current Price ($)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Update"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
