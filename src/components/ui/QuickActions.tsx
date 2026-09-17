"use client";

import { useState, useTransition } from "react";
import { addTransaction, recordQuickUpworkTime } from "@/modules/finance/actions";
import { upsertHealthLog } from "@/modules/health/actions";
import { todayISO } from "@/utils/date";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  resolveExpenseCategory,
} from "@/modules/finance/categories";

export {
  FinishedVideoButton,
  PlanVideoButton,
} from "./ProductivityQuickActions";

// ─── Add Income Button ────────────────────────────────────────────────────────

// Monday Real-Operation Pre-Freeze §6: a Freelance income row must name a
// client (transactions_freelance_requires_client_check at the DB level,
// validateFreelanceIncomeInput at the app level -- see modules/finance/core.ts
// and actions.ts). This is the ONE form that has ever defaulted its
// category to "Freelance", so it is the one that needs the client picker.
export function AddIncomeButton({
  clients = [],
  contracts = [],
}: {
  clients?: Array<{ id: number; name: string }>;
  contracts?: Array<{
    id: number;
    clientId: number;
    label: string;
    currency: string;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Freelance");
  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [date, setDate] = useState(() => todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isFreelance = category.trim().toLowerCase() === "freelance";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || isNaN(Number(amount))) return;
    if (isFreelance && !clientId) {
      setError("Freelance income must be associated with a client.");
      return;
    }
    startTransition(async () => {
      const result = await addTransaction({
        type: "income",
        amount: Number(amount),
        category,
        currency,
        date,
        notes,
        clientId: clientId ? Number(clientId) : null,
        contractId: contractId ? Number(contractId) : null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAmount("");
      setNotes("");
      setClientId("");
      setContractId("");
      setDate(todayISO());
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setDate(todayISO());
          setError(null);
          setOpen(true);
        }}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-600 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">💰</span>
        <span>Add Income</span>
      </button>

      {open && (
        <Modal title="Add Income" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "USD" | "BRL")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ({currency})</label>
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
            {isFreelance && (
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">
                  Client (required for Freelance income)
                </label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setContractId("");
                  }}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {clientId && contracts.some((contract) => contract.clientId === Number(clientId)) && (
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">
                  Contract (optional)
                </label>
                <select
                  value={contractId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setContractId(nextId);
                    const contract = contracts.find((candidate) => candidate.id === Number(nextId));
                    if (contract?.currency === "USD" || contract?.currency === "BRL") {
                      setCurrency(contract.currency);
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">No contract link</option>
                  {contracts
                    .filter((contract) => contract.clientId === Number(clientId))
                    .map((contract) => (
                      <option key={contract.id} value={contract.id}>{contract.label}</option>
                    ))}
                </select>
              </div>
            )}
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
            {error && <p className="text-red-400 text-xs">{error}</p>}
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
  const [date, setDate] = useState(() => todayISO());
  const [category, setCategory] = useState("Software");
  const [otherCategory, setOtherCategory] = useState("");
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    const resolvedCategory = resolveExpenseCategory(
      category,
      otherCategory,
      BUSINESS_EXPENSE_CATEGORIES,
    );
    if (!resolvedCategory) {
      setError(category === "Other" ? "Describe the Other category briefly." : "Select a category.");
      return;
    }
    startTransition(async () => {
      const result = await addTransaction({
        type: "expense",
        amount: Number(amount),
        category: resolvedCategory,
        currency,
        date,
        notes,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAmount("");
      setDate(todayISO());
      setOtherCategory("");
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setDate(todayISO());
          setError(null);
          setOpen(true);
        }}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-red-800 hover:bg-red-700 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">💸</span>
        <span>Add Expense</span>
      </button>

      {open && (
        <Modal title="Add Expense" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Amount ({currency})</label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "USD" | "BRL")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
              <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {BUSINESS_EXPENSE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              </div>
            </div>
            {category === "Other" && (
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Other detail</label>
                <input
                  type="text"
                  maxLength={80}
                  value={otherCategory}
                  onChange={(e) => setOtherCategory(e.target.value)}
                  placeholder="Short description"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}
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
            {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
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

// ─── Register Upwork Time Button (Sep 16 Operational Reality Patch) ───────
//
// Operator-reported, verbatim: "[REGISTRADO NA UPWORK] pra que eu coloque
// todo o final do dia quanto eu registrei na Upwork... Sensor vira minha
// verdade operacional, o registro na Upwork vira log." Deliberately the
// same shape as Add Income/Add Expense above -- a client/contract picker
// and a duration, nothing else. The rate, currency, and "this is billing
// evidence, source=MANUAL" plumbing are the server action's job
// (recordQuickUpworkTime in modules/finance/actions.ts), never typed here.
export function RegisterUpworkTimeButton({
  contracts = [],
}: {
  contracts?: Array<{ id: number; clientId: number; clientName: string; platform: string; currency: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [contractId, setContractId] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const selectedContract = contracts.find((c) => c.id === Number(contractId));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmation(null);
    if (!contractId) {
      setError("Choose which client this time was for.");
      return;
    }
    const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      setError("Enter a duration greater than zero.");
      return;
    }
    startTransition(async () => {
      const result = await recordQuickUpworkTime({
        contractId: Number(contractId),
        minutes: totalMinutes,
        date,
        note: note.trim() || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.alreadyRegisteredToday) {
        setConfirmation(
          "Already registered for this client on this date -- this entry was not duplicated. Edit it in Finance → Contracts if the number needs to change.",
        );
        return;
      }
      setHours("");
      setMinutes("");
      setNote("");
      setDate(todayISO());
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setDate(todayISO());
          setError(null);
          setConfirmation(null);
          setOpen(true);
        }}
        disabled={contracts.length === 0}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-teal-800 hover:bg-teal-700 text-white active:scale-95 transition-all w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        title={contracts.length === 0 ? "No active hourly contract recorded yet" : undefined}
      >
        <span className="text-2xl">🕒</span>
        <span>Upwork Time</span>
      </button>

      {open && (
        <Modal title="Register Upwork time" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-[11px] leading-4 text-zinc-500">
              Your intentional work already came from Sensor. This is a separate log of what Upwork itself shows as
              registered -- the two are compared, never merged.
            </p>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Client</label>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="">Select a client…</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName} · {c.platform}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Hours</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Minutes</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            {selectedContract && (
              <p className="text-[11px] text-zinc-600">
                Recorded as billing evidence at this contract&apos;s existing rate, in {selectedContract.currency}.
              </p>
            )}
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Week 3 screenshots, etc."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {confirmation && <p className="text-amber-300 text-xs">{confirmation}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-teal-700 hover:bg-teal-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Register Upwork time"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ─── Log Today (Health) Button ────────────────────────────────────────────────

export function LogTodayButton({ todayISODate }: { todayISODate?: string } = {}) {
  const defaultDate = todayISODate ?? todayISO();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [sleep, setSleep] = useState("");
  const [caffeine, setCaffeine] = useState("");
  const [screenTime, setScreenTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertHealthLog({
        date,
        sleepHours: sleep ? Number(sleep) : undefined,
        caffeineMg: caffeine ? Number(caffeine) : undefined,
        screenTimeHours: screenTime ? Number(screenTime) : undefined,
        substancesNotes: notes || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDate(defaultDate);
          setError(null);
          setOpen(true);
        }}
        className="flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-xl font-bold text-sm bg-blue-800 hover:bg-blue-700 text-white active:scale-95 transition-all w-full cursor-pointer"
      >
        <span className="text-2xl">🫀</span>
        <span>Log Today</span>
      </button>

      {open && (
        <Modal title="Log Today's Health" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <HistoricalDateField value={date} max={defaultDate} onChange={setDate} />
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
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
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

export function LogBikeRideButton({ todayISODate }: { todayISODate?: string } = {}) {
  const defaultDate = todayISODate ?? todayISO();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [km, setKm] = useState("");
  const [minutes, setMinutes] = useState("");
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertHealthLog({
        date,
        cyclingKm: km ? Number(km) : undefined,
        cyclingMinutes: minutes ? Number(minutes) : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
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
        type="button"
        onClick={() => {
          setDate(defaultDate);
          setError(null);
          setOpen(true);
        }}
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
            <HistoricalDateField value={date} max={defaultDate} onChange={setDate} />
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
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
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

export function LogWalkButton({ todayISODate }: { todayISODate?: string } = {}) {
  const defaultDate = todayISODate ?? todayISO();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [minutes, setMinutes] = useState("");
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!minutes) return;
    setError(null);
    startTransition(async () => {
      const result = await upsertHealthLog({
        date,
        walkingMinutes: Number(minutes),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      setMinutes("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDate(defaultDate);
          setError(null);
          setOpen(true);
        }}
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
            <HistoricalDateField value={date} max={defaultDate} onChange={setDate} />
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
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
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

function HistoricalDateField({
  value,
  max,
  onChange,
}: {
  value: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
        Happened on
      </label>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange(event.currentTarget.value)}
        required
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-zinc-600">
        When it happened, even if you are logging it later.
      </p>
    </div>
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
