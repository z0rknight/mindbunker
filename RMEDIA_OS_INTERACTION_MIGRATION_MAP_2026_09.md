# RMEDIA OS — Interaction Migration Map (2026-09-20)

Companion to `RMEDIA_OS_INTERACTION_AND_MOTION_SYSTEM_2026_09.md` and the lab (`docs/design/rmedia-os-interaction-lab.*`). Planning only: **no file below was modified.** Line references are from source at `21cc20b`.

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
**M1 — Motion tokens + core feedback (P0, low risk).** Files: `src/app/globals.css` (append `--os-motion-*`, `[data-intensity]`, global reduced-motion guard; keep old classes), `src/components/ui/os/{ActionButton,StatusTransition,UpdateFlash,useAction}.tsx` (new, unused at first), public `assets/css/variables.css` + `reset.css` (tokens + reduced-motion). Runtime: operator + client bundles (CSS + tiny code). Visual-regression QA: baseline only. Reduced-motion QA: yes.
**M2 — Client approval / review / delivery (P0-P1, medium: client trust, separate Worker).** Files: `src/app/client/dashboard/ReviewActions.tsx`, `src/app/client/dashboard/videos/[id]/page.tsx`, `src/app/client/[token]/page.tsx` (Watch/Download), client dashboard cards. Components: StatusTransition, ActionButton, Disclosure/reveal, delivery reveal. Deploys: `npm run deploy:client`. Must re-run: operator-only-never-in-client tests, approval action tests (unchanged), local QA of failure path via server-action failure.
**M3 — Operator status / table / queue feedback (P1, medium).** Files: `src/app/productivity/{ExecutionQueueSection,VideoOperationsCard,NeedsAttentionSection,VideoEditor,WorkSessionPanel}.tsx`, `src/app/productivity/sessions/{SessionTimeline,SessionInspectorPanel}.tsx`, `src/app/productivity/orders/*`, `src/components/production-orders/*`, `src/app/finance/contracts/*` (attribution panel), CRM `ClientActions.tsx`/`OpportunityPanel.tsx`. Components: UpdateFlash, StatusTransition, Reveal (arrival/resolve), OSModal, inspector. Must keep: `returnTo` continuity, no optimistic writes.
**M4 — Data viz / progress (P1-P2, low-medium).** Files: `src/components/ui/PerformanceStats.tsx`, `src/app/projects/page.tsx`, `src/app/war-room/page.tsx`, `src/app/equipment/page.tsx`, `src/app/productivity/sessions/SessionWeekCalendar.tsx`, `src/app/all-history/AllHistoryVisuals.tsx`, `src/app/productivity/sensor/page.tsx` (Application usage), Production Order batch bar. Components: DataBar, SegmentedProgress, ProgressRail, ValueChange, provenance legend (fact/derived/unknown). No new analytics domain.
**M5 — Public + guided intake motion (P1-P2, medium; separate public Worker).** Files: `rmedia-public-site/public/assets/css/{animations,components,variables,responsive}.css`, `index.html`/`onboarding.html`, the guided-intake prototype (`docs/prototypes/guided-intake/*`, owned by another track) once it is approved for production, `src/app/quoteavideo/*`, `src/app/book/*`, `src/app/g/[token]/*`. Components: ChoiceCard, nav/CTA states, poster frame, before/after range, one-time reveal.
**M6 — Legacy loop removal + final cleanup (P2, low).** Files: `globals.css` (`wr-*`, glow markers), `WarRoomRestaurantStage.tsx`, `projects/ProjectCover.tsx`, `components/health/ActivityTimeline.tsx`, public `animations.css` idle-bob, emoji feedback glyphs. War Room lane FLIP lands here or in M3 depending on scope. QA: visual regression + reduced motion.
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
