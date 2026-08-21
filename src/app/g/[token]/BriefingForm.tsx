"use client";

import { useActionState } from "react";
import {
  submitBriefing,
  type BriefingActionState,
} from "@/modules/gateway/actions";
import { SERVICE_INTEREST_OPTIONS } from "@/modules/gateway/config";

const initialState: BriefingActionState = {};

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

export function BriefingForm({
  token,
  defaultServiceInterest,
}: {
  token: string;
  defaultServiceInterest: string | null;
}) {
  const [state, action, pending] = useActionState(
    submitBriefing,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
          ✓
        </div>
        <h2 className="text-xl font-black text-white">Brief received</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Emmanuel will review it and contact you with the clearest next step.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="gatewayToken" value={token} />

      <div>
        <label
          htmlFor="serviceInterest"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          What do you need? *
        </label>
        <select
          id="serviceInterest"
          name="serviceInterest"
          required
          defaultValue={defaultServiceInterest ?? ""}
          aria-invalid={Boolean(state.errors?.serviceInterest)}
          className={inputClassName}
        >
          <option value="" disabled>
            Choose one
          </option>
          {SERVICE_INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.serviceInterest} />
      </div>

      <div>
        <label
          htmlFor="projectSummary"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          What are you creating? *
        </label>
        <textarea
          id="projectSummary"
          name="projectSummary"
          required
          rows={3}
          maxLength={800}
          enterKeyHint="next"
          placeholder="A series of short videos, a launch film…"
          aria-invalid={Boolean(state.errors?.projectSummary)}
          className={`${inputClassName} min-h-28 resize-y`}
        />
        <FieldError message={state.errors?.projectSummary} />
      </div>

      <div>
        <label
          htmlFor="objective"
          className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
        >
          Main objective *
        </label>
        <textarea
          id="objective"
          name="objective"
          required
          rows={3}
          maxLength={800}
          enterKeyHint="next"
          placeholder="Grow reach, explain the product, build trust…"
          aria-invalid={Boolean(state.errors?.objective)}
          className={`${inputClassName} min-h-28 resize-y`}
        />
        <FieldError message={state.errors?.objective} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contentVolume"
            className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
          >
            Amount / frequency
          </label>
          <input
            id="contentVolume"
            name="contentVolume"
            type="text"
            maxLength={300}
            placeholder="e.g. 8 videos / month"
            className={inputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="timeline"
            className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"
          >
            Ideal timeline
          </label>
          <input
            id="timeline"
            name="timeline"
            type="text"
            maxLength={300}
            placeholder="e.g. Starting next month"
            className={inputClassName}
          />
        </div>
      </div>

      <details className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-zinc-300">
          Add references or context (optional)
        </summary>
        <div className="space-y-5 pb-2 pt-3">
          <div>
            <label htmlFor="references" className="mb-2 block text-xs text-zinc-500">
              Links or references
            </label>
            <textarea
              id="references"
              name="references"
              rows={3}
              maxLength={1200}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Paste links or describe examples you like"
              className={`${inputClassName} resize-y`}
            />
          </div>
          <div>
            <label htmlFor="existingAssets" className="mb-2 block text-xs text-zinc-500">
              Material already available
            </label>
            <textarea
              id="existingAssets"
              name="existingAssets"
              rows={2}
              maxLength={800}
              placeholder="Footage, recordings, brand assets…"
              className={`${inputClassName} resize-y`}
            />
          </div>
          <div>
            <label htmlFor="notes" className="mb-2 block text-xs text-zinc-500">
              Anything else
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1200}
              placeholder="Useful context for the first conversation"
              className={`${inputClassName} resize-y`}
            />
          </div>
        </div>
      </details>

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
        {pending ? "Sending…" : "Send briefing"}
      </button>
      <p className="text-center text-xs leading-5 text-zinc-600">
        Your answers are private and linked only to this invitation.
      </p>
    </form>
  );
}

