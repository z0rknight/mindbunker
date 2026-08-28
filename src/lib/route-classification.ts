// Strategic Reality Cleanup II §3 (P0 client-portal fix): pure classification
// logic extracted out of AppShell.tsx so it can be unit-tested with the
// repo's normal node:test convention -- AppShell itself is a client
// component ("use client") wrapping usePathname(), and this repo has no
// React rendering test harness (no @testing-library, no jsdom), so the only
// honest way to add regression coverage for "which routes get the bare
// passthrough vs the full admin shell" is to make that decision a plain,
// importable function and test the function directly.
//
// Bug this exists to prevent regressing: the bare "/client" route (no
// trailing slash) does not start with "/client/", so a naive
// `pathname.startsWith("/client/")` check silently wraps an anonymous
// visitor's very first hit in the full admin Sidebar/MobileQuickCapture
// shell instead of the bare passthrough every other client-portal route
// gets -- exactly the kind of "HTTP 200 but not a working product" gap
// Strategic Reality Cleanup II calls out.
export type AppShellRouteClassification = {
  normalizedPath: string;
  isLogin: boolean;
  isPublicGateway: boolean;
  isClientPortal: boolean;
  isPublicIntake: boolean;
  isBareShellRoute: boolean;
};

const BASE_PATH = "/mindbunker";

// Reality Closure (26 Aug 2026) P0: /quoteavideo and /book are public
// client-acquisition surfaces -- an anonymous visitor with no session and
// no reason to ever see RMEDIA's internal product surface. Before this,
// neither route appeared anywhere in this classification, so AppShell's
// `isBareShellRoute` fell through to false and mounted the full operator
// <Sidebar /> (War Room, CRM, Finance, Subscriptions, Debts, Contracts,
// All History, Health...) for every visitor on the one page meant to
// acquire new clients. Both routes' page.tsx files were already verified
// to perform zero operator-only queries (no CRM/Finance reads, no
// getClientById, nothing) -- the leak was 100% the Sidebar mounting, not
// a data payload -- so this fix (excluding Sidebar from the component
// tree entirely for these routes, same mechanism as /client and /login
// already use) is sufficient on its own with no other code path to patch.
export function classifyAppShellRoute(pathname: string): AppShellRouteClassification {
  const normalizedPath = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname;

  const isLogin = normalizedPath === "/login";
  const isPublicGateway = normalizedPath.startsWith("/g/");
  const isClientPortal = normalizedPath === "/client" || normalizedPath.startsWith("/client/");
  const isPublicIntake = normalizedPath === "/quoteavideo" || normalizedPath === "/book";

  return {
    normalizedPath,
    isLogin,
    isPublicGateway,
    isClientPortal,
    isPublicIntake,
    isBareShellRoute: isLogin || isPublicGateway || isClientPortal || isPublicIntake,
  };
}
