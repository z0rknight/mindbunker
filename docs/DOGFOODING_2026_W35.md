# Dogfooding Log — 2026 W35 (Aug 23–28)

Real Rosa Media production usage of MindBunker. Brutally simple. One entry per
observation, in the order they happen. Decision is one of OPEN / IGNORE /
INVESTIGATE / FIXED — update it in place as an entry's status changes rather
than duplicating the entry.

---

## Observation

Date/time: 2026-08-22

Context: Testing the Work Session timer before dogfooding week starts.

Device: Mobile (browser/PWA)

Expected: Unclear what should happen when the app/browser is switched away
from and back to while a Work Session is running.

Observed: Started a Work Session on mobile, switched away from the
app/browser, returned later — the elapsed timer appeared to continue running
rather than resetting or pausing.

Friction: Low, but raised a real question about how the timer actually works
under the hood.

Severity: Informational

Possible implication: Needed a full behavioral audit before touching
anything — see `docs/SPRINT_1_2_1_DOGFOODING_READINESS.md`, section 1. Short
answer from that audit: this is the correct, intended behavior. `started_at`
is a server-persisted timestamp; the on-screen clock is always
`now − started_at`, recomputed fresh on every load from that timestamp, on
any device. It doesn't pause because nothing about it was ever
client-side state to begin with.

Decision: FIXED (behavior understood and documented, not a bug — no code
change made to the timer itself)

---

## Observation

Date/time: 2026-08-22

Context: Same timer testing session.

Device: Mobile

Expected: N/A — surfaced while investigating the observation above.

Observed: Unclear where historical (already-closed) timer entries are
managed or viewable. Only an aggregate total per video was visible anywhere
in the app; no way to see individual past sessions.

Friction: Medium — blocks inspecting real dogfooding-week entries.

Severity: Medium

Possible implication: Needed a minimal read-only Session History view before
dogfooding week starts, so real entries created Aug 23–28 can actually be
inspected.

Decision: FIXED — added a read-only Work Session History view at
`/productivity/sessions` (linked from the Productivity page footer). See
`docs/SPRINT_1_2_1_DOGFOODING_READINESS.md`, section 2.

---

## Observation

Date/time: 2026-08-22

Context: Same timer testing session.

Device: Mobile

Expected: N/A — a structural question, not a single reproduction.

Observed: Nothing in the app appears to stop a Work Session automatically.
If Stop is never pressed, it's unclear whether the session can remain open
indefinitely.

Friction: Low today (single-user, low volume), but could silently distort
tracked time if it happens during a busy production day.

Severity: Medium — not a data-corruption risk (only one session can ever be
open at a time, enforced at the database level and already covered by
tests), but an unbounded-duration risk if a session is genuinely forgotten.

Possible implication: A real risk to watch during dogfooding week itself —
this is exactly the kind of thing real usage should surface before deciding
whether it's worth a fix (an idle-time warning, a max-duration cap, etc.).
Deliberately not fixed blind this round per the brief's own instruction not
to redesign the timer without evidence.

Decision: OPEN — watch for real occurrences during Aug 23–28 dogfooding.

---

## Observation

Date/time: 2026-08-22

Context: Same timer testing session, thinking ahead to a future passive
desktop activity sensor.

Device: N/A (architecture question)

Expected: N/A

Observed: There's currently no way to distinguish "I explicitly ran the
MindBunker timer" from a future passive desktop observation (e.g. detecting
time spent in Premiere vs. Chrome vs. Slack) — Work Sessions has no
source/capture-type column at all.

Friction: None yet (no sensor exists), but this needs to be settled
architecturally before one is ever built, so the two don't get conflated.

Severity: Informational

Possible implication: Documented the intended boundary — Work Session
(intentional) vs. Activity Sensor (observed) must stay two separate
concepts, correlated later by timestamp rather than merged into one table.
See `docs/SPRINT_1_2_1_DOGFOODING_READINESS.md`, section 3. No sensor was
built this round, per the brief.

Decision: INVESTIGATE (architecture documented; implementation intentionally
not started)

---

<!--
Add new entries above this line, newest at the bottom of its own block or
newest-first — whichever reads easier to you day to day. Keep the structure:

## Observation

Date/time:
Context:
Device:
Expected:
Observed:
Friction:
Severity:
Possible implication:
Decision: OPEN / IGNORE / INVESTIGATE / FIXED
-->
