"use client";

import { useState, useTransition } from "react";
import { addTransaction } from "@/modules/finance/actions";
import { upsertHealthLog } from "@/modules/health/actions";

export {
  AddRevisionButton,
  FinishedVideoButton,
  PlanVideoButton,
} from "./ProductivityQuickActions";

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
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
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
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
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
                inputMode="decimal"
                step="0.5"
                min="0"
                max="24"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                placeholder="7.5"
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Caffeine (mg)</label>
              <input
                type="number"
                inputMode="numeric"
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
                inputMode="decimal"
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

// ─── Log Bike Ride Button ─────────────────────────────────────────────────────

export function LogBikeRideButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [km, setKm] = useState("");
  const [minutes, setMinutes] = useState("");
  const [flash, setFlash] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await upsertHealthLog({
        cyclingKm: km ? Number(km) : undefined,
        cyclingMinutes: minutes ? Number(minutes) : undefined,
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      setKm("");
      setMinutes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={`flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm transition-all w-full
          ${flash
            ? "bg-cyan-500 text-white scale-95"
            : "bg-cyan-800 hover:bg-cyan-700 text-white active:scale-95"
          }
          ${isPending ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className="text-2xl">{flash ? "✅" : "🚴‍♂️"}</span>
        <span>{flash ? "Logged!" : "Log Bike Ride"}</span>
      </button>

      {open && (
        <Modal title="🚴‍♂️ Log Bike Ride" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Distance (km)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="15.5"
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Duration (minutes)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="45"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Log Ride"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Log Walk Button ──────────────────────────────────────────────────────────

export function LogWalkButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [minutes, setMinutes] = useState("");
  const [flash, setFlash] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!minutes) return;
    startTransition(async () => {
      await upsertHealthLog({
        walkingMinutes: Number(minutes),
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      setMinutes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={`flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm transition-all w-full
          ${flash
            ? "bg-teal-500 text-white scale-95"
            : "bg-teal-800 hover:bg-teal-700 text-white active:scale-95"
          }
          ${isPending ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className="text-2xl">{flash ? "✅" : "🚶‍♂️"}</span>
        <span>{flash ? "Logged!" : "Log Walk"}</span>
      </button>

      {open && (
        <Modal title="🚶‍♂️ Log Walk" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Duration (minutes)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="30"
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Log Walk"}
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="safe-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white text-xl leading-none cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
