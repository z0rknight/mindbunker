"use server";

import { getAuthenticatedDb } from "@/db";
import { fxConversions, fxManualRates } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/utils/date";
import {
  validateFxConversionInput,
  validateFxManualRateInput,
  resolveFxRateForMonth,
  monthOf,
  type FxRateResolution,
  type FxScope,
  type FxCurrency,
  type FxPurpose,
} from "./core";

export type FxActionResult = { success: true } | { success: false; error: string };

// A real BRL<->USD conversion Emmanuel actually performed. Append-only
// source fact -- never mutates any other ledger (a BUSINESS-scope row IS
// read into Business Cash by finance/actions.ts's getRmediaCashSummary/
// getFinanceSummary, but that is a read-time fold, not a mutation here).
// See fx_conversions in src/db/schema.ts.
export async function recordFxConversion(data: {
  date?: string;
  brlAmount: number;
  usdAmount: number;
  scope: Exclude<FxScope, "UNCLASSIFIED">;
  fromCurrency?: FxCurrency | null;
  purpose?: FxPurpose | null;
  notes?: string;
}): Promise<FxActionResult> {
  const date = data.date ?? todayISO();
  const error = validateFxConversionInput({
    date,
    brlAmount: data.brlAmount,
    usdAmount: data.usdAmount,
    scope: data.scope,
    fromCurrency: data.fromCurrency,
    purpose: data.purpose,
  });
  if (error) return { success: false, error };

  const db = await getAuthenticatedDb();
  await db.insert(fxConversions).values({
    date,
    brlAmount: data.brlAmount,
    usdAmount: data.usdAmount,
    scope: data.scope,
    fromCurrency: data.fromCurrency ?? null,
    // Purpose only ever means something for a BUSINESS conversion --
    // silently dropped for PERSONAL rather than trusting the caller not to
    // send one (see FX_conversions_purpose_check, which would also reject
    // a mismatched combination if this weren't already normalized here).
    purpose: data.scope === "BUSINESS" ? (data.purpose ?? null) : null,
    notes: data.notes ?? null,
  });
  revalidatePath("/finance/fx");
  revalidatePath("/finance");
  return { success: true };
}

export async function getFxConversions() {
  const db = await getAuthenticatedDb();
  return db.select().from(fxConversions).orderBy(asc(fxConversions.date));
}

// ─── Client Portal Reality round §H: FX conversion correction ─────────────
// Sprint C1 intentionally deferred this. The monthly weighted rate
// (resolveFxRateForMonth/computeVolumeWeightedRate in core.ts) is a live
// derivation over every fxConversions row in that month, recomputed fresh
// on every read -- never cached/stored -- so editing or deleting one row
// needs no separate recompute step; the next read is already correct.
// No FK references fxConversions from anywhere else in the schema, so
// neither action touches any financial transaction.

export async function updateFxConversion(
  id: number,
  data: {
    date?: string;
    brlAmount: number;
    usdAmount: number;
    scope: FxScope;
    fromCurrency?: FxCurrency | null;
    purpose?: FxPurpose | null;
    notes?: string;
  },
): Promise<FxActionResult> {
  const date = data.date ?? todayISO();
  const error = validateFxConversionInput({
    date,
    brlAmount: data.brlAmount,
    usdAmount: data.usdAmount,
    scope: data.scope,
    fromCurrency: data.fromCurrency,
    purpose: data.purpose,
  }, { allowUnclassified: true });
  if (error) return { success: false, error };

  const db = await getAuthenticatedDb();
  const updated = await db
    .update(fxConversions)
    .set({
      date,
      brlAmount: data.brlAmount,
      usdAmount: data.usdAmount,
      scope: data.scope,
      fromCurrency: data.fromCurrency ?? null,
      purpose: data.scope === "BUSINESS" ? (data.purpose ?? null) : null,
      notes: data.notes ?? null,
    })
    .where(eq(fxConversions.id, id))
    .returning({ id: fxConversions.id });
  if (updated.length === 0) {
    return { success: false, error: "FX conversion not found." };
  }
  revalidatePath("/finance/fx");
  revalidatePath("/finance");
  return { success: true };
}

export async function deleteFxConversion(id: number): Promise<FxActionResult> {
  const db = await getAuthenticatedDb();
  const deleted = await db
    .delete(fxConversions)
    .where(eq(fxConversions.id, id))
    .returning({ id: fxConversions.id });
  if (deleted.length === 0) {
    return { success: false, error: "FX conversion not found." };
  }
  revalidatePath("/finance/fx");
  revalidatePath("/finance");
  return { success: true };
}

// Second tier of the provenance hierarchy -- a rate Emmanuel explicitly
// declares for a month that has no observed conversions. Upsert by month:
// re-declaring the same month updates it rather than creating a duplicate.
export async function setFxManualRateForMonth(data: {
  month: string;
  rate: number;
  notes?: string;
}): Promise<FxActionResult> {
  const error = validateFxManualRateInput({ month: data.month, rate: data.rate });
  if (error) return { success: false, error };

  const db = await getAuthenticatedDb();
  await db
    .insert(fxManualRates)
    .values({ month: data.month, rate: data.rate, notes: data.notes ?? null })
    .onConflictDoUpdate({
      target: fxManualRates.month,
      set: { rate: data.rate, notes: data.notes ?? null },
    });
  revalidatePath("/finance/fx");
  return { success: true };
}

export async function getFxManualRates() {
  const db = await getAuthenticatedDb();
  return db.select().from(fxManualRates).orderBy(asc(fxManualRates.month));
}

// FX + Business Operating Cash Patch §4/§18: scope is optional so this
// stays backward-compatible everywhere it was already called with no
// scope (== "ALL OBSERVED", the old behavior) -- pass "BUSINESS" for the
// Finance page's primary rate card, which must never be silently driven
// by PERSONAL or UNCLASSIFIED conversions.
export async function getFxRateForMonth(
  month: string,
  scope?: FxScope,
): Promise<FxRateResolution> {
  const db = await getAuthenticatedDb();
  const [allConversions, manualRows] = await Promise.all([
    db.select().from(fxConversions),
    db.select().from(fxManualRates).where(eq(fxManualRates.month, month)),
  ]);
  const monthConversions = allConversions
    .filter((c) => monthOf(c.date) === month)
    .filter((c) => !scope || c.scope === scope);
  const manualRate = manualRows.length > 0 ? manualRows[0].rate : null;
  return resolveFxRateForMonth({ monthConversions, manualRate });
}

export type FxRateResolutionByScope = {
  business: FxRateResolution;
  personal: FxRateResolution;
  all: FxRateResolution;
};

// One round trip for all three views of the same month (used by
// FxMonthRatePanel's month-navigator) -- BUSINESS and PERSONAL are
// disjoint scope-filtered subsets, "all" is every observed conversion that
// month regardless of scope (including UNCLASSIFIED, which never counts
// toward business or personal individually, but did genuinely happen).
export async function getFxRateForMonthByScope(month: string): Promise<FxRateResolutionByScope> {
  const db = await getAuthenticatedDb();
  const [allConversions, manualRows] = await Promise.all([
    db.select().from(fxConversions),
    db.select().from(fxManualRates).where(eq(fxManualRates.month, month)),
  ]);
  const monthConversions = allConversions.filter((c) => monthOf(c.date) === month);
  const manualRate = manualRows.length > 0 ? manualRows[0].rate : null;
  return {
    business: resolveFxRateForMonth({
      monthConversions: monthConversions.filter((c) => c.scope === "BUSINESS"),
      manualRate,
    }),
    personal: resolveFxRateForMonth({
      monthConversions: monthConversions.filter((c) => c.scope === "PERSONAL"),
      manualRate,
    }),
    all: resolveFxRateForMonth({ monthConversions, manualRate }),
  };
}

// Every month that has at least one observed conversion or a manual rate,
// newest first -- lets the FX ledger page render its month list without
// the caller needing to already know which months exist. Each month now
// carries all three scoped views (§4) instead of one combined figure.
export async function getFxMonthSummaries(): Promise<
  Array<{ month: string } & FxRateResolutionByScope & { observedConversionCount: number }>
> {
  const db = await getAuthenticatedDb();
  const [allConversions, manualRows] = await Promise.all([
    db.select().from(fxConversions),
    db.select().from(fxManualRates),
  ]);
  const months = new Set<string>();
  for (const c of allConversions) months.add(monthOf(c.date));
  for (const m of manualRows) months.add(m.month);

  return Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const monthConversions = allConversions.filter((c) => monthOf(c.date) === month);
      const manualRate = manualRows.find((m) => m.month === month)?.rate ?? null;
      return {
        month,
        observedConversionCount: monthConversions.length,
        business: resolveFxRateForMonth({
          monthConversions: monthConversions.filter((c) => c.scope === "BUSINESS"),
          manualRate,
        }),
        personal: resolveFxRateForMonth({
          monthConversions: monthConversions.filter((c) => c.scope === "PERSONAL"),
          manualRate,
        }),
        all: resolveFxRateForMonth({ monthConversions, manualRate }),
      };
    });
}
