"use server";

import { redirect } from "next/navigation";
import {
  clearClientLoginFailures,
  createClientAuthSession,
  deleteClientAuthSession,
  getClientLoginGate,
  recordClientLoginFailure,
} from "@/lib/client-portal-session";
import { verifyClientCredentials } from "@/modules/client-portal/auth-data";

// Plain relative redirects throughout -- unlike admin login's basePath
// special-casing (a dev-only workaround noted in auth/actions.ts), the
// existing /client/[token] route already works today with no special
// basePath handling, so the new client-portal routes follow that same
// working pattern rather than reintroducing the admin conditional.

export type ClientLoginState = { error?: string };

const INVALID_LOGIN_MESSAGE = "Incorrect email or password.";

export async function clientLoginAction(
  _previousState: ClientLoginState,
  formData: FormData,
): Promise<ClientLoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return { error: INVALID_LOGIN_MESSAGE };
  }

  const gate = await getClientLoginGate(email);
  if (!gate.allowed) {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  const match = await verifyClientCredentials(email, password);
  if (!match) {
    await recordClientLoginFailure(gate);
    return { error: INVALID_LOGIN_MESSAGE };
  }

  await clearClientLoginFailures(gate);
  await createClientAuthSession(match.clientId);
  redirect("/client/dashboard");
}

export async function clientLogoutAction() {
  await deleteClientAuthSession();
  redirect("/client/login");
}
