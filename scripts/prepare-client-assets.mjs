#!/usr/bin/env node
// scripts/prepare-client-assets.mjs
//
// Client-target build only -- never run for the operator build.
//
// Why this exists (PIPELINE FIX ROUND 2, live blank-body rescue):
// emmanueldarosa.com/client* is the ONLY Cloudflare route forwarded to the
// dedicated public Client Worker (white-wave-1af9) -- already verified
// live, must never be broadened or recreated. next.config.ts's assetPrefix
// and auth-core.ts's STATIC_BASE_PATH (both "/client" on this target) make
// Next bake /client/-prefixed URLs into the HTML/RSC output for its own
// _next/static/* build assets and this app's own asset references (login
// logo, cover images). But OpenNext's Cloudflare adapter has no
// assetPrefix awareness at all (confirmed by reading its build source --
// there is no config surface for this) -- it writes the actual static
// files to .open-next/assets/_next/... and .open-next/assets/<file>,
// unprefixed, regardless of assetPrefix. Cloudflare's Assets binding
// serves a request only if a file exists at that exact path inside the
// configured assets directory. Without this step, the /client/-prefixed
// URLs the browser requests would still find nothing there.
//
// This script physically relocates the built client-target assets to
// live under .open-next/assets/client/..., so a real file exists at the
// path the relocated URLs (and the Cloudflare route) actually point to.
// Run after `opennextjs-cloudflare build`, before `opennextjs-cloudflare
// deploy` -- see package.json's deploy:client script.
import { existsSync, mkdirSync, renameSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const assetsDir = path.resolve(".open-next/assets");
const clientDir = path.join(assetsDir, "client");

if (!existsSync(assetsDir)) {
  console.error(`prepare-client-assets: ${assetsDir} not found -- did opennextjs-cloudflare build run first?`);
  process.exit(1);
}

mkdirSync(clientDir, { recursive: true });

// Next's own build output, referenced via assetPrefix "/client" (JS
// chunks, CSS, and anything else Next emits under _next/static/*).
const nextSrc = path.join(assetsDir, "_next");
const nextDest = path.join(clientDir, "_next");
if (existsSync(nextSrc)) {
  renameSync(nextSrc, nextDest);
  console.log("prepare-client-assets: moved _next -> client/_next");
} else {
  console.warn("prepare-client-assets: .open-next/assets/_next not found -- nothing to move (unexpected)");
}

// public/-folder files this app references explicitly via STATIC_BASE_PATH
// ("/client" on this target) -- currently just the login logo. Copied
// (not moved) since the bare-path copy is harmless dead weight, not a
// leak: these are static, unauthenticated, non-sensitive brand assets.
for (const file of ["rmedia-client-logo.svg"]) {
  const src = path.join(assetsDir, file);
  if (existsSync(src)) {
    copyFileSync(src, path.join(clientDir, file));
    console.log(`prepare-client-assets: copied ${file} -> client/${file}`);
  }
}

// _headers' path rules need to follow _next under client/, or the
// immutable long-lived Cache-Control it sets stops applying post-move.
const headersPath = path.join(assetsDir, "_headers");
if (existsSync(headersPath)) {
  const original = readFileSync(headersPath, "utf8");
  const updated = original.replaceAll("/_next/static/*", "/client/_next/static/*");
  writeFileSync(headersPath, updated);
  console.log("prepare-client-assets: rewrote _headers for /client/_next/static/*");
}

console.log("prepare-client-assets: done.");
