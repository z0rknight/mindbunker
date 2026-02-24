"use client";

import { useState, useTransition } from "react";
import { addAsset } from "@/modules/investments/actions";

export function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount || !avgBuyPrice || !currentPrice) return;
    startTransition(async () => {
      await addAsset({
        name,
        amount: Number(amount),
        avgBuyPrice: Number(avgBuyPrice),
        currentPrice: Number(currentPrice),
      });
      setAmount("");
      setAvgBuyPrice("");
      setCurrentPrice("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
      >
        <span>+</span> Add Asset
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Add Asset</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xl leading-none cursor-pointer">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Ticker *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="BTC"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 uppercase"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.5"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Avg Buy Price ($) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={avgBuyPrice}
                  onChange={(e) => setAvgBuyPrice(e.target.value)}
                  placeholder="45000"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Current Price ($) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="65000"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Add Asset"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
