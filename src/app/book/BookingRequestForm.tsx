"use client";

import { useActionState, useState } from "react";
import {
  submitPublicBookingRequest,
  type PublicBookingRequestActionState,
} from "@/modules/booking/actions";
import { SERVICE_INTEREST_OPTIONS } from "@/modules/gateway/config";

const initialState: PublicBookingRequestActionState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-300">
      {message}
    </p>
  );
}

const inputClassName =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10";

export function BookingRequestForm({ referralKey }: { referralKey?: string }) {
  const [state, action, pending] = useActionState(
    submitPublicBookingRequest,
    initialState,
  );
  // Minted once per page load (not per render/retry) so a double-submit
  // of the same visit is recognized server-side as the same request --
  // see submitPublicBookingRequest's idempotency-key pre-check.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
          ✓
        </div>
        <h2 className="text-xl font-black text-white">Request received</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Emmanuel will review it and reach out with the clearest next step.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {referralKey && <input type="hidden" name="ref" value={referralKey} />}
      {/* Honeypot: real visitors never see or fill this; a non-empty
          submission is silently dropped in submitPublicBookingRequest. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="company_website">Leave this field blank</label>
        <input type="text" id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          Your name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={160}
          autoComplete="name"
          placeholder="Jane Doe"
          aria-invalid={Boolean(state.errors?.name)}
          className={inputClassName}
        />
        <FieldError message={state.errors?.name} />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          placeholder="jane@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          className={inputClassName}
        />
        <FieldError message={state.errors?.email} />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          Phone (optional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={80}
          autoComplete="tel"
          placeholder="+1 555 000 0000"
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="serviceInterest"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          What do you need? (optional)
        </label>
        <select
          id="serviceInterest"
          name="serviceInterest"
          defaultValue=""
          className={inputClassName}
        >
          <option value="">Not sure yet</option>
          {SERVICE_INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          Tell us about your project (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={2_000}
          placeholder="What are you looking to create?"
          className={`${inputClassName} min-h-28 resize-y`}
        />
      </div>

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Sending…" : "Request contact"}
      </button>
      <p className="text-center text-xs leading-5 text-zinc-600">
        This sends a private request to Emmanuel. It does not book a meeting time.
      </p>
    </form>
  );
}
