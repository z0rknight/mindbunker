# RMEDIA OS — Interaction & Motion System (2026-09-20)

Laboratory wave. **Nothing here is implemented in the product**: no production code, route, import, bundle, D1 row or deploy changed. The executable reference is `docs/design/rmedia-os-interaction-lab.{html,css,js}` (21 scenes, ~1,100 lines, vanilla, no network/storage). It loads the token layer from `rmedia-os-styleboard.css`. Companion: `RMEDIA_OS_INTERACTION_MIGRATION_MAP_2026_09.md`.

## 1. Source authority
GREEN. Operator HEAD = release = `production/current` = `21cc20b` (docs-only over `fc226dde2`); Operator Worker `b7130cac-…`, Client Worker `6a619197-…` (both re-read from Cloudflare deployments today); public site `aa04b1e`, clean; D1 head 0052. Two things in the worktree are **not this wave**: another session's `docs/prototypes/guided-intake/` + `RMEDIA_GUIDED_LEAD_ENGINE_*.md`, and a modified `.kilocode/…/context.md`. They were not touched or staged. That guided-intake prototype already imports the styleboard tokens, so the token names are now a contract: do not rename `--os-*`.
**Premise corrections found in source (they change the recipes):** (a) a client approval is **READY_FOR_REVIEW → DONE** (`transitionVideoStatusAsClient`), not "APPROVED"; "Approved" is the client-facing word only. (b) `payment_requests.status` is OPEN/PAID/CANCELLED, **PAID is operator-set**; the client clicking the Wise link changes nothing, and the proof of money is `transactions`. So the payment animation is tied to the operator recording PAID, never to a client action.

## 2. Current interaction audit (one pass, counts are line matches)
| Area | Evidence | Class |
|---|---|---|
| Hover/transition | 584 `hover:`, 344 `transition` (colour/border, no transforms in tables) | GOOD |
| Focus | 222 `focus:`/`focus-visible:` vs 225 `outline-none` (3 with no visible replacement) | INCONSISTENT |
| Press feedback | 27 `active:scale` (home, CRM opportunity, gateway forms, personal finance) | GOOD but unsystematic |
| Pending state | ~197 `useTransition/useFormStatus` sites, 414 `revalidatePath/router.refresh`, 0 `useOptimistic` | **SEMANTICALLY USEFUL**: every write already waits for server truth; nothing lies optimistically |
| Success feedback | e.g. `client/dashboard/ReviewActions.tsx`: sets "Approved — thank you!" only after `result.success`, but as a solid emerald box that replaces the buttons, then `router.refresh()`; 18 emoji feedback glyphs (✅ 🎉 ⚠️ ❌) | MISSING FEEDBACK (object doesn't change, whole block does) / TOO LOUD |
| Error feedback | 59 `role=alert/status/aria-live` sites, e.g. ReviewActions error `role="alert"` | GOOD |
| Toasts | 0 | correct absence (see §14) |
| Modals | 3 `role="dialog"` (`VideoEditor`, `SessionInspectorPanel`, `QuickCaptureModal`) with no enter/exit | MISSING FEEDBACK |
| Disclosure | 23 `<details>`, 0 `aria-expanded` | GOOD (native), no motion |
| Tabs | 1 `role="tab"`, 0 `aria-current` (active nav uses colour only, `Sidebar.tsx:137`) | INCONSISTENT (a11y) |
| Progress bars | 6 inline `style={{width}}` (`projects/page`, `war-room/page`, `equipment/page`, `SessionWeekCalendar`, `PerformanceStats`, `AllHistoryVisuals`), all plain %, no composition, no `role=progressbar`/text | INCONSISTENT |
| Charts | 2 `<svg>` in the whole app; charts are CSS bars | GOOD (lightweight) |
| Live | `mb-live-pulse` ring at `VideoOperationsCard:99`, `SessionTimeline:142`, `ExecutionQueueSection:171`, `PixelVisuals:74`, guarded by reduced-motion | **SEMANTICALLY USEFUL** |
| War Room | `wr-lamp-flicker`, `wr-editor-pulse`, `wr-ticket-pulse`, glow markers (`globals.css` ~279–370, `WarRoomRestaurantStage.tsx:61,106,134-141`) | DECORATIVE / LEGACY GAME MOTION |
| Stage enter | `mb-stage-enter` 220ms on `ExecutionQueueSection:157` | GOOD (kept, tokenised) |
| Card lift | 4 `hover:-translate/scale` (`ProjectCover`, `PerformanceStats`, `ActivityTimeline`) | TOO LOUD (minor) |
| Public site | `animations.css` `retroFloat` idle-bob with `steps()` on sprites, **0 `prefers-reduced-motion` in any of its 9 CSS files** | LEGACY GAME MOTION + a11y defect |
| Guided-intake prototype | one `transition` on the progress fill, one reduced-motion block | GOOD base |
Reduced motion exists in the operator (4 blocks, custom keyframes only) but the public site has none, and Tailwind `motion-safe:` is unused.

## 3. Motion principles
Animation follows truth: a state appears only after the canonical action succeeds. Every motion must answer one of seven questions (what changed / where / did my action work / is it live / did it move state / where did this panel come from / what deserves attention) or be deleted. Transform + opacity only; state has a static form first, motion second; feedback sits on the changed object; reduced motion keeps the feedback and removes the travel.

## 4. Motion tokens (implemented in the lab CSS)
```css
:root { --k:1; --os-shift-sm:4px; --os-shift-md:8px;
        --os-ease:cubic-bezier(.2,0,0,1); --os-ease-exit:cubic-bezier(.4,0,1,1); }
:root, [data-intensity] {                       /* re-derived wherever --k changes */
  --os-motion-fast:calc(120ms*var(--k));     --os-motion-standard:calc(180ms*var(--k));
  --os-motion-panel:calc(240ms*var(--k));    --os-motion-exit:calc(140ms*var(--k)); }
[data-intensity="public"]{--k:1.25} [data-intensity="client"]{--k:1;--os-shift-md:6px}
[data-intensity="operator"]{--k:.8;--os-shift-md:6px;--os-shift-sm:3px}
html[data-motion="reduced"], html[data-motion="reduced"] [data-intensity]{--k:.0001;--os-shift-sm:0;--os-shift-md:0}
```
Four durations, two eases, two shifts. One scalar, `--k`, gives the three intensities (verified: operator 112ms, client 140ms, public 175ms for the 140ms exit; reduced ≈0.01ms). Bug found and fixed in the lab: tokens must be declared on `[data-intensity]` too, otherwise the scalar changes but the derived durations do not.

## 5. State-feedback vocabulary (13 families → 9 primitives)
| Family | Purpose | Duration / ease | Properties | Max move | Use | Do NOT use |
|---|---|---|---|---|---|---|
| OS_PRESS | I clicked | fast, ease | background, scale .98 | 0 | all buttons | tables rows, links in text |
| OS_SELECT | this is chosen | fast | border, tint, radio fill | 0 | choice cards, rows, tabs, bars | as confirmation of a server write |
| OS_ENTER | appeared / opened | panel, ease | opacity, translate, grid-rows | shift-md | modal, drawer, new row, reveal | initial page render |
| OS_EXIT | left / closed | exit, ease-exit | opacity, translate | shift-sm | modal, drawer, resolved row | as decoration |
| OS_CONFIRM | canonical success | standard | pill swap, check-draw, edge marker | shift-sm | approval, payment, save | before server success; on whole screens |
| OS_UPDATE / FLASH | this changed | panel (hold ~1.4s) | background tint + 2px edge | 0 | rows, cells, cards (edge only) | on numbers, full pages |
| OS_VALUE | number changed | fast out, standard in | opacity, translate ≤ shift-sm | shift-sm | metrics | casino count-up, colour by direction |
| OS_PROGRESS | real value moved | panel | width/scaleX from previous | 0 | rails, segments, bars | draw-from-zero on load |
| OS_LIVE | actually live | 2.4s ring | opacity/scale ring | 0 | Sensor session, active work only | ambient, decorative |
| OS_WARNING / OS_ERROR | needs attention / failed | none (static) | text, border, 2px edge | 0 | rows, fields, banners | shake, pulse, flash |
| OS_REORDER | it moved | panel FLIP | transform | distance | lanes, sorted bars | tables where order is the point of scanning |
| OS_RESOLVE | issue fixed | hold 1.4s → exit | pill swap → collapse | 0 | exceptions | teleporting the layout |
"Shift" is the token, not pixels. Error and warning are deliberately motionless: colour + word + edge.

## 6. Client approval pattern (scene 1)
State machine: `READY → SUBMITTING → APPROVED` · failure `SUBMITTING → READY + error`. Press (0.98) → nothing for 150ms → if slow, label “Approve…” + 2px sweep (button width fixed, `aria-busy`, `aria-disabled` keeps focus) → **only on server success**: pill morphs “Your review” → “Approved” (width animates), check draws once inline, progress rail advances one step, a thin green **edge** (no card tint; a full-card tint was tried and rejected as too much green) holds 1.6s, a quiet line “Approved · your approval is recorded” stays; both buttons dim. A beat later the operator's own row flips “Ready for review → Done” with a violet edge and a `NEW` event line: the operator sees the effect on the next refresh. Failure keeps the state READY, shows “We couldn't save your approval. Nothing has changed”, no colour theatrics. No confetti, no modal, no fake “Delivered”. Real domain: today `ReviewActions` shows a solid emerald block; this replaces it without changing the action.

## 7. Payment pattern (scene 2)
`OPEN → PROCESSING → PAID`; failure `PROCESSING → OPEN + error`. **Non-events shown explicitly:** request sent, client opened the link → a neutral timeline line, no status change, no success cue. The amount never moves. On operator-recorded PAID: pill swaps to Paid (no dot, check), the rail fills to the recorded total, one timeline line with a check (“Payment recorded in Transactions”). Different from approval on purpose: approval reassures (continuity + progress); payment states finality (check + ledger line). No count-up, no casino vocabulary.

## 8. Production progress (scene 3)
Segmented composition: 5 segments, each its own status: done = solid green, **ready for review = hatched amber (explicitly “not done”)**, in progress = violet outline + half fill, planned = dashed empty. Text: “2 done · 1 ready for review (waiting on client) · 1 in progress · 1 planned”. A single “40%” rail is shown beside it and labelled lossy. **Initial render is stable** (no transition on mount); an update animates only the changed segment (`scaleX 0→1`, 240ms) from its previous state; the lab includes the anti-pattern toggle (“draw from 0”) for comparison. Recipes by case: upload = thick determinate rail with true chunks (only where real progress exists); intake = step markers + connectors; commercial = paid solid + unpaid dashed (not “lost”); Sensor coverage = thin rail + exact “87% · 13% unobserved (unknown, not zero)”.

## 9. Exception resolution (scene 9)
`OPEN → EDITING → SAVING → RESOLVED (hold 1.4s) → COLLAPSED`; failure `SAVING → EDITING + error` (entry kept). The fix opens in place (grid-rows), focus moves to the field; on success the pill morphs to Resolved, the detail line says what was recalculated, the counter crossfades 2 → 1, the row **stays** 1.4s so the eye sees the fix land, then collapses (exit 140ms). Last one out reveals a calm “Nothing needs attention”. Breadcrumb keeps the origin (returnTo).

## 10. Live-state language (scene 8)
`data-live="true"` = a real open Sensor session: green dot + 2.4s ring + ticking mono timer (text only). Stop → static grey. The card states “Work Session: not created — observed activity is not a Work Session”. Reduced motion replaces the pulse with a static ring (opacity .5). Rule: a live animation may only be bound to an open-state field; ambient pulses are retired.

## 11. Table / metric update (scenes 4, 5)
Row: tint + 2px first-cell edge + changed-cell highlight + a mono word (“Saved / Needs review / Not saved — reverted”), held ~1.4s, then the transition removes it. Success = green edge, warning = amber, error = red and the value **reverts**. Metric: **crossfade** (old 120ms out, new 180ms in, width reserved by tabular numerals) plus a quiet delta (“+1”, “−4h 00m”, “+$150.00”) in text-2, no direction colour. Slide (4px) is allowed only in operator counts; flash belongs to rows, not numbers; money uses crossfade only.

## 12. Chart system (scenes 6, 7, 20)
Neutral bars, violet = the selected/current element only, exact values with units, coverage line, honest unknowns. Horizontal bars (app usage; rows are focusable buttons; selection prints share + provenance), vertical bars (hours/day, `hh:mm`), sparkline (fixed 12 slots; new point fades in as a tail segment; hours exact, not a forecast), timeline strip, small distribution. **No donut**: nothing earned it. Window change (Today/3D/7D/Month) animates width from previous and keeps orientation; order stays put unless “sort by time” is on, then rows glide (FLIP 180ms). Empty → data: bars grow with a 30ms stagger. Series toggle fades a row in/out. Load stagger and all chart tweens are ≤240ms.

## 13. SOURCE FACT / DERIVED / UNKNOWN (scene 7)
Solid = source fact (attributed), hatched + “Derived” label = derived, dashed empty = unknown/unallocated (a valid state, not “missing money”). Verified by a greyscale toggle: it reads without colour. Exact-week stack “6h registered · 4h attributed · 2h unallocated”: attributing 2h grows the solid segment from its previous width (violet for 1.6s as “this just changed”), registered never changes, nothing is spread across videos.

## 14. Modal / drawer / disclosure / tabs / toast (scenes 10, 11, 12, 18, 17)
**Modal:** native `<dialog>`; backdrop fades; panel rises `shift-md` (no scale) 240ms in / 140ms out; Esc, backdrop click and Cancel all use the exit animation; focus trapped natively and **returned to the trigger** (verified); errors stay inside; success closes, then marks the trigger (`savemsg`). **Drawer/inspector:** desktop = right slide 24px + origin row stays marked violet; narrow = bottom sheet; short detail = in-place reveal. Auto-selects by container width; focus moves to the title and returns to the row on Esc/Close. **Disclosure:** button + `aria-expanded/controls` + `grid-template-rows 0fr→1fr` (no height measurement); native `<details>` remains valid (progressive `::details-content`). **Tabs:** rule-only for large data (content swaps instantly), rule + 120ms fade for small panels, segmented = background swap; roving tabindex, Arrow/Home/End verified. **Toast:** only when the changed object is off-screen or context changed; never for saves, clicks or status updates; `aria-live=polite`, 5s.

## 15. Client vs operator vs public intensity
One scalar, three densities of motion. PUBLIC ×1.25: slower rhythm, fade + 8px rise, no state density. CLIENT ×1: fewer, smaller confirmations (edge, pill, line), no dashboard theatre. OPERATOR ×0.8: shortest, densest, the only place with live rings, FLIP lane moves, row flashes and value crossfades.

## 16. Guided intake (scene 13)
Selecting a card fills the radio and holds 240ms so the choice registers, then advances; forward slides 8px in from the right, Back from the left; a thin rail with step markers shows position; the summary lines reveal with a 30ms stagger; a PDBM referral note fades in and adds a “referral · PDBM” line; the final step is inputs plus a prototype-only send. Arrow keys move the radio group, focus moves to the new heading, the step is announced (`aria-live` via a status region). It stays a conversation, not a form: one question, plain choices, no scoring.

## 17. Public motion + real work (scene 21)
Nav underline (120ms), CTA press (0.98), poster → hover/focus metadata (touch: first tap reveals, second opens), click → light preview dialog (poster load rail, **no autoplay**), before/after as a native range input (keyboard, no JS drag code), one-time section reveal (fade + 8px, disabled when reduced). No parallax, idle float, cinematic loader, autoplay grid.

## 18. Accessibility
Keyboard: every scene is operable (tabs/radio arrows, dialog Esc, row Enter/Space, range input). Focus: never removed; dialogs return focus; inspector returns focus to its row; forms move focus to the first invalid field. Screen readers: a single `role=status` announcer for state changes; `aria-busy`/`aria-disabled` on pending buttons (focus stays); `aria-selected/aria-pressed/aria-expanded/aria-checked` on stateful controls; chart columns/rows carry full-sentence labels. Non-colour: pills carry a word + a dot shape (processing = square); bars use hatch/dash; greyscale test provided. Reduced motion: `--k≈0`, shifts 0, rings replaced by a static ring, sweep removed, `.rv` reveals shown, **flash markers and text feedback retained**. Automated pass: every text/background pair on the lab meets AA except the intentionally disabled button (exempt). Known gaps: `.btn.sm` is 30px on desktop (operator density, 40px under 860px); modals initially focus the first control, not the title (consider `autofocus` on the heading later).

## 19. Performance
CSS transitions on transform/opacity/grid-rows; WAAPI used only for two FLIP moves; one `setInterval` (Sensor timer), one `IntersectionObserver`; no rAF loops; no library; ~1,100 lines total; zero network, zero storage. Layout: the grid-rows reveal reflows one subtree; large tables never animate their rows.

## 20. Patterns to retire (source locations; nothing modified)
1. `globals.css` `wr-lamp-flicker` keyframe (~292) + `.wr-lamp-glow` (300) · `WarRoomRestaurantStage.tsx:61` — ambient lamp flicker.
2. `wr-editor-pulse` (~346) + `wr-editor-glow*` · `WarRoomRestaurantStage.tsx:134–141` — pulse without a state change.
3. `wr-ticket-pulse` (~356) · `WarRoomRestaurantStage.tsx:106–107` — ticket pulse (REVIEW) with no new event.
4. `.wr-table-marker*` glow shadows (312–327) — decorative glow (keep the colour, drop `box-shadow` glow).
5. Public `assets/css/animations.css:6,15,33,46` — `retroFloat` idle-bob on sprites (3 uses).
6. Public site: **no** `prefers-reduced-motion` in any CSS file.
7. `hover:-translate-y/scale` card lift in `ProjectCover.tsx`, `PerformanceStats.tsx`, `ActivityTimeline.tsx`.
8. Instant modals: `VideoEditor.tsx`, `SessionInspectorPanel.tsx`, `QuickCaptureModal.tsx`.
9. Emoji-as-feedback (18 matches of ✅ 🎉 ⚠️ ❌ in TSX).
10. Whole-block solid success/warning fills: `client/dashboard/ReviewActions.tsx` (emerald/amber blocks).
11. `mb-live-pulse` on the **non-live** cases only if any: audit `ExecutionQueueSection:171` (`isActive`) is correctly state-bound (keep).
12. Colour-only active nav (`Sidebar.tsx:137–148`, no `aria-current`) — add semantics, not motion.
Count for the final block: 10 motion/interaction items to retire (1–10); 11–12 are keep/semantic fixes.

## 21. Priority matrix
| Pri | Item | Impact | Reuse | Effort | Risk |
|---|---|---|---|---|---|
| P0 | Motion tokens + global reduced-motion guard (operator `globals.css`, public CSS) | H | H | L | L |
| P0 | ActionButton (aria-disabled, 150/300 rule) + StatusTransition + UpdateFlash primitives | H | H | L-M | L |
| P0 | Client approval feedback (`ReviewActions`) | H | M | L | L |
| P1 | OSModal (enter/exit, focus return) for 3 dialogs | H | H | M | M |
| P1 | SegmentedProgress for Production Orders + labelled progress rails | H | M | M | L |
| P1 | Table-row flash after mutations (Sessions, Finance attribution, CRM) | H | H | M | L |
| P1 | Public: reduced-motion + remove idle-bob + focus/press | H | M | L | L |
| P1 | War Room: retire ambient loops, add lane FLIP | M | L | M | M |
| P2 | ValueChange for metrics; DataBar/legend patterns; source/derived/unknown encodings | M | M | M | L |
| P2 | Inspector/sheet/in-place unification; Disclosure primitive | M | M | M | M |
| P2 | Guided-intake motion; real-work frames | M | M | M | L |
| P3 | View Transitions API; sparkline/strip charts as components; sound; haptics; toast system | L | L | M-H | M |

## 22. Future component contracts (10; lab classes map 1:1)
| Component | Inputs | Semantic responsibility | Motion | Reduced |
|---|---|---|---|---|
| `<StatusTransition status label/>` | `status` (domain status), `label` | shows an already-canonical status; never sets it | label swap 120ms + width tween | instant swap |
| `<ProgressRail value max status live?/>` | numeric value, optional `status` | one real value; `role=progressbar` + text | width from previous 240ms; none on mount | instant |
| `<SegmentedProgress items=[{status}]/>` | ordered statuses | composition; review ≠ done | changed segment scaleX 240ms | instant |
| `<LiveIndicator live/>` | `live` boolean bound to an open-state field | is it live | 2.4s ring | static ring |
| `<ValueChange value mode/>` | display string, `crossfade|slide|flash` | shows a change, not the change's meaning | 120/180ms | instant |
| `<UpdateFlash tone when/>` | `success|warning|error|info`, trigger key | marks the changed object | tint fades 240ms after ~1.4s hold | marker stays 1.4s, then removes |
| `<OSModal open onClose>` | open, labelled title | blocking decision, focus return | rise 240 / exit 140 | instant |
| `<Disclosure open onToggle>` | open | reveal detail | rows 0fr→1fr 240/140 | instant |
| `<ChoiceCard checked value>` | checked, label, hint | one radio option | border/tint 120ms | instant |
| `<DataBar value max source selected>` | value, `source=fact|derived|unknown` | exact value + provenance | width from previous 240ms | instant |
Also `useAction()` (idle→loading(150ms/300ms)→success|error; returns `{run,state}`) as the shared hook. **Do not add to production now.**

## 23. State-machine recipes
- **Approval:** READY → SUBMITTING → APPROVED; SUBMITTING → READY + ERROR. (Domain write: `transitionVideoStatusAsClient(id,"DONE")`; UI success only on `result.success`.)
- **Payment:** OPEN → PROCESSING → PAID; PROCESSING → OPEN + ERROR. Non-events: SENT, LINK_OPENED. (Domain: operator sets `payment_requests.status`; proof = a `transactions` row.)
- **Save (field):** IDLE → SAVING (“Saving…” after 150ms) → SAVED (text + border tint, 1.2–1.8s) → IDLE; ERROR is sticky until the next edit.
- **Status change (row/pill):** CURRENT → PENDING (square dot) → NEW (pill swap + flash) | CURRENT (+ inline error, value reverted).
- **Async error:** any → ERROR keeps the previous truth, names what did not happen (“Nothing has changed”), keeps user input, restores focus to the failing control, no motion.
Optimistic UI policy: **safe** = tab selection, disclosure, choice-card selection, sorting, window toggle, inspector open. **Wait for server** = client approval, payment status/records, billing evidence, attribution, any status transition, delivery link, referral/lead creation. The app today has 0 `useOptimistic`; keep it that way for the second group.

## 24. Reference research (pattern only; not a gallery)
Fetched this session: Vercel's Web Interface Guidelines, a Linear design write-up, a Stripe-dashboard design search. Not fetched (general knowledge, flagged): Raycast, Frame.io, Arc, professional creative tools.
| Pattern | Why it works | Where RMEDIA uses it | Don't copy literally |
|---|---|---|---|
| Delay + minimum visibility for spinners (150–300ms in / 300–500ms min) — Vercel | prevents flicker on fast actions | ActionButton rule (150/300) | their spinner-with-label; we use label “…” + 2px sweep |
| Optimistic with rollback; keep submit enabled until in-flight, idempotency key — Vercel | feels instant for low-risk edits | only the “safe” set in §23 | financial/approval writes stay server-truth |
| Animate only to clarify cause/effect; interruptible; CSS over JS — Vercel | keeps motion meaningful | every motion must answer a question (§3) | “deliberate delight” has no place in operator |
| Layered surfaces establish priority; restrained accents; alignment as polish — Linear | calm density | already the foundation | their exact purple/gradient treatment |
| Table is the truth, chart is the summary; deltas + semantic pills; tabular figures — Stripe dashboard | trust through clarity | source/derived/unknown charts, row flashes | their colour system |
| Command-palette / keyboard-first speed (Raycast, Linear) | fast repeat actions | future operator quick actions (not in this wave) | glow and glass |
| Media-first review with quiet chrome (Frame.io) | client trust | approval card, poster-first frames | comment-thread complexity |

## 25. Design review (four hats)
| Scene | UX | Front-end | Client | Operator | Understandable / too much-little / true / reusable / safe |
|---|---|---|---|---|---|
| 1 Approval | clear continuity | 1 helper set | reassured | sees the effect | Y / right / true (waits for server) / Y / Y |
| 2 Payment | finality without spectacle | reuses pill+flash | n/a | trusts the ledger line | Y / right / true (non-events shown) / Y / Y |
| 3 Progress | composition not %, | CSS only | clear | fast | Y / right / true / Y / Y |
| 4 Row / 5 Metric | noticeable, calm | flash/valuechange | n/a | Y | Y / right / true / Y / Y (slide is optional) |
| 6–7,20 Charts | exact, honest | one DataBar | n/a | good | Y / slight density on mobile / true / Y / Y |
| 8 Live | unambiguous | 1 attribute | n/a | Y | Y / right / true / Y / Y |
| 9 Exception | continuous | reveal util | n/a | Y | Y / **hold could feel slow for a batch of many** / true / Y / Y |
| 10–12,18 Overlays | conventional | native dialog/details | fine | Y | Y / right / n/a / Y / Y |
| 13 Intake | quick, human | 1 renderer | good | n/a | Y / right (real questions come from the intake prototype) / n/a / Y / Y |
| 14 Delivery | separates facts | reveal util | calm | n/a | Y / right / true / Y / Y |
| 15 Arrival | quiet edge + New | reveal util | n/a | Y | Y / right / true / Y / Y |
| 19 War Room | gliding lanes | 2 WAAPI moves | n/a | good | Y / right / true / Y / Y |
| 21 Public | disciplined | CSS + IO | n/a | n/a | Y / right / n/a / Y / Y |
Honest limits: I exercised the lab through scripted DOM interaction (state, focus, timing, tokens, reduced motion) and mobile/desktop screenshots of five scenes; I did not judge animation *feel* frame-by-frame, nor screenshot at desktop width (the preview pane cannot render large emulations).

## Human decisions (max 5; only taste, still open)
1. **Paid feedback strength:** current pattern is pill + check + ledger line + rail fill (quiet, final). Add a slightly stronger cue (e.g. a 1.6s edge on the whole card), or keep it this quiet?
2. **Charts:** editorial (more air, larger figures) or instrument-like (denser, more mono)? The lab leans instrument in operator.
3. **Client approval signature:** keep the check-draw as the single tiny signature, or none at all (pill + line only)?
4. **Public real-work previews:** poster + click-to-open only (recommended), or allow a short muted on-hover clip once posters exist?
5. **Heritage pixel:** may the operator keep one tiny pixel interaction (e.g. an About/footer easter egg), or none?
