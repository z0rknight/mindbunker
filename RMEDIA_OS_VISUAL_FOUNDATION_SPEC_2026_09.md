# RMEDIA OS — Visual Foundation Spec (2026-09-20)

Design foundation plus implemented authority amendments. The original study remains below as historical evidence; `RMEDIA_CURRENT_HANDOFF_2026_09.md` owns current source/deploy facts.

## Current amendment — Sep 20–21, 2026

**YouTube Red `#FF0000` is the current primary brand and interactive accent for Public and MindBunker/Operator. This supersedes every violet-primary or “red only means danger” statement in the historical foundation below.** Public and Operator use a lighter red companion for small text/focus on dark surfaces. Client Portal was not broadly recoloured. Green remains confirmed success, amber remains warning/waiting, unknown remains neutral/dashed, and derived remains hatched plus explicitly labelled. Since red also carries brand identity, destructive meaning must additionally use destructive copy, context and confirmation rather than colour alone. Public entrance motion is finite (opacity + 8px rise, 300ms at public intensity, 50–60ms related-element stagger); reduced motion shows content immediately with no translation or delay.

## 1. Historical source authority (superseded by current handoff)
Operator HEAD = release = `production/current` = `fc226dde2` (docs-only over product commit `eb568bb`); Operator Worker `b7130cac-…`, Client Worker `6a619197-…`, D1 migration head 0052 (none pending); public site `aa04b1e`, clean. Direction inherited from `RMEDIA_OS_AESTHETIC_DIRECTION_AND_FINALIZATION_STUDY_2026_09.md` ("calm production pass", evidence-first, flat kitchen-display metaphor). Legacy facts measured against source on 2026-09-20 (counts in the migration map). The public site is a separate static repo and was read-only here.

## 2. Historical brand decision (superseded)
The former violet-primary decision is retained only to explain earlier artifacts. The current Public + MindBunker authority is YouTube Red `#FF0000` as stated in the amendment above. Inter is the primary family for UI, body, headlines and public type; one restrained mono (system stack, nothing downloaded). Press Start 2P is not structural. Mark = RM monogram + RMEDIA wordmark. Pixel language: public retired, client retired almost entirely, operator heritage traces only. External name is "RMEDIA Client Portal" ("Vault" internal only). One design system, three densities.

## 3. External research patterns (8 references, one pass)
| Reference | Class | Useful pattern | Where RMEDIA can use it | Do not copy |
|---|---|---|---|---|
| Frame.io | CLIENT TRUST | Media is the hero; chrome is near-invisible; review state is a plain word plus a dot | Client review rows and the public real-work frames | Product-marketing gradients and feature-grid density |
| Linear | INFORMATION DENSITY | Tight rows, hairline borders, tabular numerals, one accent used sparingly, keyboard-first | Operator tables, War Room, Sessions | Its exact purple/gradient hero treatment; issue-tracker vocabulary |
| Raycast | SURFACE RESTRAINT | Dark neutral surfaces with strong text hierarchy, small precise controls, quiet overlays | Modal/menu elevation, operator command surfaces | Heavy glow and blurred glass |
| Resend | TYPOGRAPHY | Confident large sans headline, mono for technical labels, big spacing, almost no colour | Public hero and mono system labels | Developer-docs tone |
| DaVinci Resolve | MOTION / DENSITY | Timecode, scopes and readouts as functional instrumentation; state-driven indicators | REC dot, timecode on frames, readout numerals | Its full panel density on public/client surfaces |
| Cal.com | PUBLIC PRESENTATION | Clear booking path, one primary action, plain choice cards | Lead path → booking continuity | Generic SaaS card grids; its logo wall pattern |
| Typeform | CLIENT TRUST / PUBLIC | One question at a time, calm progress, large tappable choices | Guided intake visual grammar (visual only) | Full-bleed colour blocks and quiz feel |
| Pentagram | PUBLIC PRESENTATION | Work first, restrained type, editorial whitespace, credit-style metadata | Real-work-as-hero, case-style captions | Agency-portfolio opacity; no visible service path |

## 4. Brand architecture
RMEDIA = master brand · RMEDIA OS = system language/ecosystem · MindBunker = operator console (backstage) · RMEDIA Client Portal = client surface · emmanueldarosa.com = public trust/work/acquisition. **One mark, one wordmark, one qualifier slot.** The qualifier is a mono uppercase suffix after a hairline divider (`RMEDIA | CLIENT PORTAL`, `RMEDIA | MINDBUNKER`); the public site shows no qualifier. Shared: wordmark, type, colour, spacing, surface language, status semantics, motion. Different: density and chrome.

## 5. Three density modes
| | PUBLIC | CLIENT | OPERATOR |
|---|---|---|---|
| Body | 17/28 | 16/26 | 14/22 |
| Card padding | 28 | 24 | 14 |
| Control height | 48 | 44 | 32 |
| Card radius | 16 | 16 | 12 |
| Content width | 1120 wide, 65ch text, hero wider | 880 single column | fluid, dense grids, max 1600 |
| Chrome | recedes; one nav bar | quiet top bar only | sidebar + breadcrumbs + readouts |
| Mono labels | sparse (section eyebrows) | almost none | pervasive (headers, evidence chips, readouts) |
| Motion | fades, rise | fades, rise | state confirms only |
Implemented as `[data-density]` overrides of six variables; roles do not change between densities.

## 6. Token proposal (exact)
```
Neutrals    --os-bg #09090B · --os-surface-1 #101013 · --os-surface-2 #16161A · --os-surface-3 #1E1E24 (elevated)
Borders     --os-border rgba(255,255,255,.08) · --os-border-strong rgba(255,255,255,.16) · --os-border-control #6A6A73 (inputs; ≥3:1)
Text        --os-text #F4F4F5 · --os-text-2 #A1A1AA · --os-text-3 #8C8C96 · --os-text-disabled #55555D
Brand       --os-violet #6E49E6 (fill) · --os-violet-hover #7C5CEE · --os-violet-press #5F3FD3 · --os-violet-text #A99BFA · --os-violet-tint rgba(110,73,230,.16)
Focus       --os-focus #B9AEFB (2px ring, 2px offset; inputs add a 3px 28% halo)
Semantic    --os-info #7CB7F4 · --os-success #3DD68C · --os-warning #F2B33D · --os-danger #F26D6D · --os-rec #FF5A52 (+ 14% tints for pill backgrounds)
Spacing     2 4 8 12 16 24 32 48 64 96 128
Radius      4 · 8 · 12 · 16 · pill only for dots/avatars
Motion      120 · 180 · 240 (exit 140) ms · cubic-bezier(.2,0,0,1) · lift 8px
```
Violet has **two jobs**: a deep fill (#6E49E6) that keeps white text at 5.6:1, and a light "violet text" (#A99BFA) for links, selected labels and rules on dark surfaces (8:1). Mixing them up is the main token error to avoid: never put white text on `--os-violet-text`, never use `--os-violet` as text on dark. Surface steps are intentionally close (≈1.05:1 apart): **structure comes from borders and spacing, not fills.**

## 7. Typography
Inter 400/500/600 only. Nine roles: Display (clamp 40–64/1.05, −0.03em) · Page title (28/34; 24/30 operator) · Section title (20/28) · Card title (16/24) · Body (density-driven) · Small body (13/20) · Label (12/16) · System/mono (11/16, uppercase, +0.08em) · Metadata (12/16). A tenth, "readout", is mono 13/20 tabular for numbers. Mono = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`: no font file added. Inter itself is already in the public site and `next/font` (Sessions); the future work is loading it once, globally, `display: swap`, weights 400/500/600 subset latin (see Train A). Press Start 2P: no role.

## 8. Colour
Neutrals = structure; violet = identity/selected/interactive emphasis; green = confirmed; amber = warning/waiting; red = destructive/critical/REC; cyan/blue = informational only when it distinguishes something no other colour can (today's operator uses cyan 464× and violet ≈490×, so cyan is demoted to neutral or violet in most places). Proportions per typical screen: ≈92% neutral, ≈6% violet, ≈2% semantic (operator War Room up to ≈4–5% semantic; public and client ≤1%). **Dark-first, not dark-only:** the token layer is written so `--os-*` can be re-pointed by a `[data-theme="light"]` block; a docs-only light sketch was checked (text #16161A on #FAFAF9 = 17.3:1, violet text #5B3FD6 = 6.4:1). Recommendation: keep the possibility open for public and client (print/PDF, bright rooms), do **not** build light mode for operator. Not implemented.

**Measured contrast (WCAG 2.x):** text 18.1 on bg; text-2 7.8; text-3 #8C8C96 6.0 on bg / 5.0 on surface-3; violet-text 8.3; focus ring 10.0; success 10.1, warning 10.2, danger 6.5, info 9.0, REC 6.2 (pill text on 14% tints ≥5.3). The styleboard ran a full-page automated audit: every text/background pair passes AA except the intentionally disabled button (exempt). **AA risks to remember:** zinc-500 (#71717A) fails on surfaces 2–3 (4.1 / 3.4) and is used **661×** (zinc-600 388×) across the app; violet-400/500 text on dark and the white-on-`#8B7CF6` button (3.3) fail.

## 9. Geometry
One language: hairline 1px borders, orthogonal alignment, small radii, generous alignment discipline. 4 badges/chips · 8 controls/nav · 12 cards/panels · 16 modals and public/client cards. Shadows only on overlays. No glassmorphism, no bubble radii, no blurred glows, no drop-shadow "3D" buttons, no gradient fills (one exception: the CTA panel's faint violet tint).

## 10. Iconography
One family: 16px, 1.5px stroke, round caps/joins, `currentColor`, inline SVG symbols (no icon-font, no dependency; the styleboard defines 10). Emoji leave chrome and navigation; emoji may remain inside user-authored content. Three current systems (emoji ≈216 matches, `PixelIcon` 16 glyphs, public raster sprites) collapse into one. **Future replacement map (not applied):** War Room 💎→radar/crosshair · Dashboard ⬛→grid · Productivity 🎬→film · Projects 📁→folder · LET'S COOK 🔥→flame (kept as the one metaphor-bearing icon) · Sessions 📜→list/clock · Equipment 🧰→toolbox · CRM 👥→users · Pricing Lab 🧪→flask · Finance 💰→coin · Subscriptions 🔁→repeat · Contracts 🧾→document · Health 🫀→heart-pulse.

## 11. OS signature motifs (5)
1. **System label** — mono uppercase 11px header on panels. Allowed: operator (everywhere), client (rare: one per page at most), public (section eyebrows). Forbidden: as body copy or on buttons.
2. **Evidence chip** — `SOURCE FACT` (solid hairline) / `DERIVED` (dashed hairline). Allowed: operator and any read-only evidence readout. Forbidden: public, client (they see plain words), decoration.
3. **Corner marker** — 8px hairline corner ticks on system panels (successor to `.pixel-frame`'s 12px brackets). Allowed: operator system panels only, max one per view region. Forbidden: cards, client, public.
4. **Timecode / readout numerals** — tabular mono for durations, hours, money. Allowed: everywhere numbers are compared; public frames may show a decorative timecode caption over real footage.
5. **State ring** — a slow outward ring on live/REC dots. Allowed: only while state is true (Sensor live, REC). Forbidden: as ambient decoration (replaces `wr-*` idle loops).
Heritage: one tiny pixel glyph may survive in the operator About/footer. Nothing else pixel.

## 12. Component recipes (23 = the 22 requested + Choice card)
Common rules: hairline borders, 1px; hover changes border/background only, never layout; focus = 2px `--os-focus` ring, 2px offset; every transition ≤ 240ms via tokens; all recipes are correct with motion removed. Colour columns use tokens above.

| Recipe | Role / density | Colour | Hover · press · focus | Motion | Where |
|---|---|---|---|---|---|
| Primary button | the one action; h48/44/32 | violet fill, white text | violet-hover · scale .98 · ring | 120 colour, 120 press | all; one per view |
| Secondary button | supporting | s2 + strong border | border→control · .98 · ring | 120 | all |
| Ghost button | tertiary/toolbars | transparent, text-2 | s2 bg · .98 · ring | 120 | operator, cards |
| Destructive button | irreversible | danger 14% tint, danger text, 35% border | tint 22% | 120 | operator, confirm modals; never public |
| Text input | typed field; h per density | s2, control border, text | border #85858F · focus border+halo | 120 | all |
| Textarea | long text; min 96 | as input | as input; resize vertical | 120 | all |
| Select | native select, styled | as input | as input | 120 | all (native for a11y) |
| Checkbox / radio | 18px control | control border; violet checked | as input | 120 | all |
| Card | grouped content | s2, hairline, r12/16 | border→strong (optional) | 180 | all |
| System panel | instrumented region | s1, hairline, corner marker optional | none | none | operator |
| Status pill | state word | tint + status text + dot | none | none | all (client: fewer states) |
| Metric / readout | number + mono label | text; semantic only for exceptions | none | tint flash on change (600) | operator, client (single number) |
| Table row | dense record | text; row hover 3% white | bg 120 | 120 | operator, client (simple lists) |
| Empty state | says what the space is for | dashed hairline, text-2 | none | none | all; no illustration |
| Modal | blocking decision | s3, strong border, r16, overlay shadow | — | 240 rise 8px + backdrop fade; exit 140 | all; native `<dialog>` |
| Drawer / panel | side context, operator | s3 or s1 | — | 240 slide 24px→0 (opacity too); exit 140 | operator (Sessions inspector, editor) |
| Tabs | switch views in place | segmented s1 track, s3 thumb | text→text | thumb slide 180 | operator, client |
| Disclosure | reveal detail | s1, hairline, chevron | — | 180 height (progressive enhancement) | public FAQ, client, operator |
| Tooltip | short label | s3, strong border | — | 120 fade + 4px | operator; never sole info carrier |
| Breadcrumb | origin path | mono uppercase, text-3, `here`=text | link underline | none | operator, client (light) |
| Nav item | sidebar destination | text-2; hover s2; current = violet tint + 2px violet-text rule | 120 | 120 | operator (client: top bar only) |
| CTA panel | closing prompt | s1 + faint violet tint, violet-text border 28% | button rules | none | public, client |
| Choice card | one option in guided intake | s2; selected = violet tint, violet-text border, filled radio | border→strong | 120 | lead path, intake |
The styleboard renders 22 of 23; the **drawer** is specified here but not drawn (it needs page context).

## 13. Motion system
Evidence: current motion is 220ms stage-enter, 160ms War Room panel-enter, plus four ambient loops (lamp flicker, editor pulse, ticket pulse, live ring) guarded by four reduced-motion blocks; modals have no motion. Decision: **instant 120ms** (hover/press/focus colour) · **standard 180ms** (tabs, disclosure, card border) · **panel 240ms** (modal/drawer; exit 140) · easing `cubic-bezier(.2,0,0,1)` for enters, `(.4,0,1,1)` for exits · max translate 8px (menus 4, drawer 24 with opacity) · opacity 0→1 · press scale .98. Confirmations: a 600ms violet-tint fade on a just-saved row. No animation library; no bounce, idle bob, flicker, parallax, scroll-jacking or sprite animation. **Reduced motion:** tokens collapse to ~0ms and lift to 0 (verified on the board by both the OS setting and a toggle: durations went 240ms→0.01ms, ring animation none). Nothing functional depends on animation.
**Top 5 microinteractions (impact / effort / reuse):** 1 button press + focus ring (H/L/H) · 2 saved-row tint (H/L/H) · 3 modal/drawer rise + backdrop (M/L/H) · 4 tab thumb slide (M/L/M) · 5 choice select (M/L/M; lead path only).

## 14. Accessibility and performance rules
**A11y:** AA everywhere (7:1 preferred for body on public); text-3 is the lowest legal text colour; focus ring on all interactives, never `outline: none` without replacement; touch targets ≥44px on public/client, ≥32px with 8px spacing on operator (operator is desktop-first; Sensor/mobile capture keeps 44); full keyboard operation incl. dialog Esc/tab trap (native dialog) and radiogroup arrow keys for choice cards (styleboard demo is click-only: a Train B item); colour never the only signal (pill = colour + word + dot); reduced-motion rule above; `prefers-contrast` not handled yet (Train E option).
**Performance:** no animation frameworks, video backgrounds, canvas/WebGL or heavy fonts; CSS only; Inter via one self-hosted/`next/font` load (400/500/600, latin, swap) replacing the public site's render-blocking Google `@import` of two families; poster frames + lazy media for real footage (`preload="none"`, `loading="lazy"`, explicit aspect-ratio boxes to avoid CLS); retire the raster sprite set from the public LCP path.

## 15. Public shell (placeholder architecture, not locked)
Top bar (mark, 3 links, one primary CTA) → hero (statement + support + primary CTA + secondary "watch") → **real work strip** (3 frames, timecode captions) → proof (number + name, placeholders) → service entry → process (send / edit / review / deliver) → client-specific path or intake → final CTA panel → footer. Density PUBLIC. Content leads: no decorative art beyond real frames. Real-work-as-hero placeholder strategy until 6–10 frames are chosen: 16:9 and 9:16 neutral frames with an off-white grid texture and a timecode caption (the board's `.frame`), replaced one-for-one with poster stills; motion (short muted clips) only after posters exist and pass a weight budget.

## 16. Lead-path shell (public → intake → booking → portal)
Visual continuity only: the same top bar and mark, same CTA colour and size, the same focus ring and choice-card grammar; the step header uses the system label ("STEP 1 OF 3") and a 2px progress rule; after booking the page adopts CLIENT density with the `| CLIENT PORTAL` qualifier so the handoff feels like the same house. No intake logic, schema or recommendation is redesigned here.

## 17. Guided-intake visual grammar
Choice card = plain title (500 15px) + one-line description (13px text-2); selected = violet tint, violet-text border, filled radio; disabled = text-disabled with no border change; error = danger text under the group, not red cards. Progress = a 2px hairline with a violet-text fill (motion 240ms, none if reduced). Explanatory text sits above the choices in small body. It must not resemble an insurance form (no dense multi-column field grids), a personality quiz (no icons/emojis per option, no "which are you"), character creation (no avatars/classes/stats) or a SaaS onboarding wizard (no checklist gamification, no confetti). No scoring, no recommendation, no lead schema changes.

## 18. Client shell
Quiet top bar (mark + `CLIENT PORTAL` + a name); one column at 880; a page title and a single sentence of status; video rows as cards with a real thumbnail, plain state word (Your review / Delivered), and **one** primary action; supporting downloads as secondary. Language: no game metaphors, no emoji chrome, no internal terms (Vault, recipes, evidence, Sensor). Pixel absent. Operator-only material stays out (already pinned by tests; this spec adds nothing client-visible).

## 19. Operator shell
Sidebar 220 (grouped: Now / Production / Business) with stroke icons and a violet-tint current item; top of page = breadcrumb (mono) + page title + a live-state dot; readout row of 3–5 numbers; the working table with mono headers, `SOURCE FACT`/`DERIVED` chips and tabular numerals. Applies to War Room, Production Orders, Sensor, CRM, Finance. Normalise the accent hierarchy (violet identity, neutral otherwise; cyan demoted), one panel chrome (system panel + optional corner marker), one icon set, the nine-role type scale, the spacing scale, and the motion tokens.

## 20. Visual debt map (18 items; detail in the migration map)
PUBLIC TRUST: P1 Press Start headings · P2 RPG vocabulary (Lobby/HUD/XP/classes) · P3 sprite art + idle-bob loops · P4 render-blocking font import. CLIENT TRUST: C1 Vault page (pixel + font-black + "The Vault" title) · C2 client dashboard pixel/font-black · C3 gateway `/g/[token]` remains of pixel. OPERATOR CLARITY: O1 emoji navigation · O2 three icon systems · O3 zinc-500/600 muted text AA (1,049 uses) · O4 `font-black` overuse (projects, productivity, editor) · O5 cyan-heavy accent (464×). BRAND INCONSISTENCY: B1 red as public brand primary · B2 Tibia window CSS · B3 stale metadata description. MOTION/POLISH: M1 War Room ambient loops · M2 modals with no motion · M3 body 32px grid background. LOW PRIORITY: L1 `ExecutionQueueSection` and Project cover pixel remnants.

## 21. Page-finalization checklist (13, per page)
1 Uses tokens only (no raw hex) · 2 Nine type roles, weights ≤600 (no `font-black`) · 3 One primary action · 4 Muted text ≥ text-3 · 5 Icons from the one family; no emoji chrome · 6 Density set on the shell · 7 Panels use the shared recipes · 8 Status pills = colour + word + dot · 9 Focus visible on every interactive · 10 Touch targets per density · 11 Motion from tokens; reduced-motion verified · 12 No pixel/sprite/RPG vocabulary (operator heritage aside) · 13 Screenshot compared at mobile and desktop widths.

## 22. Future release trains (not started; none automatic)
**A — Design foundation.** Files: `src/app/globals.css` (add `--os-*` + density; keep old classes), one shared font load (root `layout.tsx`), new `src/components/ui/os/*` (Button, Input, Pill, Card, Panel, Icon). Token layers: base tokens + density. Shared components: the new set, unused at first. Risk: LOW (additive). Runtime: operator + client bundles gain CSS only. Visual-regression QA: yes (baseline capture only). Tailwind v4 `@theme` remap of zinc/cyan is deferred to D because it shifts ~5,400 utilities at once.
**B — Public + lead path.** Files: `rmedia-public-site` CSS/HTML (separate repo/Worker), `quoteavideo/*`, `book/*` in operator. Layers: public density, intake grammar. Components: nav, hero, CTA panel, choice card, frame. Risk: MEDIUM (brand-visible; separate deploy). Runtime: public Worker + operator gateway routes. QA: yes, including LCP/CLS and the form path.
**C — Client portal.** Files: `src/app/client/*`, `src/app/g/[token]/*` (client build). Layers: client density. Components: card, pill, button, thumbnail. Risk: MEDIUM (client trust; client Worker deploy). QA: yes; re-run "operator-only never in client" tests.
**D — Operator normalization.** Files: `Sidebar.tsx`, `PixelVisuals.tsx`, `globals.css`, `projects/*`, `productivity/*`, `war-room/*`, tables. Layers: operator density + `@theme` remap of the muted greys/cyan. Components: nav item, panel, table row, readout. Risk: HIGH (~5,400 utilities; wide surface). Runtime: operator. QA: yes, per page.
**E — Motion / finalization.** Files: modals/drawers, `wr-*` removal, saved-row tint, focus/contrast sweep, `prefers-contrast`. Risk: LOW-MEDIUM. QA: yes (motion + a11y).

## 23. File-level implementation map
See the migration map §3 (Train A–E by file). Summary: globals.css (31 pixel/OS matches), `PixelVisuals.tsx` (14), `client/[token]/page.tsx` (13 + 16 `font-black`), `projects/page.tsx` (10 + 12), `productivity/ExecutionQueueSection.tsx` (6), `client/dashboard/page.tsx` (5 + 12), `NowFocusPanel.tsx` (4), `app/page.tsx` (4), War Room (6), `Sidebar.tsx`, modals (`VideoEditor`, `SessionInspectorPanel`, `QuickCaptureModal`); public: `typography.css`, `variables.css`, `windows.css`, `animations.css`, `index/onboarding/about/hello-world.html`, `assets/img/*`.

## 24. Decisions still requiring Emmanuel (5)
1. **Violet value** — approve fill `#6E49E6` (white text AA) with `#A99BFA` as text/rule violet, or nominate a different hue family.
2. **Light theme** — keep the token door open for public/client only (recommended), or dark-only for everything.
3. **Real work frames** — which 6–10 pieces (and at what permission level) become hero material; until then the placeholder strategy stands.
4. **Public site launch order** — whether Train B ships before or after the first real PDBM lead is observed (it touches the same entry path).
5. **Operator emoji** — whether emoji may remain inside user-authored content and Quick Notes (recommended yes) or be stripped everywhere.
