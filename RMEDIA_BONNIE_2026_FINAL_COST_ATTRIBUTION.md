# RMEDIA OS — Bonnie 2026 Final Cost Attribution
**Date:** 2026-09-14 · **Status: Analysis complete. No deploy this wave.**

Source note: the Notion/Upwork evidence blocks used below were handed to
this session directly (already extracted by Emmanuel from Notion and
Upwork — this agent has no Notion or Upwork connector/credentials and
did not browse either system). MindBunker D1 was queried directly,
read-only, to cross-reference and avoid double-counting.

---

## 1. Executive Answer

The prior MindBunker-only pass (14 records, "13 minutes tracked,
NOT SAFELY DERIVABLE") was **materially incomplete** — it only saw the
most recent slice of Bonnie's work. The fuller picture, reconstructed
from Notion + Upwork + MindBunker together:

- **21 core Bonnie deliverables in 2026** (not 14), spanning January
  through September.
- **Confirmed attributable cost: $75.00** (January, exact hour
  breakdown exists).
- **Additional strongly-attributable cost: $37.50** (an August 2
  finalization session with both a Notion retrospective note and a
  matching Upwork Work Diary entry).
- **Best-supported floor: $112.50.**
- **This is a floor, not the true total.** Real, confirmed-completed
  work (June's 6-video library, most of the July/August production
  hours, all of September) has **no time record precise enough to cost**
  — not zero cost, just unmeasured. Explained in full below.

---

## 2. Deduplicated Production History (Canonical Scope Table)

| Work Family | Date Range | Deliverables | Source | Time Evidence | Commercial Evidence | Confidence |
|---|---|---|---|---|---|---|
| **Bonnie Ads** | ~Jan 19–22 | 1 core video (+ 5 hook variations, see §4) | Notion | 1.5h cut + 0.7h captions + 0.8h polish = **3.0h** | None in MindBunker (predates earliest billing_evidence, 2026-07-27) | **HIGH** (work), N/A (billing corroboration) |
| **Short Video Library** | Jun 23 – Jul 30 | 6 videos (Bon-Unplugged ×2, +4 others, all marked completed) | Notion | None documented | None | MEDIUM (deliverables confirmed complete), **LOW** (no cost derivable) |
| **Content Waterfall Batch 1** | Late July | 4 vertical clips | Notion | None documented (rough-cut phase) | None separate from Batch 2/finalization below | MEDIUM (deliverables), LOW (cost) |
| **Content Waterfall Batch 2** | Jul 31 – Aug 2 | 5 vertical clips | Notion | Production phase (transfer/edit/audio/transcription/caption) — no separate duration | Same week as the Aug 2 session below | MEDIUM (deliverables), LOW (cost) |
| **Aug 2 finalization (Batches 1+2, all 9 clips)** | Aug 2 (Sunday) | Finalizes all 9 clips from the two batches above — same clips, not new ones | Notion (1h20 retrospective) + Upwork Work Diary (1h30, same Sunday) | **1.5h** (Upwork Work Diary, the actual billing-basis record) | Falls inside MindBunker `billing_evidence.id=2` (period 2026-07-27–08-02, 320 min / $133.33 total that week) — cross-validated as a real subset | **MEDIUM-HIGH** |
| **September Content Waterfall** | Sep 11–13 | 5 videos (MindBunker project 16, ids 63–67) | MindBunker | 1 work session, 13 min, video 63 only | Falls inside `billing_evidence.id=8` (2026-09-07–09-13, 400 min / $166.67, mixed with non-Bonnie work) | Deliverables HIGH, cost LOW |

**MindBunker's "project 5" (9 videos, "Bonnie - Content Waterfall,"
created 2026-08-24, all still PLANNED)** is the same 9 clips as **Batch
1 + Batch 2 above** — the video_logs rows were created Aug 24 as a
cataloging pass, three weeks *after* the actual editing (per Notion,
finished Aug 2). That's why MindBunker shows zero work-session time on
them: the real editing happened before those MindBunker rows existed,
tracked in Notion/Upwork instead. **This is the same work, counted
once** — not two batches of 9.

---

## 3. Notion Evidence (as given)

Reproduced faithfully from the source handoff, organized by family — see
§2's table for the deduplicated version. No Notion dashboard/page was
counted twice; the January "1 main + 5 hooks" split and the "Aug 2
finalization of all 9" description (which explicitly re-mentions
reopening the earlier 4 clips) were both treated as *the same*
underlying work restated, not additional work, per §2's classification.

## 4. Upwork Evidence

Two direct Upwork data points were given:
- A **Work Diary entry of 1h30 on a Sunday** (the Aug 2 finalization
  session) — used as the gross-billing-basis figure since Upwork's
  Work Diary is what Taryn's invoice is actually built from.
- No other period-specific Upwork entries were provided for January,
  June, or the Batch 1/2 production phases.

Cross-referenced against MindBunker's own `billing_evidence` (imported
from Upwork reports in Wave 3): the Aug 2 Sunday falls inside period
`2026-07-27–2026-08-02` (320 min / $133.33 billed that week). The 90
Bonnie-specific minutes are a real, plausible subset of that week's 320
— not the whole week, and not double-billed.

## 5. MindBunker Evidence

- `work_sessions`: 1 row across all 14 MindBunker Bonnie video ids (13
  min, video 63, part of the September batch). Everything else: zero.
- `billing_evidence`: 7 weekly rows, 2026-07-27 through 2026-09-13, all
  contract-level aggregates mixing Bonnie + non-Bonnie work. Nothing
  before 2026-07-27 exists in MindBunker at all — January and June
  predate MindBunker's own billing history entirely.
- `billing_allocations`: **zero rows**, confirmed again this wave
  (read-only check). No prior allocation of any week to Bonnie
  specifically has ever been recorded.

## 6. Hours Attribution

| Class | Work | Hours | Why |
|---|---|---|---|
| **A — Exactly attributable** | January Bonnie Ads | 3.0h | Direct, itemized breakdown (cut/captions/polish), belongs only to Bonnie |
| **B — Strongly attributable** | Aug 2 finalization (all 9 clips) | 1.5h | Real Upwork Work Diary entry, cross-validated against that week's real billing_evidence total; minor ambiguity is only the 1h20-vs-1h30 discrepancy between the retrospective note and the Work Diary itself |
| **C — Shared week / not allocatable** | September batch | unknown (13 min tracked, known-incomplete) | Falls inside a weekly Upwork total shared with non-Bonnie work; no allocation ever recorded |
| **D — Unknown, no time evidence** | June library (6 videos), Batch 1 rough cut (4 clips), Batch 2 initial production (5 clips) | not derivable | Deliverables confirmed complete; no duration was ever logged anywhere this agent can see |

**Confirmed attributable hours: 3.0h. Additional strongly-attributable
hours: 1.5h. Total documented: 4.5h** — against a body of work that
plainly took much longer (21 deliverables cannot really be 4.5 hours of
work; this is the gap between "was done" and "was time-logged").

## 7. Gross Billed Attribution

- January: **$75.00** (3.0h × $25/hr). Rate assumption: no evidence of
  a different historical rate was available, and the source material's
  own $75 figure already assumes $25/hr — used as-is, flagged rather
  than silently applied.
- Aug 2: **$37.50** (1.5h × $25/hr, using the Upwork Work Diary figure
  per the "prefer gross client billing" instruction).
- **Confirmed + strongly-attributable total: $112.50.**

This is **gross** — what Taryn was billed, not Emmanuel's net after
Upwork's fee — per the explicit instruction not to subtract platform
fees from her cost.

## 8. Unbilled Attribution

**Not meaningfully separable from "billed."** Taryn's entire Upwork
relationship bills weekly for all hours Emmanuel logs — there is no
category of Emmanuel's *logged* time that goes unpaid; it's just not
itemized by client. So the real gap isn't "billed vs. unbilled," it's
**"time-logged vs. never-logged."** Work that was never logged
(June's library, most of the July/August production hours) was either
absorbed into some other week's total without a distinguishable record,
or genuinely never captured as billable time at all — either way, it
cannot be turned into a dollar figure without guessing.

## 9. Unknown / Unallocated Work

Real, completed, confirmed-deliverable work with **no safe cost
figure**:
- June short-video library — 6 videos, "completed" per Notion, zero
  time evidence.
- Content Waterfall Batches 1 & 2 — the actual production/editing
  hours (not the Aug 2 finalization pass) — MXF transfer, initial
  edit, audio cleanup, transcription, caption correction, reframing —
  none of this has a separately logged duration.
- September batch — 5 delivered videos, only 13 minutes logged
  (already flagged in the prior report as a known tracking gap, not a
  true reflection of effort).
- The Bonnie-specific color preset/LUT development mentioned for Aug 2
  — real, distinct creative work (a separate visual language from
  Taryn's own), but not separately timed from the finalization pass it's
  bundled into.

## 10. Confidence

**Deliverable scope: HIGH.** **Confirmed-dollar floor ($112.50):
MEDIUM-HIGH.** **True total cost: LOW** (genuinely not derivable — most
of the real hours were never logged anywhere retrievable).

## 11. Dashboard Recommendation

**DEFER.** $112.50 is a real floor, not a complete number — surfacing it
on `/client` (or even the CRM) as "Bonnie's 2026 cost" would imply a
completeness the evidence doesn't support, which is exactly what §13's
gate exists to prevent. No dashboard surface was built this wave.

If useful later: a small, **operator-only** CRM note ("Bonnie
attribution: $112.50 confirmed floor, additional work not yet
allocated — see report") would be safe and wouldn't need new schema.
Actually *persisting* real `billing_allocations` rows for the January
and Aug-2 amounts would also be safe (the evidence is strong enough,
and the mechanism already exists, unused) — but that's a real
production-data write, explicitly out of scope for this read-only
wave, and not done here.

## 12. Code Changes

**None.** This wave is analysis-only.

## 13. Tests / Deploy

**Not applicable.** No code changed, no build run, no deploy.

## 14. Final Client Message

See below.

---

## Final Structured Output

```
BONNIE 2026 SCOPE:        GREEN
CORE DELIVERABLES:        21  (16 Jan–Aug, Notion-evidenced + 5 Sep, MindBunker-evidenced)
ATTRIBUTABLE HOURS:       3.0h confirmed + 1.5h strongly-attributable = 4.5h documented
CONFIRMED BILLED:         $75.00
BEST-SUPPORTED TOTAL:     $112.50 (floor, not complete)
UNBILLED:                 NOT SAFELY DERIVABLE (see §8 — "unlogged" is the real gap, not "unbilled")
CONFIDENCE:                MEDIUM-HIGH (floor) / LOW (true total)
DASHBOARD:                 DEFER
PRODUCTION MUTATION:      NONE
DEPLOY:                    NONE
```

---

## SEND THIS TO TARYN NOW:

> Hey Taryn — went back through everything for Bonnie, this time
> pulling from my Notion logs and Upwork history too, not just
> MindBunker (which only had the tail end).
>
> Full picture: **21 pieces of Bonnie content this year** — January ad
> content, the June short-video library (6), two Content Waterfall
> batches from her Perfect Day in the Desert talk (9 clips), and the
> September batch (5), which is done and delivered.
>
> On cost — here's what I can actually stand behind: **$75 for the
> January work** (I have an exact hour breakdown for that one) and
> **another $37.50 for finalizing the 9-clip Waterfall batch back in
> early August** (that one's in my Upwork Work Diary too, not just my
> own notes). That's **$112.50 I can fully back up**.
>
> Real talk though — that's a floor, not the whole story. A bunch of
> this work (the June library, most of the actual editing on the
> Waterfall batches, the September batch) genuinely happened but I
> didn't log time against it specifically at the time, so I can't
> hand you a clean dollar number for those parts without guessing. I'd
> rather tell you that straight than make up a total that looks
> precise but isn't.
>
> If it'd help, I can start logging Bonnie's stuff separately from here
> on out so this is a non-issue going forward — just say the word.

STOP.
