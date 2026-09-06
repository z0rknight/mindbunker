import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

// Release config (Sep 2026 separate-Worker release): this repo now builds
// to TWO deployment targets from the same source tree -- the private
// MindBunker operator Worker (default, unchanged) and a dedicated public
// Client Worker whose canonical URL must be bare /client, not
// /mindbunker/client. Next's basePath is a single global build-time
// setting, so producing the second target requires a second `next build`
// invocation with DEPLOY_TARGET=client set in the shell environment (see
// package.json's "build:client" script) -- not a runtime switch. Every
// other route (src/app/client/** already uses plain "/client/..." literal
// paths with no APP_BASE_PATH concatenation) needs no change: with
// basePath "" those literals resolve exactly as written.
// process.env.DEPLOY_TARGET is only ever read here, at build time, from
// the shell environment the build command runs in (see package.json's
// "build:client"/"deploy:client" scripts) -- it is NOT read anywhere else
// in the app directly, because a Cloudflare Worker's runtime process.env
// is not guaranteed to reflect the shell env a `next build` happened to
// run under. Instead this next.config.ts's `env` option (a real Next.js
// build-time mechanism, distinct from the NEXT_PUBLIC_ convention) bakes
// the resolved target into `process.env.MB_DEPLOY_TARGET` as a literal
// string, statically inlined into the compiled output everywhere
// (middleware, server components, client components alike) -- that is
// the value every other file in this release should read.
const MB_DEPLOY_TARGET = process.env.DEPLOY_TARGET === "client" ? "client" : "operator";

const nextConfig: NextConfig = {
  basePath: MB_DEPLOY_TARGET === "client" ? "" : "/mindbunker",
  // PIPELINE FIX ROUND 2 (live blank-body rescue): emmanueldarosa.com/client*
  // is the ONLY Cloudflare route forwarded to this Worker (verified live,
  // must never be broadened). basePath stays "" here on purpose -- flipping
  // it to "/client" would double-prefix every already-literal "/client/..."
  // route under src/app/client/** and would require restructuring that
  // folder, which is a much bigger change than this defect calls for.
  // assetPrefix is the Next-native, narrower knob for exactly this problem:
  // it only changes the URLs Next bakes into HTML/RSC output for its own
  // _next/static/* build output, without touching page routing, redirects,
  // or the session cookie path. scripts/prepare-client-assets.mjs physically
  // relocates the built files after packaging so a real file exists at the
  // /client/_next/static/... path this now points at -- OpenNext's own
  // asset-compilation step has no assetPrefix awareness (confirmed by
  // reading its source; there is nothing to configure there), so without
  // that relocation step this alone would just move the 404 target.
  assetPrefix: MB_DEPLOY_TARGET === "client" ? "/client" : undefined,
  env: {
    MB_DEPLOY_TARGET,
  },
};

export default nextConfig;
