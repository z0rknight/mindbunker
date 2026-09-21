# RMEDIA OS — Visual Migration Map (2026-09-20)

Companion to `RMEDIA_OS_VISUAL_FOUNDATION_SPEC_2026_09.md`. The original legacy map remains historical. **Current Sep 20–21 authority:** Public + MindBunker brand emphasis is YouTube Red `#FF0000`; the prior violet target is superseded. Home and `/book` have finite entrance motion; `/book` has deterministic Home navigation; Client remains outside the recolour. Counts below describe the earlier archaeology, not current source.

## 1. Legacy → future map
| Legacy (current source) | Where | Future | Train |
|---|---|---|---|
| Press Start 2P heading / label | public `assets/css/typography.css`, `--font-pixel`; operator `productivity/sessions/fonts.ts` (`pixelFont`) | Inter 600 heading; mono 11px uppercase label | B, D |
| Google `@import` of Inter + Press Start 2P (render-blocking) | public `typography.css` | one Inter load (400/500/600, latin, swap), self-hosted or `next/font`; no Press Start | B |
| Historical red brand primary | public shell and CTAs | **CURRENT: YouTube Red `#FF0000` retained/restored as Public + MindBunker identity; semantic danger also requires copy/context** | Night closure |
| Green/gold/diamond "rarity" palette (`#00FF41`, `#FFD700`, `#00E5FF`) | public `variables.css` | semantic success/warning/info tokens, used rarely | B |
| Tibia-style window chrome | public `windows.css` | card/panel recipes, hairline 1px | B |
| Lobby / PLAYER HUD / XP bar / class cards / avatar slots / debuffs / skill tree / "skip tutorial" | public `index/onboarding.html` | neutral navigation ("Work", "Process", "Start a project"); system/status language; choice cards. Copy is not rewritten here | B |
| Sprite / raster art illustrations | public `assets/img/*` | real-work frames with timecode captions; neutral frame placeholders until chosen | B |
| Idle-bob `retroFloat` with `steps()` | public `animations.css` | none (state-driven motion only) | B/E |
| Pixel inventory border (`.pixel-frame` 12px corner brackets) | `src/app/globals.css` | OS panel border: hairline + optional 8px corner marker | A/D |
| `.pixel-badge`, `.pixel-divider`, `.pixel-progress`, `.pixel-empty-state` | `globals.css`, `PixelVisuals.tsx` | status pill, 1px rule, 2px progress, dashed-hairline empty state | A/D |
| `.mb-pixel-logo` | `globals.css` | RM monogram tile + RMEDIA wordmark lockup | A |
| `PixelIcon` (16 inline SVG glyphs) | `src/components/ui/PixelVisuals.tsx` | 16px/1.5px stroke icon set | A/D |
| Emoji action/nav icons (≈216 matches) | `Sidebar.tsx` (13 nav items), pages, buttons | stroke icon + label + status (map in spec §10) | D |
| "The Vault" title / language | `src/app/client/[token]/page.tsx`, portal copy | "RMEDIA Client Portal" (visual and title; copy per Emmanuel) | C |
| `font-black` headings | 16 in `projects/[id]/page.tsx`, 16 in `client/[token]/page.tsx`, 14 in `productivity/page.tsx`, 14 in `VideoEditor.tsx`, 12 in `projects/page.tsx`, 12 in `client/dashboard/page.tsx` | weight 600 at the correct role | C/D |
| `text-zinc-500` (661) / `text-zinc-600` (388) muted text | app-wide | `--os-text-3 #8C8C96` (AA); zinc-600 only for disabled | A/D |
| Historical cyan/violet competing accents | app-wide | **CURRENT: operator brand aliases converge to red; semantic green/amber/unknown/derived remain independent; Client resets its prior palette** | Night closure |
| War Room ambient loops (`wr-lamp-flicker`, `wr-editor-pulse`, `wr-ticket-pulse`) | `globals.css`, `WarRoomRestaurantStage.tsx` | static state; a 2.4s ring only on genuinely live dots | E |
| `wr-panel-enter` 160ms / `mb-stage-enter` 220ms | `globals.css` | 240ms panel-rise with tokens (or kept if equal) | E |
| Body 32px hairline grid background | `globals.css` `body` | optional: keep on operator only, drop for public/client | A/D |
| Modals without enter/exit | `VideoEditor.tsx`, `SessionInspectorPanel.tsx`, `QuickCaptureModal.tsx` | 240ms rise + backdrop fade; 140ms exit | E |
| System font stack only | `layout.tsx` body | Inter globally; system fallback | A |
| Metadata description "Personal tracking dashboard…" | `layout.tsx` | corrected description (copy is Emmanuel's) | flag only |

## 2. Visual debt map (18 items)
| # | Class | Surface | File(s) | Problem | Future treatment |
|---|---|---|---|---|---|
| 1 | PUBLIC TRUST | Public | `typography.css` | Pixel headings read as a game, not a credible editor | Inter headings (B) |
| 2 | PUBLIC TRUST | Public | `index/onboarding.html` | RPG vocabulary in navigation and intake (Lobby, HUD, XP, classes, skip tutorial) | neutral nav + choice cards; copy decision is separate (B) |
| 3 | PUBLIC TRUST | Public | `assets/img/*`, `animations.css` | Sprite art and idle-bob loops occupy the hero slots real work should hold | real-work frames (B) |
| 4 | PUBLIC TRUST | Public | `typography.css` | Render-blocking Google `@import` of two families | single Inter load (B) |
| 5 | CLIENT TRUST | Client | `client/[token]/page.tsx` | 13 pixel matches, 16 `font-black`, title "The Vault" | client density, Portal name (C) |
| 6 | CLIENT TRUST | Client | `client/dashboard/page.tsx` | 5 pixel matches, 12 `font-black` | client density (C) |
| 7 | CLIENT TRUST | Client/lead | `g/[token]/*`, `quoteavideo/*`, `book/*` | small pixel/font-black remnants (9/5/3/2 matches) in the gateway and forms | intake grammar (B/C) |
| 8 | BRAND AUTHORITY | Public | shared public tokens | **CLOSED: red brand; destructive intent is never colour-only** | Night closure |
| 9 | BRAND INCONSISTENCY | Public | `windows.css` | Tibia window chrome | panel/card recipes (B) |
| 10 | BRAND INCONSISTENCY | Operator | `layout.tsx` | stale metadata description; no global Inter | metadata (flag) + font (A) |
| 11 | OPERATOR CLARITY | Operator | `Sidebar.tsx` | emoji nav icons (13) | icon family (D) |
| 12 | OPERATOR CLARITY | Operator | `PixelVisuals.tsx` + emoji + sprites | three icon systems | one family (A/D) |
| 13 | OPERATOR CLARITY | Operator | app-wide | zinc-500/600 text fails AA (1,049 uses) | `--os-text-3` remap (A/D) |
| 14 | OPERATOR CLARITY | Operator | `projects/*`, `productivity/*`, `VideoEditor.tsx` | `font-black` overuse flattens hierarchy | 600 at roles (D) |
| 15 | OPERATOR CLARITY | Operator | app-wide | cyan/violet competed for brand emphasis | **CLOSED through operator-scoped red aliases; semantic tokens preserved** |
| 16 | MOTION/POLISH | Operator | `globals.css`, `WarRoomRestaurantStage.tsx` | ambient flicker/pulse loops signal nothing | state-only ring (E) |
| 17 | MOTION/POLISH | Operator | `VideoEditor`, `SessionInspectorPanel`, `QuickCaptureModal` | modals appear instantly | 240/140ms rise (E) |
| 18 | LOW PRIORITY | Operator | `ExecutionQueueSection.tsx` (6), `projects/page.tsx` (10), `ProjectCover.tsx`, `NowFocusPanel.tsx` (4), `app/page.tsx` (4) | pixel remnants | fold into D when the page is touched |

## 3. File-level implementation map by train
**A — Design foundation** (additive, low risk): `src/app/globals.css` (append `--os-*` + density; leave old classes); `src/app/layout.tsx` (single Inter load); new `src/components/ui/os/{Button,Input,Pill,Card,Panel,Icon,Tabs,Modal}.tsx`; `src/components/ui/PixelVisuals.tsx` (deprecate, do not delete). Does **not** change any visible page.
**B — Public + lead path**: `rmedia-public-site/public/{index,about,onboarding,hello-world}.html`, `assets/css/{variables,typography,components,windows,layout,animations,responsive}.css`, `assets/img/*`; operator gateway `src/app/quoteavideo/*`, `src/app/book/*`. Separate public Worker deploy; operator deploy only for the two gateway routes.
**C — Client portal**: `src/app/client/{layout.tsx,page.tsx,login,dashboard,[token]}`, `src/app/g/[token]/*`; client build + `deploy:client`; re-run the "nothing operator-only under client/g" tests.
**D — Operator normalization**: `Sidebar.tsx`, `AppShell.tsx`, `war-room/**`, `productivity/**`, `projects/**`, `page.tsx`, `NowFocusPanel.tsx`, table components, and (last) the `@theme` remap that re-points zinc/cyan to tokens. Page by page, never big-bang.
**E — Motion / finalization**: modals/drawers, remove `wr-*` ambient loops, saved-row tint, focus/contrast sweep, optional `prefers-contrast`.

## 4. Order and rollback
A first (invisible), then C or B (decision 4 in the spec), D per page, E last. Every train is independently revertable because A only adds; B/C/D/E each swap a surface and can be reverted by the previous release/worker version. None of them changes data or D1.

## 5. What this wave deliberately did not do
No product-file edit, no import/route, no deploy, no D1 access, no copy rewrite, no logo system, no font download, no emoji replacement, no light-mode implementation, no visual regression run.

## 6. Closure status (final visual convergence, 2026-09-20)
| # | Item | Status |
|---|---|---|
| 1–4 (public) | Press Start headings, RPG vocabulary, sprite art, render-blocking font import | CLOSED (public brand convergence, public `6496f6a`) |
| 3 (motion) | Sprite idle-bob / lift | CLOSED (removed) |
| 5–7 (client) | Vault title/language, pixel frames/badges, gateway remnants | CLOSED for `/client/*` (title + CSS neutralisation); `/g/*` unchanged |
| 8–9 (public brand) | historical brand conflict, Tibia windows | CLOSED (YouTube Red/neutral, single stylesheet) |
| 10 | stale metadata description | DEFERRED (copy is the owner's) |
| 11–12 | emoji nav icons, three icon systems | DEFERRED |
| 13 | muted text AA (zinc-500) | CLOSED (`@theme` value) |
| 14 | `font-black` overuse | DEFERRED |
| 15 | cyan vs violet brand accent | CLOSED for Operator brand emphasis (red aliases; semantic colours preserved) |
| 16 | ambient War Room loops | CLOSED |
| 17 | instant dialogs | PARTIAL (entrance added; exit deferred) |
| 18 | pixel remnants (operator) | DEFERRED (heritage traces stay; none is structural or animated) |
`/start` changed accent tokens only to red for Home→intake continuity. Its decision model, questions, branches, answer envelope, API and persistence contract are unchanged.
