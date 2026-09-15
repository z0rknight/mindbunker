# RMEDIA Public Site — Source Recovery + Reality Patch
**Date:** 2026-09-15 · **Status: LIVE. Canonical source established for the first time.**

---

## 1. Original-Source Recovery Result

**NOT RECOVERABLE.** This time the search had real Cloudflare account access (the 21 Aug pass didn't), and it produced a conclusive answer instead of a suspicion:

- Queried the Workers **deployments** and **versions** history for `late-disk-3e57` (the script bound to the root domain) directly via the Cloudflare API. All 4 historical versions carry `"source": "dash"` and `"workers/triggered_by": "upload"` — every one was uploaded through the Cloudflare dashboard's drag-and-drop UI. None came from `wrangler deploy`, which is what a real local project would produce.
- There is no Cloudflare API to download a dashboard-uploaded static-assets bundle's original files beyond what's already live — recovering "the same bytes" that way would add nothing over fetching the live site directly.
- Bounded disk search (Cloudflare metadata inspection, zip/tar archive search across `~/Desktop`/`~/Documents`/`~/Downloads`, re-check of the one plausible candidate folder) found nothing. `Desktop/MBUK/Claude @ Mindbunker/Site-Mindbunker` was opened and confirmed to be an unrelated MindBunker cockpit prototype (`<title>MindBunker — Operational Telemetry</title>`), not the marketing site — same conclusion the 21 Aug pass reached, now doubly confirmed.

## 2. Reconstructed-Baseline Provenance

Built by fetching every public page and asset directly from `https://emmanueldarosa.com` on 2026-09-15 and committing the exact bytes as the starting baseline, **before any Reality Patch edits** — first commit `09396fa`. The provenance note lives in the new repo's `README.md` and in that commit's own message, so this is never confused with a recovered original later.

## 3. Canonical Repo/Path

| | |
|---|---|
| Path | `/Users/emmanueldarosadillenburg/Documents/New project/rmedia-public-site` (its own top-level repo, not inside any MindBunker folder) |
| Remote | none configured (local-only, matching every other repo on this Mac) |
| Branch | `main` (default, single branch) |
| Structure | `public/` holds everything served (`index.html`, `about.html`, `hello-world.html`, `onboarding.html`, `assets/`, `robots.txt`, `sitemap.xml`); `wrangler.jsonc`, `README.md`, `.gitignore` at repo root |
| Build command | none — static files, no build step |
| Deploy command | `npx wrangler deploy` |
| Deploy target | Worker script `late-disk-3e57` (unchanged name — keeps the existing Custom Domain binding) |
| Rollback | `npx wrangler rollback <version-id>` |

## 4. Baseline Validation

Served locally via `wrangler dev` immediately after the byte-for-byte commit, before any patch edit. Confirmed: identical `.html`→extensionless 307-redirect behavior already observed live, identical visible content (guaranteed by construction — the bytes are the same bytes production served). No missing sections or assets.

## 5. Deploy Architecture

Cloudflare Workers **Static Assets** deployment — `wrangler.jsonc` has no `main`/Worker code, only an `assets` binding pointing at `public/`. This matches what was already running (`late-disk-3e57` reported `has_assets: true`, zero module code). No framework introduced — plain HTML/CSS + a small amount of inline vanilla JS, exactly as before.

## 6. Rollback Path

| | |
|---|---|
| OLD PUBLIC VERSION | `01ebdb5b-a30f-40ce-8f16-5ce2e49ad334` (version 4, the version live before this wave) |
| **NEW VERSION** | **`d5304a2d-c472-4623-8b52-a86846dab514`** |

`npx wrangler rollback 01ebdb5b-a30f-40ce-8f16-5ce2e49ad334` (run from the `rmedia-public-site` repo) reverts the root site only — entirely independent of `mindbunker`, `white-wave-1af9`, and `rmedia-book`, which this wave never touched.

## 7. Copy Changes

- **Hero:** replaced "Throw me your files. I'll handle the timeline!" as the H1 with the mission's result-first direction (*Send the footage. Get a production system — not another editing bottleneck.*) — the original line is **preserved**, now as a small kicker line above the new headline, not deleted.
- **Work/Proof** (new section, placed second): an anonymized Content Waterfall case (Input → Problem → Decision → Output → Operational result), explicitly labeled as anonymized with no invented metrics — see §10 for why nothing more specific was published.
- **Services** relabeled commercial-first: Short-Form Production / Long-Form Editing / Content Waterfall as headlines, with Ninja/Tank/Knight demoted to a one-line flavor subtitle under each.
- Removed or rewrote every unsupported claim the copy matrix flagged: "Notion Command Center" → "private client workspace"; "Automated Asset Tracking" → "every approved asset indexed and linked to its production context"; "No searching, no friction, no dead links" → "less searching, fewer repeated questions"; "Build Once, Scale Infinitely" / "absolute consistency and lightning-fast" → "build the recipe once, reuse the decisions" / "a repeatable visual language and a faster second batch"; "100% approved before Sauce" → qualified per format; "production guild" / "centralized communication" → "one accountable operator" / "keep talking where you already talk."
- System Brief's file-delivery checklist: "Organized... through Notion" and "Secure cloud backup storage inside The Vault" (ambiguous portal/storage conflation) rewritten to name the private workspace and Drive/Dropbox honestly.
- Preserved verbatim: "Your job is to create. The infrastructure is my responsibility." (System Brief hero), the full Founder Notes essay (untouched), the Pasta Recipe method, the Gotcha Protocol.

## 8. Visual Changes

- `--border-pixel-width` 4px → 2px, `--shadow-pixel` softened from a hard `6px 6px 0 rgba(0,0,0,.9)` to `3px 3px 0 rgba(0,0,0,.55)` — both are root tokens every card/panel/button already referenced, so this alone visibly lightens the whole site.
- Headings (`h1`–`h6`) switched from uppercase Press Start 2P in RMEDIA red to Inter, white, sentence case — previously **every** heading and **every plain link** on the site forced the pixel font; this was the single largest contributor to the "pixel-art theme park" feeling. Press Start 2P is now reserved for small, deliberate accents: buttons, eyebrows/kickers (new `.pixel-label` utility), badges — matching "pixel accents in selected headings/actions," not the default.
- **Bug found and fixed:** `#player-hud nav` was still `position: absolute` at mobile widths — a pre-existing defect `about.html` and `hello-world.html` had each silently patched in their own page-local `<style>` block, but the shared `responsive.css` (which `index.html`/`onboarding.html` depend on) never got the fix. It only became visible this wave because the new utility-nav text ("Book a Call" / "Client Login") is longer than the old "NA | SA" and started visibly overlapping the primary nav. Fixed once, in the shared sheet, so it can't silently regress per-page again.

## 9. Navigation

Replaced the NA/SA "server selector" (a decorative region-picker whose SA link pointed at a `/br/` page that has never existed — see §13) with real **Book a Call** / **Client Login** utility links in the same header slot. Primary nav is now **Work · Services · About** across all four pages — no empty pages created; Work/Services are anchors on the existing homepage (`#proof`, `#services`), About reuses `about.html` unchanged. System Brief was audited per the mission's own bar ("does this help a buyer before they book") and demoted out of primary nav — still reachable from the footer on every page and from the homepage's Founder Notes bridge section, plus indexed in the sitemap.

## 10. Proof/Work

**PARTIAL.** No real portfolio assets, video files, or a public-safe link catalog were found anywhere on this Mac in a bounded search — the January portfolio-links note the Reality Check referenced lives in Notion, not in any local file this session could read. Rather than invent thumbnails or fabricate a testimonial, the Work/Proof section ships as an honest, anonymized **process** case (structured as Input → Problem → Decision → Output → Operational result, per the mission's own case-study rule), using the site's existing illustration assets, with an explicit on-page note that named client work is published only with permission. A full public case library remains future work — this is stated on the page itself, not hidden.

## 11. CTAs

- Primary: **See the Work** → `#proof`
- Secondary: **Book a 30-Minute Fit Call** → `https://emmanueldarosa.com/book` (the existing, unmodified `rmedia-book` Google Calendar Worker)
- Header/footer utility: **Book a Call** and **Client Login** (→ `https://emmanueldarosa.com/client`) on every page
- Service cards and the final CTA: **Get a quote** / **Start a Project Inquiry** → `https://emmanueldarosa.com/mindbunker/quoteavideo`

## 12. Lead-Path Wiring

**Reused, not duplicated — and one real duplicate was found and retired.** `onboarding.html`'s original form posted client-side to `formsubmit.co/ajax/talk@emmanueldarosa.com`, a third-party email relay that never touched MindBunker's CRM at all — an undocumented second lead pipeline sitting alongside the already-tested `/mindbunker/quoteavideo` intake from the prior wave. Per this mission's explicit instruction not to duplicate lead infrastructure, `onboarding.html` is now a short bridge page: its own copy, its own identity, but its one real action points straight at `/mindbunker/quoteavideo`. No new endpoint, no new form, no schema.

## 13. SEO/Routes

| Route | Status |
|---|---|
| `/` | Live, patched |
| `/about.html` (Founder Notes) | Live, unchanged content; **added to sitemap.xml** (confirmed live: fetched `/sitemap.xml` in production post-deploy and verified the new `<url>` entry is present) — closes the exact historical gap the Reality Check flagged |
| `/hello-world.html` (System Brief) | Live, demoted from primary nav, lightly trimmed |
| `/onboarding.html` | Live, now a bridge to `/mindbunker/quoteavideo` |
| `/book`, `/client`, `/mindbunker*` | Unaffected — verified before and after deploy |
| `br/index.html` and siblings | **Removed site-wide.** These links pointed at pages that have never existed (confirmed 404 again this wave) and were a decorative "server region" gimmick with no real Portuguese content behind it. Rather than build a redirect to nowhere or fabricate localized content, the dead links were deleted outright — an intentional decision, not an oversight. |
| `robots.txt` | Left byte-for-byte as captured — it carries a Cloudflare-managed content-signals block already correctly configured (allows search indexing, blocks AI-training crawlers); not a confirmed problem, so not touched, per "fix only current confirmed problems." |

## 14. Responsive QA

Checked 1440×900, 1180×820, 768×1024, and 375×812 on the homepage plus spot-checks of all three other pages. One real defect found and fixed (§8, mobile nav overlap). After the fix: no horizontal overflow at any width (`document.documentElement.scrollWidth === clientWidth` confirmed at 375px), offer readable without RPG decoding, proof section appears on the first scroll, Book/Client CTAs visible in the header at every width tested, all internal links resolve (`grep`-verified: zero dangling `formsubmit`/`skip-tutorial`/`server-selection`/`br/` references left anywhere in the four pages).

## 15. Public Deployment

| | |
|---|---|
| Pre-deploy version | `01ebdb5b-a30f-40ce-8f16-5ce2e49ad334` |
| **New version** | **`d5304a2d-c472-4623-8b52-a86846dab514`** |
| MindBunker Operator | not touched, not redeployed |
| Client Worker | not touched, not redeployed |
| `rmedia-book` Worker | not touched, not redeployed |

## 16. Route-Collision Smoke

Verified **before and after** deploy via the Cloudflare API directly (not guessed): the zone's 4 Routes (`/book`, `/book/*` → `rmedia-book`; `/client*` → `white-wave-1af9`; `/mindbunker*` → `mindbunker`) are path-scoped and unchanged; the root Custom Domain binding still points at `late-disk-3e57` by script name, which this deploy updated in place rather than rebinding. Live-checked after deploy: `/`, `/mindbunker`, `/client`, `/book` all still resolve to their correct respective apps.

## 17. Final Source SHA

| | |
|---|---|
| `rmedia-public-site` HEAD | `aa04b1e` |
| MindBunker `production/current` | unchanged this wave — `354ba94` (this mission never touched the MindBunker repo) |

## 18. Remaining Deferred Work

- **A real, named public case library** — this wave shipped one honest anonymized case; a fuller portfolio needs actual client-approved assets that weren't available locally this session.
- **Favicon** — the live site has never had one (`favicon.ico` 404s); out of scope for this patch, small enough to add later.
- **UTM capture** on the public intake forms — carried over from the prior wave's deferral, still unaddressed; `/mindbunker/quoteavideo` doesn't currently read query params to pre-fill or log campaign source.
- **System Brief** — demoted, not rewritten top-to-bottom; still reads more like internal documentation than buyer-facing copy in places. Left mostly intact this wave beyond the two false claims fixed.
- Nothing beyond this patch was started — no CMS, no case-study generator, no new framework, no analytics platform.

---

## Final Structured Output

```
ORIGINAL SOURCE: NOT RECOVERABLE

CANONICAL PUBLIC SOURCE: GREEN
RECOVERED BASELINE: GREEN

COPY: GREEN
VISUAL: GREEN
WORK / PROOF: PARTIAL (anonymized process case shipped; no real client assets were available)
BOOK CTA: GREEN
CLIENT LOGIN: GREEN
QUOTE INTAKE: GREEN
ROUTES: GREEN
SEO: GREEN
RESPONSIVE: GREEN

PUBLIC DEPLOY: d5304a2d-c472-4623-8b52-a86846dab514
MINDBUNKER DEPLOY: NONE
CLIENT DEPLOY: NONE
BOOK WORKER DEPLOY: NONE

ROUTE COLLISION: GREEN
ROLLBACK: NONE PERFORMED (rollback target recorded: 01ebdb5b-a30f-40ce-8f16-5ce2e49ad334)

PUBLIC SOURCE SHA: aa04b1e
```

**FINAL VERDICT:**

**GREEN — Public site source authority restored and Reality Patch live.** The root site now has what it never had before: a real, versioned, git-tracked repository with a documented, reproducible deploy and rollback path. The Reality Patch is live on top of that — result-first hero, an honest work/proof section, commercial-first service labels, real Book/Client CTAs, one retired duplicate lead pipeline, a fixed mobile nav bug, and meaningfully less pixel density — without adding a framework, without touching MindBunker, Client, or the booking Worker, and without any route collision.

STOP.
