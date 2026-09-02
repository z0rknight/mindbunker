// Operator Intelligence Patch Phase 3: DAILY DERIVED OPERATIONAL LEDGER.
//
// One operator-local calendar date (America/Sao_Paulo, see
// utils/date.ts's operatorDateKey) is one row. Computed on read from
// facts already captured elsewhere -- no new table, no new operator
// input. "Missing is NOT zero": a field is null when there is no
// evidence for that day, and a real recorded zero (e.g. Health explicitly
// logs walkingMinutes = 0) stays zero. Currencies are never merged.

export type CurrencyAmount = { currency: string; amount: number };

export type DailyLedgerRow = {
  date: string;
  capacity: {
    sleepHours: number | null;
    caffeineMg: number | null;
    walkingMinutes: number | null;
    cyclingKm: number | null;
  };
  work: {
    trackedSeconds: number;
    sessionCount: number;
    longestSessionSeconds: number | null;
    firstSessionAt: string | null;
    lastSessionAt: string | null;
    videosTouched: number;
  };
  output: {
    videosDelivered: number;
    commitmentsDue: number;
    commitmentsMissed: number;
  };
  quality: {
    detailedRevisions: number;
    ourErrorRevisions: number;
    reworkMinutes: number | null;
    frictionEvents: number;
    frictionMinutes: number | null;
    blockerMinutes: number | null;
  };
  economics: {
    revenueByCurrency: CurrencyAmount[];
    expenseByCurrency: CurrencyAmount[];
  };
};

// ─── raw fact row shapes (already day-keyed by the data layer) ────────────

export type HealthFact = {
  date: string;
  sleepHours: number | null;
  caffeineMg: number | null;
  walkingMinutes: number | null;
  cyclingKm: number | null;
};

export type CaffeineEventFact = { date: string; servings: number };

export type WorkSessionFact = {
  date: string;
  videoId: number;
  startedAt: Date;
  endedAt: Date | null;
  seconds: number;
};

export type DeliveryFact = { date: string };

export type CommitmentFact = {
  dueDate: string;
  status: string;
  completedAt: Date | null;
  dueAt: Date;
};

export type RevisionFact = { date: string; causedBy: string; minutesRework: number | null };

export type FrictionFact = { date: string; minutesLost: number | null };

export type BlockerFact = { date: string; durationMinutes: number | null };

export type TransactionFact = { date: string; type: "income" | "expense" | "owner_pay"; currency: string; amount: number };

function sumCurrency(rows: readonly { currency: string; amount: number }[]): CurrencyAmount[] {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amount);
  }
  return Array.from(byCurrency, ([currency, amount]) => ({ currency, amount })).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

export function buildDailyLedger(
  days: readonly string[],
  facts: {
    health: readonly HealthFact[];
    caffeineEvents: readonly CaffeineEventFact[];
    workSessions: readonly WorkSessionFact[];
    deliveries: readonly DeliveryFact[];
    commitments: readonly CommitmentFact[];
    revisions: readonly RevisionFact[];
    friction: readonly FrictionFact[];
    blockers: readonly BlockerFact[];
    transactions: readonly TransactionFact[];
  },
  reconcileCaffeineMg: (manualMg: number | null, servings: number) => number | null,
): DailyLedgerRow[] {
  return days.map((date) => {
    const health = facts.health.find((row) => row.date === date) ?? null;
    const caffeineServings = facts.caffeineEvents
      .filter((row) => row.date === date)
      .reduce((sum, row) => sum + row.servings, 0);

    const sessionsToday = facts.workSessions.filter((row) => row.date === date);
    const closedSessions = sessionsToday.filter((row) => row.endedAt !== null);
    const trackedSeconds = closedSessions.reduce((sum, row) => sum + row.seconds, 0);
    const longestSessionSeconds = closedSessions.length
      ? Math.max(...closedSessions.map((row) => row.seconds))
      : null;
    const sortedByStart = sessionsToday.slice().sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const videosTouched = new Set(sessionsToday.map((row) => row.videoId)).size;

    const videosDelivered = facts.deliveries.filter((row) => row.date === date).length;

    const commitmentsDueToday = facts.commitments.filter((row) => row.dueDate === date);
    const commitmentsMissed = commitmentsDueToday.filter(
      (row) =>
        row.status === "OPEN" ||
        (row.completedAt !== null && row.completedAt.getTime() > row.dueAt.getTime()),
    ).length;

    const revisionsToday = facts.revisions.filter((row) => row.date === date);
    const reworkRows = revisionsToday.filter((row) => row.minutesRework !== null);
    const reworkMinutes = reworkRows.length
      ? reworkRows.reduce((sum, row) => sum + (row.minutesRework ?? 0), 0)
      : null;

    const frictionToday = facts.friction.filter((row) => row.date === date);
    const frictionMinuteRows = frictionToday.filter((row) => row.minutesLost !== null);
    const frictionMinutes = frictionMinuteRows.length
      ? frictionMinuteRows.reduce((sum, row) => sum + (row.minutesLost ?? 0), 0)
      : null;

    const blockersToday = facts.blockers.filter((row) => row.date === date);
    const blockerDurationRows = blockersToday.filter((row) => row.durationMinutes !== null);
    const blockerMinutes = blockerDurationRows.length
      ? blockerDurationRows.reduce((sum, row) => sum + (row.durationMinutes ?? 0), 0)
      : null;

    const transactionsToday = facts.transactions.filter((row) => row.date === date);

    return {
      date,
      capacity: {
        sleepHours: health?.sleepHours ?? null,
        caffeineMg: reconcileCaffeineMg(health?.caffeineMg ?? null, caffeineServings),
        walkingMinutes: health?.walkingMinutes ?? null,
        cyclingKm: health?.cyclingKm ?? null,
      },
      work: {
        trackedSeconds,
        sessionCount: sessionsToday.length,
        longestSessionSeconds,
        firstSessionAt: sortedByStart[0]?.startedAt.toISOString() ?? null,
        lastSessionAt: sortedByStart.at(-1)?.startedAt.toISOString() ?? null,
        videosTouched,
      },
      output: {
        videosDelivered,
        commitmentsDue: commitmentsDueToday.length,
        commitmentsMissed,
      },
      quality: {
        detailedRevisions: revisionsToday.length,
        ourErrorRevisions: revisionsToday.filter((row) => row.causedBy === "OUR_ERROR").length,
        reworkMinutes,
        frictionEvents: frictionToday.length,
        frictionMinutes,
        blockerMinutes,
      },
      economics: {
        revenueByCurrency: sumCurrency(
          transactionsToday.filter((row) => row.type === "income"),
        ),
        expenseByCurrency: sumCurrency(
          transactionsToday.filter((row) => row.type === "expense"),
        ),
      },
    };
  });
}
