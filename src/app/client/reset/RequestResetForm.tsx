"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  CLIENT_RESET_GENERIC_MESSAGE as GENERIC_MESSAGE,
  requestClientResetAction,
  type ResetRequestState,
} from "./actions";

const initialState: ResetRequestState = {};

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestClientResetAction, initialState);

  if (state.submitted) {
    return (
      <div className="mt-7 space-y-4">
        <p className="rounded-xl border border-emerald-900/70 bg-emerald-950/30 px-3.5 py-3 text-sm text-emerald-200">
          {GENERIC_MESSAGE}
        </p>
        {state.devToken && (
          <div className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-3.5 py-3 text-xs leading-5 text-amber-200">
            <p className="mb-1 font-black uppercase tracking-widest text-amber-300">
              Development only
            </p>
            <p className="mb-2">
              No email provider is configured in this environment. Use this link directly:
            </p>
            <Link
              href={`/client/reset/${state.devToken}`}
              className="break-all font-bold text-amber-100 underline"
            >
              /client/reset/{state.devToken}
            </Link>
          </div>
        )}
        <Link href="/client/login" className="block text-center text-sm font-bold text-violet-300 hover:text-violet-200">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-7 space-y-4">
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send reset instructions"}
      </button>
      <Link href="/client/login" className="block text-center text-sm font-bold text-zinc-500 hover:text-zinc-300">
        Back to login
      </Link>
    </form>
  );
}
