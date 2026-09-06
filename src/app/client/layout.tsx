import type { Metadata } from "next";

// Public leak fix (release round, Sep 2026): the root layout's metadata
// (application-name "MindBunker", the operator PWA manifest at
// /mindbunker/manifest.webmanifest, the Apple PWA title "MindBunker") is
// written for the private operator app and is otherwise inherited by
// every route -- Next.js only overrides a metadata FIELD when a more
// specific segment's own metadata object actually contains that key
// (verified against node_modules/next/dist/lib/metadata/resolve-metadata.js:
// manifest/applicationName resolve as `metadata[key] ?? null`, so an
// explicit `null` here clears the inherited value rather than merging
// with it). This layout overrides exactly those three fields for every
// /client/* page so no "MindBunker" branding or /mindbunker path ever
// reaches a client's browser tab, PWA install prompt, or view-source.
//
// This does not wrap children in any additional markup or add a second
// <html>/<body> (a nested layout can't do that; only the root layout may)
// -- AppShell already renders /client/* routes bare with no operator
// Sidebar (see src/lib/route-classification.ts), so this file's only job
// is metadata.
//
// title/description are also set here as a SAFETY-NET DEFAULT, not just an
// override: src/app/client/page.tsx (the bare /client redirect route) has
// no metadata of its own, so without this it would inherit root layout's
// "RMEDIA MindBunker" title and internal "Personal tracking dashboard for
// life metrics and professional performance" description verbatim. Every
// other /client/* page already sets its own more specific title (e.g.
// "Client Login | RMEDIA"), which still wins over this default per
// Next.js's normal child-overrides-parent metadata resolution.
export const metadata: Metadata = {
  title: "RMEDIA Client Portal",
  description: "Project delivery, video review and recorded spend.",
  applicationName: "RMEDIA",
  manifest: null,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RMEDIA",
  },
};

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
