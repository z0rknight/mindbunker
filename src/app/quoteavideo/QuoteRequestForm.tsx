"use client";

import { useActionState, useState } from "react";
import {
  submitQuoteRequest,
  type QuoteRequestActionState,
} from "@/modules/quote-intake/actions";
import { SERVICE_INTEREST_OPTIONS } from "@/modules/gateway/config";
import { BookingRequestForm } from "../book/BookingRequestForm";

const initialState: QuoteRequestActionState = {};

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

export function QuoteRequestForm() {
  const [state, action, pending] = useActionState(submitQuoteRequest, initialState);
  // Minted once per page load, not per render/retry, so a double-submit of
  // the same visit is recognized server-side as the same request -- see
  // submitQuoteRequest's idempotency-key pre-check.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
          ✓
        </div>
        <h2 className="text-xl font-black text-white">Request received</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          {state.message ?? "Emmanuel will review it and follow up with a quote."}
        </p>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div>
        <label htmlFor="name" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
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
        <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
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
        <label htmlFor="company" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Company (optional)
        </label>
        <input
          id="company"
          name="company"
          type="text"
          maxLength={160}
          autoComplete="organization"
          placeholder="Acme Inc."
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="contentType" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Content type *
        </label>
        <select
          id="contentType"
          name="contentType"
          required
          defaultValue=""
          aria-invalid={Boolean(state.errors?.contentType)}
          className={inputClassName}
        >
          <option value="" disabled>
            Choose the closest fit
          </option>
          {SERVICE_INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.contentType} />
      </div>

      <div>
        <label htmlFor="whatAreYouCreating" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          What are you creating? *
        </label>
        <textarea
          id="whatAreYouCreating"
          name="whatAreYouCreating"
          rows={3}
          required
          maxLength={800}
          placeholder="A 60-second product launch video for our landing page"
          aria-invalid={Boolean(state.errors?.whatAreYouCreating)}
          className={`${inputClassName} min-h-24 resize-y`}
        />
        <FieldError message={state.errors?.whatAreYouCreating} />
      </div>

      <div>
        <label htmlFor="mainObjective" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Main objective *
        </label>
        <textarea
          id="mainObjective"
          name="mainObjective"
          rows={2}
          required
          maxLength={800}
          placeholder="Get more signups from the landing page"
          aria-invalid={Boolean(state.errors?.mainObjective)}
          className={`${inputClassName} min-h-20 resize-y`}
        />
        <FieldError message={state.errors?.mainObjective} />
      </div>

      <div>
        <label htmlFor="quantityFrequency" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Quantity / frequency (optional)
        </label>
        <input
          id="quantityFrequency"
          name="quantityFrequency"
          type="text"
          maxLength={300}
          placeholder="One video, or 4 per month"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="idealTimeline" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Ideal timeline (optional)
        </label>
        <input
          id="idealTimeline"
          name="idealTimeline"
          type="text"
          maxLength={300}
          placeholder="This week, end of month..."
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="referencesContext" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          References / context (optional)
        </label>
        <textarea
          id="referencesContext"
          name="referencesContext"
          rows={3}
          maxLength={1_200}
          placeholder="Links to examples you like, brand guidelines, etc."
          className={`${inputClassName} min-h-24 resize-y`}
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          Anything else? (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1_200}
          placeholder="Notes, constraints, budget range..."
          className={`${inputClassName} min-h-24 resize-y`}
        />
      </div>

      {state.message && !state.success && (
        <p role="alert" className="rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {state.message}
        </p>
      )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Sending…" : "Request a video"}
        </button>
      </form>

      {/* Call request stays available but demoted -- collapsed, visually
          secondary, and reusing the exact same BookingRequestForm/
          submitPublicBookingRequest call infrastructure /book already
          used. Nothing about that path was removed, only de-emphasized
          (brief section 1). Embedding it here (rather than linking out to
          a separate /book page) is also what lets /book safely redirect
          to /quoteavideo without creating a loop -- see section 2. */}
      <details className="mt-5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-zinc-500">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Need to talk first?
        </summary>
        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <p className="mb-4 text-sm leading-6 text-zinc-400">
            Prefer a quick call before sending details? Request contact instead.
          </p>
          <BookingRequestForm />
        </div>
      </details>
    </>
  );
}
