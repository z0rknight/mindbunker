import { NextResponse, type NextRequest } from "next/server";

// Release config (Sep 2026 separate-Worker release) -----------------------
//
// The public Client Worker deployment (process.env.MB_DEPLOY_TARGET ===
// "client", inlined at build time by next.config.ts -- see the comment
// there) runs the exact same compiled Next app as the private MindBunker
// operator Worker: OpenNext bundles every route under src/app/** into one
// build regardless of which Worker it later gets deployed to, and there
// is no per-route "exclude from this target" mechanism, so this is not a
// code duplication problem to solve, it's an access-control one.
//
// Cloudflare's route table (emmanueldarosa.com/client*) only protects the
// canonical domain -- it says nothing about this Worker's own
// *.workers.dev endpoint, which accepts a request for ANY path directly.
// That endpoint is the actual boundary this middleware exists for: on the
// client deployment, any request whose path isn't the Client Portal
// itself (or a Next-internal asset required to render it) is rejected
// HERE, before any operator route handler, data loader, or auth check
// ever executes -- not merely hidden from navigation/links.
//
// On the private operator Worker (the default/unset case) this function
// is a no-op passthrough -- existing operator routing/auth is untouched.
// Because MB_DEPLOY_TARGET is a build-time-inlined literal rather than a
// runtime lookup, the operator build's middleware bundle should reduce to
// this passthrough with no per-request branching cost.

const IS_CLIENT_DEPLOY_TARGET = process.env.MB_DEPLOY_TARGET === "client";

const ALLOWED_EXACT = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
]);

function isAllowedOnClientWorker(pathname: string): boolean {
  // PIPELINE FIX ROUND 2 (live blank-body rescue): cover images now
  // resolve under /client/media/... (see toClientWorkerCoverUrl in
  // src/modules/media/core.ts, and STATIC_BASE_PATH in auth-core.ts) --
  // already covered by the /client/ prefix check below, same as every
  // other client-portal path and the relocated /client/_next/static/*
  // build assets (see next.config.ts's assetPrefix and
  // scripts/prepare-client-assets.mjs). The previous separate bare
  // "/media/" allowance is removed: it was never reachable in production
  // (emmanueldarosa.com/client* is the only route forwarded to this
  // Worker, so a bare /media/... request never arrived here anyway) and
  // on workers.dev it was needless extra surface now that the real path
  // shape lives entirely under /client/.
  if (pathname === "/client" || pathname.startsWith("/client/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  return ALLOWED_EXACT.has(pathname);
}

export function middleware(request: NextRequest) {
  if (!IS_CLIENT_DEPLOY_TARGET) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isAllowedOnClientWorker(pathname)) {
    return NextResponse.next();
  }

  // Deliberately a bare 404 with no body content beyond this string --
  // never the app's own not-found/error boundary (which could render
  // operator-branded chrome) and never a redirect (which would have to
  // point somewhere, potentially leaking a route name back to the caller).
  return new NextResponse("Not found", { status: 404 });
}

// Exclude Next's own static asset/image optimizer paths from running
// middleware at all (pure performance -- they're already covered by the
// isAllowedOnClientWorker "/_next/" check above as defense in depth for
// any /_next/* subpath this matcher doesn't happen to exclude).
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
