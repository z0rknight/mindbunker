# RMEDIA Guided Lead Engine — Card UX V1

Status: local prototype language and interaction QA only. The Phase 0
deterministic decision model remains the authority; no production application,
route, API, schema, CRM, or database was changed.

## Current prototype diagnosis

The Phase 0 prototype was logically useful but visually behaved like a form.
Each screen contained two separate questions, every answer still required a
Continue click, numerical progress emphasized questionnaire length, and the
technical screen could expose thirteen choices at once. On mobile, the sticky
action footer made the repeated select-then-continue rhythm especially visible.

### Step-by-step audit of the previous presentation

| Previous step | Question(s) | Options visible | Card text | Cognitive load | Technical language / ambiguity | Not sure | Multi-select necessary? | Own step? |
|---|---|---:|---|---|---|---|---|---|
| Work | Content type + typical duration | 9 | Short to medium | High: two linked decisions | “Short-form/long-form” and overlapping duration concepts | Yes | No | Yes, but one conceptual question |
| Rhythm | Volume + recurrence | 9 | Short | Medium-high: answers felt redundant | Batch vs recurring could be interpreted as the same fact | Yes | No | Yes, collapsed into work shape |
| Creative direction | Format maturity + creative flexibility | 8 | Medium | High: related but distinct decisions | “Format maturity” was internal thinking, even if hidden in labels | Yes | No | Two short conversational steps |
| Materials | Source readiness + editorial readiness | 8 | Medium-long | High | “Cuts”, “timecodes”, and source readiness required producer knowledge | Yes | No | One plain-language readiness step |
| Complexity | Technical flags + dependencies | 13 | Medium-long | Very high | Motion, B-roll, multicam, aspect ratios, LOG/source repair | Yes | Not for the public first pass | Conditional step, broad choices only |
| Timing | Deadline + review complexity | 8 | Medium | Medium-high | Two concepts; “stakeholders” felt corporate | Yes | No | Two short steps because both change the model |
| Contact | Name, email, company, context | 4 fields | Minimal | Appropriate at the end | No production jargon | N/A | N/A | Yes, final input step only |

## What felt like a form

- Two fieldsets per screen.
- Nine choices on ordinary screens and thirteen on the technical branch.
- A visible Continue button after every radio-card selection.
- Numeric “Step X of Y” progress despite branching.
- A final result led with internal derived dimensions instead of repeating what
  the visitor had actually said.
- Contact looked like another form section rather than a small handoff after
  diagnostic value had already been delivered.

## What was removed or simplified

- Removed the two-decisions-per-screen layout.
- Removed mandatory Continue from every single-select question.
- Removed numeric question counts.
- Removed the public multi-select taxonomy of technical flags and dependencies.
- Removed client-facing readiness/uncertainty labels from the main summary.
- Removed B-roll, LOG, cut sheet, timecode, aspect-ratio, source-readiness, and
  stakeholder terminology from the visible conversation.
- Combined volume and recurrence into one client answer that sets both canonical
  variables.
- Combined raw-material and editorial readiness into four everyday states.
- Kept technical detail progressive and limited to one dominant concern.

No decision dimension was added. The presentation adapter maps each human
choice into the same existing canonical answer structure.

## Final question sequence

| Stage | Client question | Options | Interaction |
|---|---|---:|---|
| Getting started | What are you trying to make? | 5 | Auto-advance |
| Your content | What kind of videos are they? | 5 | Auto-advance |
| Your content | Do you already have a video style that works? | 4 | Auto-advance |
| What is ready | What do you already have? | 4 | Auto-advance |
| How we'd work | How defined is the work? | 4 | Auto-advance |
| How we'd work | Does the edit need anything special? | 5 | Conditional; auto-advance |
| Timing and review | Who gives the final go-ahead? | 4 | Auto-advance |
| Timing and review | When would you like the work to move? | 5 | Auto-advance |
| Almost done | Where should Emmanuel reach you? | 3 compact fields + 1 optional escape hatch | Explicit review action |
| Your starting point | Summary and recommended path | N/A | Edit answers or start over |

The technical question appears only when format, material, editorial direction,
or working style remains uncertain. A large batch alone does **not** reveal the
technical screen; this preserves the evidence that volume is not complexity.

## Branching sequence

### Simple / resolved

Work shape → content → established style → ready material → clear direction →
approval → timing → contact → summary.

### Complex / unresolved

Work shape → content → new/uncertain style → incomplete material → flexible
direction → special editing concern → approval → timing → contact → summary.

“Who approves?” remains in both paths. Visual QA found that hiding it caused a
real semantic error: the model received no review authority and downgraded a
fully defined project to human review. The prototype now asks the short,
plain-language question rather than inventing “one approver.”

## Final card copy

### Work shape

- One video — one specific piece.
- A few videos — a small set produced together.
- A larger batch — around five to ten related pieces.
- Ongoing content — videos needed regularly.
- I'm not sure yet — help choosing a starting point.

### Content

- Short clips.
- A few minutes.
- Longer videos.
- A mix.
- I'm not sure yet.

### Existing style

- Yes.
- Sort of.
- No.
- I'm not sure.

### Materials

- Everything is ready.
- The material is ready, but the story needs shaping.
- Some things are still coming.
- I'm not sure what I need.

### Working style

- Clear direction.
- Some flexibility.
- Let's figure it out together.
- I'm not sure yet.

### Special editing concern

- Nothing unusual.
- Graphics or animation.
- Extra footage or visuals.
- Several recordings or versions.
- I'm not sure / something else.

### Approval

- Just me.
- Me and one other person.
- A team.
- I'm not sure yet.

### Timing

- I have a specific date.
- Within a couple of weeks.
- The timing is flexible.
- I need an ongoing schedule.
- It feels urgent.

## Interaction count and fatigue

- Simple input path: 8 screens including contact, followed by one summary.
- Complex input path: 9 screens including contact, followed by one summary.
- Ordinary single-select path: 7 card clicks plus one explicit review action.
- Complex path: 8 card clicks plus one explicit review action.
- Next-button clicks before contact: zero.
- Free-form fields before contact: zero.
- Average visible options per card question: 4.43 simple / 4.50 complex.
- Maximum visible options: 5.
- Estimated straightforward completion: 45–75 seconds.
- Estimated complex/uncertain completion: 60–100 seconds.

The screen count increased relative to the original form layout because each
screen now asks one decision. Click count and reading burden decreased because
answers advance directly and no screen contains two taxonomies.

## Contact timing

Contact remains the final input step, after the visitor has already clarified
their work. Name and email are required only in the prototype's local review
simulation; business/website and one free-form sentence are optional. There is
no text field in the diagnostic path.

## Summary design

The summary now reflects the visitor's own language first:

- what you're making;
- how often;
- what's ready;
- how defined it is;
- timing;
- likely starting point.

It then states that Emmanuel reviews scope, timing, availability, and price
personally. Internal derived dimensions remain available only in the collapsed
debug payload. This makes the summary a useful return for the visitor rather
than a form-completion receipt.

## Six scenario UX review

| Case | Input screens + summary | Card/review clicks | Time estimate | UX wording finding | Result |
|---|---:|---:|---:|---|---|
| A — repeatable batch | 8 + 1 | 8 | 55–75s | Volume does not trigger unnecessary technical interrogation | Repeatable production |
| B — new recurring format | 9 + 1 | 9 | 70–95s | “Sort of” and “Some flexibility” allow honest partial clarity | Define the format first |
| C — exploratory custom | 9 + 1 | 9 | 70–100s | Motion appears only after exploration is established | Flexible collaboration |
| D — defined single | 8 + 1 | 8 | 45–65s | No technical screen; approval fact prevents false uncertainty | Defined project |
| E — unclear lead | 9 + 1 | 9 | 65–90s | Every relevant screen has a non-punitive uncertainty answer | Conversation first |
| F — PDBM | Same as selected case | Same | Same | Referral note is visible but does not alter choices or pricing | Referral preserved |

## Mobile result

Inspected at 390×844 and 375×667 plus desktop 1440×900:

- no horizontal overflow;
- one-column conceptual cards;
- 64px+ tap targets;
- no hover dependency;
- one question is visually dominant;
- Back remains available without a competing Next button;
- contact is a compact separate card;
- summary stacks into readable day-band-like rows;
- PDBM note remains visible without taking over the experience.

## Three non-technical persona reviews

### Coach

“One video / a few / ongoing” and “short clips / longer videos” require no
editing vocabulary. “What do you already have?” provides a safe route even if
the coach cannot name production assets. Remaining risk: “video style” may be
interpreted as personal branding rather than edit format; human test it.

### Educator

“A mix” covers lessons plus excerpts, while “material ready but help shaping the
story” fits Zoom recordings without requiring cut sheets or timecodes. Remaining
risk: “a few minutes” may not clearly distinguish lesson segments from full
lessons.

### Expert / guru

“How defined is the work?” captures a known outcome with an unknown production
system. “Let's figure it out together” communicates collaboration without
forcing hourly/fixed-price vocabulary. The public result now says “Define the
format first” and explains why; the internal `PILOT_SETUP` key is unchanged.

## Accessibility and motion

- Native radio controls remain keyboard reachable.
- Space selects and advances; Back restores the selected answer.
- Headings receive focus after each transition.
- Selected state uses border, background, check marker, and text—not colour only.
- Auto-advance waits 140ms for state confirmation and becomes immediate under
  `prefers-reduced-motion`.
- Reduced-motion CSS disables remaining transition/animation duration.
- Fieldsets, legends, labels, autocomplete, email input mode, live error region,
  and logical heading order remain present.
- Invalid contact submission moves focus to the live error message.
- If editing an earlier answer removes the conditional technical branch, only
  its now-inapplicable technical answer is cleared; compatible later answers
  remain intact.

## Remaining language uncertainties

1. Does “video style” mean editing format clearly enough to coaches?
2. Does “a few minutes” help, or does it make educators think about exact length
   too early?
3. Is “ongoing content” distinct enough from “a larger batch”?
4. Is “extra footage or visuals” understandable without examples?
5. Does “Define the format first” feel clear without implying free speculative
   work? This replaces the internal “Pilot / setup” wording in public copy.

These are human-language QA questions, not reasons to change the deterministic
model now.

## Local-only boundary

- Production files modified in this wave: 0.
- Production API calls: 0.
- D1 writes: 0.
- Migrations: 0.
- Deploys: none.
- Submission remains disabled; the final action renders a local summary only.
