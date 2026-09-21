# RMEDIA OS — Interaction Migration Map (2026-09-20)

Companion to `RMEDIA_OS_INTERACTION_AND_MOTION_SYSTEM_2026_09.md` and the lab (`docs/design/rmedia-os-interaction-lab.*`). Line references are from source at `21cc20b`. **Status: M1–M6 IMPLEMENTED / CLOSED (2026-09-20).**

## 1. Legacy → future map
| Legacy (source) | Future | Lab scene |
|---|---|---|
| `ReviewActions.tsx` solid emerald/amber block replaces buttons after success | pill morph + inline check + thin edge; buttons dim; error under buttons | 1 |
| Ad-hoc `disabled:opacity-50` pending buttons (`useTransition`, ~197 sites) | `useAction` + `<ActionButton>`: `aria-disabled`, label “…” after 150ms, ≥300ms | 16 |
| `Approved — thank you!` copy + emoji ✅🎉 feedback (18) | text + check icon only; copy unchanged unless Emmanuel decides | 1, 16 |
| Inline `style={{width}}` bars (6 files) | `<ProgressRail>` / `<SegmentedProgress>` / `<DataBar>` with text + `role=progressbar` | 3, 6 |
| Instant dialogs (`VideoEditor`, `SessionInspectorPanel`, `QuickCaptureModal`) | `<OSModal>` / inspector with enter 240 / exit 140, focus return | 10, 18 |
| `wr-lamp-flicker`, `wr-editor-pulse`, `wr-ticket-pulse`, glow markers (`globals.css` ~279–370) | static state colours; lane FLIP on real moves; `data-live` ring only for open sessions | 19, 8 |
| `mb-live-pulse` (4 sites) | `<LiveIndicator live>` bound to the open-state field | 8 |
| `mb-stage-enter` 220ms (`ExecutionQueueSection:157`) | `OS_ENTER` at `--os-motion-panel` (or keep: equal) | 15 |
| Colour-only active nav (`Sidebar.tsx:137`) | + `aria-current="page"`, violet-tint + rule (styleboard) | – |
| `hover:-translate/scale` lift (3 files) | border/background hover only | – |
| Public `retroFloat` idle-bob (`animations.css`), no reduced-motion | removed; global reduced-motion guard | 21 |
| Row updates after `revalidatePath` with no marker | `<UpdateFlash>` keyed to the changed row/cell | 4 |
| Metric cards that just re-render | `<ValueChange>` (crossfade + delta) | 5 |
| Exception lists that reflow on refresh | resolve → hold → collapse | 9 |

## 2. Trains (reordered: primitives first, then the surface with most trust value)
**M1 — Motion tokens + core feedback — IMPLEMENTED 2026-09-20 (operator `888374e7`, client `e3cde419`, public `a25df560`).** Files: `src/app/globals.css` (append `--os-motion-*`, `[data-intensity]`, global reduced-motion guard; keep old classes), `src/components/ui/os/{ActionButton,StatusTransition,UpdateFlash,useAction}.tsx` (new, unused at first), public `assets/css/variables.css` + `reset.css` (tokens + reduced-motion). Runtime: operator + client bundles (CSS + tiny code). Visual-regression QA: baseline only. Reduced-motion QA: yes.
### M1 as built (what M2+ can rely on)
- Tokens live in `src/app/globals.css` (same file serves operator and client): `--os-motion-*`, `--os-ease*`, `--os-shift-*`, scalar `--os-motion-scale` (the lab's `--k`), `data-intensity`, real `prefers-reduced-motion` + `html[data-motion="reduced"]` test hook. Public site got the same names in `variables.css` (scale 1.25) and a reduced-motion guard in `animations.css` that stops the idle-bob and card lift.
- Primitives (`@/components/os`): `ActionButton` (takes the caller's `pending`, optional caller-supplied `state`; `aria-busy` + `aria-disabled`, never `disabled`; 2px CSS bar after ~150ms, >=300ms once shown; width never changes), `StatusTransition` (takes `label`, `tone`, `marker`, optional `status`; renders truth, derives none; `variant="inline"` for plain text), `UpdateFlash`/`useUpdateFlash` (tone `success|brand|warning`; error stays static; ~1.4s hold; not on first render), `useAction` (pending bookkeeping only; returns the wrapped promise; ignores late updates after unmount), `usePendingGate` (turn any `isPending` into a flicker-free indicator).
- Deviations from the lab, on purpose: (1) `StatusTransition` takes a presentation *tone*, not a domain status, so the primitive owns no business states (M2 maps `READY_FOR_REVIEW→DONE` to tone/label at the call site); (2) no width tween on the pill (label fade only); (3) the loading cue is a bar, the label is not changed to “…”, so buttons never change width; (4) **lab bug fixed:** a transition declared only on `[data-flash]` snaps when the attribute is removed, so production puts the transition on an always-present `.os-flash` class (the lab CSS carries a patch note).
- Not yet adopted anywhere: `UpdateFlash`, `useAction`, `StatusTransition` in status pills (only inline in `CopyLinkButton`). Proof surfaces: `aria-current` (desktop + mobile nav), `CopyLinkButton`, War Room refresh (`ActionButton` + `usePendingGate`).
- **Dependencies for M2:** none blocking. M2 should wrap the existing `transitionVideoStatusAsClient` call with `pending` from its existing `useTransition` (no new mutation path), render success only from `result.success`, map READY_FOR_REVIEW→DONE at the call site, and place `UpdateFlash` on the changed card. Client surfaces already sit inside `data-intensity="client"`.

**M2 — Client approval / review / delivery — IMPLEMENTED 2026-09-20 (client Worker `85e1fb34`; operator not redeployed).** Files: `src/app/client/dashboard/ReviewActions.tsx`, `src/app/client/dashboard/videos/[id]/page.tsx`, `src/app/client/[token]/page.tsx` (Watch/Download), client dashboard cards. Components: StatusTransition, ActionButton, Disclosure/reveal, delivery reveal. Deploys: `npm run deploy:client`. Must re-run: operator-only-never-in-client tests, approval action tests (unchanged), local QA of failure path via server-action failure.
### M2 as built
- Files: `client/dashboard/{ReviewActions,ReviewActionsView,ClientStatusBadge,DeliveryAvailability,BatchProgress}.tsx`, `VideoCard.tsx`, `page.tsx`, `videos/[id]/page.tsx`; `modules/client-portal/{review-flow,delivery-state,batch-progress}.ts` (pure), `data.ts` (batch item `statusLabel`), `globals.css` (`.os-color-fade`, `.os-enter`, `.os-seg*`). Tests: `client-review-feedback.test.mjs` (14).
- Semantics kept: the approval is the existing READY_FOR_REVIEW → DONE action; the pill shows the canonical client label ("Completed"/"Delivered"), the acknowledgement uses the existing copy ("Approved — thank you!") only after `result.success`; delivery is a separate panel (brand tint) that shows only for DONE videos whose delivery link is the primary link; review-link opening is not tracked or animated; no "new version" state exists in the domain, so none was invented (future: needs a canonical fact such as a revision/version marker).
- Deviations from the lab: dashboard cards hold the revalidation ~1.4s so the acknowledgement is seen before the card leaves "Needs your attention" (detail page refreshes immediately); the success edge sits on the review block, not the whole card; the batch rail is decorative (`aria-hidden`) with the composition as text; segments transition from their previous look because they keep stable keys across `router.refresh`.
- Findings (not fixed here): (1) the batch item list used a static "Delivered" label for every DONE item (fixed: uses the same delivery-aware label as the cards); (2) `recentDeliveries` is built from completion events, so a video completed twice (reopened then DONE again) appears twice and triggers a React duplicate-key warning in dev; latent, pre-existing.
- **M3 dependencies:** none blocking. `UpdateFlash` for table rows, `StatusTransition` for operator pills and the segmented rail (operator variant) are ready; payment motion remains a separate later train.

**M3 — Operator status / table / queue feedback — IMPLEMENTED 2026-09-20 (operator `8cea751f`, client rebuilt `4a4eb1c9`).** Files: `src/app/productivity/{ExecutionQueueSection,VideoOperationsCard,NeedsAttentionSection,VideoEditor,WorkSessionPanel}.tsx`, `src/app/productivity/sessions/{SessionTimeline,SessionInspectorPanel}.tsx`, `src/app/productivity/orders/*`, `src/components/production-orders/*`, `src/app/finance/contracts/*` (attribution panel), CRM `ClientActions.tsx`/`OpportunityPanel.tsx`. Components: UpdateFlash, StatusTransition, Reveal (arrival/resolve), OSModal, inspector. Must keep: `returnTo` continuity, no optimistic writes.
### M3 as built
- New primitives (`@/components/os`, pure logic in `lib/os`): `useChangedKeys` + `flashTarget` (cell vs row), `useArrivals`/`ArrivalScope`/`ArrivalItem`/`useIsNew` + `NewBadge`, `useDepartures` + `DepartureNotice`, `ValueChange`, `resolve-flow` reducer, `focus.ts` (`rememberFocusLandmark`), shared `BatchProgress`. CSS: `tr.os-flash` edge on the first cell, `.os-new-label`, `.os-arrive`, `.os-vc*` (reduced motion hides the outgoing layer; markers stay).
- Adopted on: Work Session history rows, `SensorSessionActions`, Sensor inbox/long-session counts + departures, Sensor connectivity dot (`sensorIndicator`, live only when connected + open Work Session), Needs Attention (arrivals, count, departures), War Room comandas/editor/tables, operator Production Order rail.
- Lab deviations / findings: (1) these server actions call `revalidatePath`, so the item can leave the list in the very response that confirms it; a per-row "hold then remove" cannot work there, so continuity lives at the queue (`DepartureNotice` + focus landmark) and the row keeps its own confirmation only when it stays mounted; (2) row-level `box-shadow` is unreliable on `<tr>`, so the edge sits on the first cell; (3) the War Room flash key excludes elapsed time so the 30s refresh stays silent; (4) `recentDeliveries` now lists each video once.
- Not adopted (by design): War Room ambient `wr-*` loops remain (M6); Finance/CRM rows, payment states, StatusTransition on operator pills beyond the comanda phase label; no toast system was added.
- **M4 dependencies:** none blocking. Progress rails/segments exist (`BatchProgress`), the value/flash/arrival primitives are ready; charts and the source/derived/unknown encodings are the M4 work.

**M4 — Data viz / progress — IMPLEMENTED 2026-09-20 (operator `e9ebcccb`; client not redeployed).** Files: `src/components/ui/PerformanceStats.tsx`, `src/app/projects/page.tsx`, `src/app/war-room/page.tsx`, `src/app/equipment/page.tsx`, `src/app/productivity/sessions/SessionWeekCalendar.tsx`, `src/app/all-history/AllHistoryVisuals.tsx`, `src/app/productivity/sensor/page.tsx` (Application usage), Production Order batch bar. Components: DataBar, SegmentedProgress, ProgressRail, ValueChange, provenance legend (fact/derived/unknown). No new analytics domain.
### M4 as built
- Components/logic: `DataBar`, `EvidenceRail` (server components, no state), `lib/os/evidence-rail.ts`, operator wording/cancelled note for `BatchProgress`, CSS `.os-databar*` / `.os-rail*` (transitions on width only; nothing plays on mount; hatch = derived, dashed = unknown, `data-tone="muted"` = quieter known fact such as idle).
- Adopted: Sensor Application usage bars + intentional coverage rail; Finance `AttributionPanel` rail; `BatchEvidenceBlock` weekly rails + `ValueChange` counts; operator order rail wording.
- Findings: (1) Application-usage window switches are soft navigations, so keyed rows keep their DOM nodes and the width transition runs for free (no JS); (2) coverage reconciles exactly (active + idle + no-telemetry = intentional session time) and the unknown part stays a first-class dashed segment; (3) "elsewhere" in the batch weeks mixes explicit and derived attribution, so it is labelled neutral and never as billed/paid.
- Not built (no current question): sparkline, timeline strip, ACTIVE-view coverage rail, donut/pie. The lab keeps those recipes.
- **M5/M6 dependencies:** none blocking.

**M5 — IMPLEMENTED 2026-09-20 (final convergence; public `1eb74170`). Original scope: Public + guided intake motion (P1-P2, medium; separate public Worker).** Files: `rmedia-public-site/public/assets/css/{animations,components,variables,responsive}.css`, `index.html`/`onboarding.html`, the guided-intake prototype (`docs/prototypes/guided-intake/*`, owned by another track) once it is approved for production, `src/app/quoteavideo/*`, `src/app/book/*`, `src/app/g/[token]/*`. Components: ChoiceCard, nav/CTA states, poster frame, before/after range, one-time reveal.
**M6 — IMPLEMENTED 2026-09-20 (final convergence; operator `1362c77c`, client `cf5be8f8`, public `1eb74170`). Original scope: Legacy loop removal + final cleanup (P2, low).** Files: `globals.css` (`wr-*`, glow markers), `WarRoomRestaurantStage.tsx`, `projects/ProjectCover.tsx`, `components/health/ActivityTimeline.tsx`, public `animations.css` idle-bob, emoji feedback glyphs. War Room lane FLIP lands here or in M3 depending on scope. QA: visual regression + reduced motion.
Reorder rationale: M1 unblocks everything and is invisible; M2 moves before M3 because the client sees motion once and trust matters most; M4 waits for M1 primitives; M5 waits for the separately-owned intake prototype; M6 is deletions.
**Next recommended: M1 only** (tokens + core feedback), then decide M2.

## 3. File-level implementation map (short prompts)
| Surface | Files / components | Train |
|---|---|---|
| Client approval | `client/dashboard/ReviewActions.tsx`, `videos/[id]/page.tsx` | M2 |
| Client delivery/version | `client/[token]/page.tsx`, dashboard video cards | M2 |
| Video Workspace | `productivity/VideoEditor.tsx`, `WorkSessionPanel.tsx`, `VideoOperationsCard.tsx` | M3 |
| Production Orders | `productivity/orders/*`, `components/production-orders/*`, `modules/production-orders` (read-only for status) | M3, M4 |
| Finance | `finance/contracts/*`, `FinanceTabs.tsx`, Record/Delete buttons | M3 |
| War Room | `war-room/page.tsx`, `war-room/restaurant/WarRoomRestaurantStage.tsx`, `globals.css` `wr-*` | M6/M3 |
| Sensor Activity / Sessions | `productivity/sensor/page.tsx`, `productivity/sessions/*` | M3, M4 |
| Sidebar / shell | `components/layout/Sidebar.tsx` (aria-current) | M1 |
| Modals | `VideoEditor`, `SessionInspectorPanel`, `quick-capture/QuickCaptureModal.tsx` | M3 |
| Guided intake | `docs/prototypes/guided-intake/*` (other track), `quoteavideo/*`, `book/*` | M5 |
| Public CSS | `rmedia-public-site/public/assets/css/*` | M1, M5, M6 |

## 4. Reference snippets (concise; the lab has the full versions)
```css
/* UpdateFlash: a static marker; JS removes the attribute after ~1.4s and the transition fades it */
[data-flash]{transition:background-color var(--os-motion-panel) var(--os-ease),box-shadow var(--os-motion-panel) var(--os-ease)}
[data-flash="success"]{background:var(--os-success-tint);box-shadow:inset 2px 0 0 var(--os-success)}

/* Reveal: height without measuring */
.reveal{display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows var(--os-motion-panel) var(--os-ease),opacity var(--os-motion-panel) var(--os-ease)}
.reveal[data-open="false"]{grid-template-rows:0fr;opacity:0;transition-duration:var(--os-motion-exit)}
.reveal>.in{min-height:0;overflow:hidden}

/* Progress: animate from previous only; no transition on first paint */
.rail>i{width:calc(var(--v)*1%);transition:width var(--os-motion-panel) var(--os-ease)}

/* Reduced motion = tokens collapse; markers and text remain */
html[data-motion="reduced"],html[data-motion="reduced"] [data-intensity]{--k:.0001;--os-shift-sm:0;--os-shift-md:0}
```
```ts
// useAction: no spinner under 150ms; once shown, stay >=300ms; never optimistic for approval/payment/evidence
async function run(work){ const t=setTimeout(()=>set('loading'),150); let shown=0; /* … */ }
```
```tsx
// React shape (React 19 / Next 16): state drives attributes, CSS does the motion
<span className="st" data-status={status}><span className="lbl">{label}</span></span>
<tr data-flash={flash}>…</tr>
```
Tailwind v4: express the tokens with `@theme` custom properties and use `data-[flash=success]:` / `data-[open=false]:` variants; keep the reveal and flash rules in one small CSS layer (the arbitrary grid-rows transition is clearer in CSS than in utilities).

## 5. What this wave did not do
No product change, no imports/routes, no deploy, no D1 access, no framework, no sound, no haptics, no visual regression run, no light theme.

### M5 + M6 closure (as built)
- **/start (public repo `public/start/`)**: production motion tokens, hold-then-advance selection, direction-aware steps, "Step n of N" progress, delayed pending cue with `aria-busy`/`aria-disabled`, card focus ring, sticky bar only on contact/review, Inter, brand link, copy fix. Model/envelope/API untouched.
- **Legacy loops removed (7)**: public idle-bob ×3 (`.avatar-slot`, `.huge-slot`, hover speed-up), War Room lamp flicker, editor pulse, review-ticket pulse, review/blocked marker ring loop. **Lift/glow removed**: public class-card lift and glows, War Room table hover lift and glows, stat-tile scale, xp-bar glow.
- **Kept on purpose**: the shared live ring (`mb-live-pulse`, live sessions only), `mb-stage-enter`, `wr-panel-enter`, CTA press, scroll-progress bar.
- **Deferred**: dialog exit motion (needs a modal primitive), public game vocabulary/sprites/red primary, emoji nav icons.
