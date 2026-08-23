"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { clientLoginAction, type ClientLoginState } from "./actions";

const initialState: ClientLoginState = {};

export function ClientLoginForm() {
  const [state, action, pending] = useActionState(clientLoginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="mt-7 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="next"
          required
          autoFocus
          placeholder="you@example.com"
          className="h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
          >
            Password
          </label>
          <Link href="/client/reset" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
            required
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "client-login-error" : undefined}
            placeholder="Enter your password"
            className="h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 pr-16 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-1 flex min-h-11 min-w-14 items-center justify-center rounded-lg text-xs font-semibold text-zinc-500 active:bg-zinc-800 active:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          id="client-login-error"
          role="alert"
          className="rounded-xl border border-red-900/70 bg-red-950/40 px-3.5 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
