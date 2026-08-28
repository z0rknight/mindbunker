import assert from "node:assert/strict";
import test from "node:test";
import { classifyAppShellRoute } from "./route-classification.ts";

// Strategic Reality Cleanup II §3/§26: regression coverage for AppShell's
// route classification, not merely "the route exists". The concrete
// regression this guards: the bare "/client" route (no trailing slash) must
// get the same bare passthrough as every other client-portal route --
// wrapping an anonymous visitor's first hit in the full admin
// Sidebar/MobileQuickCapture shell is exactly the kind of "HTTP 200 but not
// a working product" gap this round exists to close.

test("bare /client (no trailing slash) is classified as client-portal, not admin shell", () => {
  const result = classifyAppShellRoute("/client");
  assert.equal(result.isClientPortal, true);
  assert.equal(result.isBareShellRoute, true);
});

test("/client/login and other client-portal subroutes remain bare-shell", () => {
  for (const path of ["/client/login", "/client/dashboard", "/client/reset", "/client/reset/abc123"]) {
    const result = classifyAppShellRoute(path);
    assert.equal(result.isClientPortal, true, `${path} should be client-portal`);
    assert.equal(result.isBareShellRoute, true, `${path} should be bare-shell`);
  }
});

test("a client-portal token route like /client/xyz is bare-shell (starts with /client/)", () => {
  const result = classifyAppShellRoute("/client/xyz-some-token");
  assert.equal(result.isClientPortal, true);
});

test("basePath-prefixed pathnames normalize the same as bare pathnames", () => {
  const withBase = classifyAppShellRoute("/mindbunker/client");
  const withoutBase = classifyAppShellRoute("/client");
  assert.deepEqual(withBase, withoutBase);

  const withBaseLogin = classifyAppShellRoute("/mindbunker/client/login");
  const withoutBaseLogin = classifyAppShellRoute("/client/login");
  assert.deepEqual(withBaseLogin, withoutBaseLogin);
});

test("operator /login and public gateway /g/* routes remain bare-shell", () => {
  assert.equal(classifyAppShellRoute("/login").isBareShellRoute, true);
  assert.equal(classifyAppShellRoute("/g/some-token").isBareShellRoute, true);
});

test("ordinary admin routes (Finance, CRM, Home) get the full shell, not bare passthrough", () => {
  for (const path of ["/", "/finance", "/finance/fx", "/crm", "/crm/42"]) {
    const result = classifyAppShellRoute(path);
    assert.equal(result.isBareShellRoute, false, `${path} should NOT be bare-shell`);
  }
});

test("a route that merely contains 'client' as a substring is not misclassified", () => {
  // Guards against an overly broad match (e.g. .includes("client")) --
  // only an exact "/client" or "/client/..." prefix counts.
  const result = classifyAppShellRoute("/crm/client-notes");
  assert.equal(result.isClientPortal, false);
});

// Reality Closure P0: production screenshot proved an anonymous visitor
// hitting /quoteavideo got the full operator Sidebar (War Room, CRM,
// Finance, Subscriptions, Debts, Contracts, All History, Health...)
// because neither /quoteavideo nor /book had ever been added to this
// classification. This is the regression guard for that exact bug.
test("/quoteavideo and /book are public intake surfaces and get the bare shell", () => {
  for (const path of ["/quoteavideo", "/book"]) {
    const result = classifyAppShellRoute(path);
    assert.equal(result.isPublicIntake, true, `${path} should be public intake`);
    assert.equal(result.isBareShellRoute, true, `${path} should be bare-shell (no operator Sidebar)`);
  }
});

test("/quoteavideo and /book normalize the same with the basePath prefix", () => {
  assert.deepEqual(
    classifyAppShellRoute("/mindbunker/quoteavideo"),
    classifyAppShellRoute("/quoteavideo"),
  );
  assert.deepEqual(
    classifyAppShellRoute("/mindbunker/book"),
    classifyAppShellRoute("/book"),
  );
});

test("a route that merely contains 'quoteavideo' or 'book' as a substring is not misclassified", () => {
  assert.equal(classifyAppShellRoute("/crm/quoteavideo-notes").isPublicIntake, false);
  assert.equal(classifyAppShellRoute("/finance/subscriptions/book-club").isPublicIntake, false);
});
