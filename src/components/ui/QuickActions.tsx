"use client";

import { useState, useTransition } from "react";
import { logFinishedVideo } from "@/modules/productivity/actions";
import { addTransaction } from "@/modules/finance/actions";
import { upsertHealthLog } from "@/modules/health/actions";

// ─── Finished Video Button ────────────────────────────────────────────────────

export function FinishedVideoButton() {
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);

  function handleClick() {
    startTransition(async () => {
      await logFinishedVideo();
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm transition-all w-full
        ${flash
          ? "bg-emerald-500 text-white scale-95"
          : "bg-violet-600 hover:bg-violet-500 text-white active:scale-95"
        }
        ${isPending ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span className="text-2xl">{flash ? "✅" : "🎬"}</span>
      <span>{flash ? "Logged!" : isPending ? "Logging..." : "Finished Video"}</span>
    </button>
  );
}

// ─── Add Income Button ────────────────────────────────────────────────────────

export function AddIncomeButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Freelance");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    startTransition(async () => {
      await addTransaction({
        type: "income",
        amount: Number(amount),
        category,
        notes,
      });
      setAmount("");
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-600 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">💰</span>
        <span>Add Income</span>
      </button>

      {open && (
        <Modal title="Add Income" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Freelance"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Client name, project..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Add Income"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Add Expense Button ───────────────────────────────────────────────────────

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Software");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    startTransition(async () => {
      await addTransaction({
        type: "expense",
        amount: Number(amount),
        category,
        notes,
      });
      setAmount("");
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-red-800 hover:bg-red-700 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">💸</span>
        <span>Add Expense</span>
      </button>

      {open && (
        <Modal title="Add Expense" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Software, Equipment..."
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Description..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Add Expense"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Log Today (Health) Button ────────────────────────────────────────────────

export function LogTodayButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sleep, setSleep] = useState("");
  const [caffeine, setCaffeine] = useState("");
  const [screenTime, setScreenTime] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await upsertHealthLog({
        sleepHours: sleep ? Number(sleep) : undefined,
        caffeineMg: caffeine ? Number(caffeine) : undefined,
        screenTimeHours: screenTime ? Number(screenTime) : undefined,
        substancesNotes: notes || undefined,
      });
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-blue-800 hover:bg-blue-700 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">🫀</span>
        <span>Log Today</span>
      </button>

      {open && (
        <Modal title="Log Today's Health" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Sleep (hours)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                placeholder="7.5"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Caffeine (mg)</label>
              <input
                type="number"
                min="0"
                value={caffeine}
                onChange={(e) => setCaffeine(e.target.value)}
                placeholder="200"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Screen Time (hours)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={screenTime}
                onChange={(e) => setScreenTime(e.target.value)}
                placeholder="8"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Substances, mood..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Log"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
