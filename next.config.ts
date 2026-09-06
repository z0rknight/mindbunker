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
  env: {
    MB_DEPLOY_TARGET,
  },
};

export default nextConfig;
