// September Local Feature Harvest -- lightweight, code-level feature flag
// (not Cloudflare infrastructure, not an env secret). Gates experimental
// local-lab-only surfaces (the /lab route, its Sidebar nav entry) so they
// exist during `next dev` for dogfooding but disappear from a real
// production build/deploy without anyone having to remember to remove
// files. This is NOT a promotion mechanism -- flipping this flag is not
// how a feature graduates to production; a deliberate code change plus the
// existing deploy process is.
export const LOCAL_LAB_ENABLED = process.env.NODE_ENV !== "production";
