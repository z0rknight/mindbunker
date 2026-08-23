"use server";

import { redirect } from "next/navigation";
import {
  requestPortalPasswordReset,
  resetPortalPasswordWithToken,
} from "@/modules/client-portal/auth-data";

export type ResetRequestState = { submitted?: boolean; devToken?: string | null };

const GENERIC_MESSAGE =
  "If that email has portal access, we've sent reset instructions.";

export async function requestClientResetAction(
  _previousState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) {
    // Same generic response even for empty input -- never confirms or
    // denies anything about what was typed.
    return { submitted: true, devToken: null };
  }

  const { devToken } = await requestPortalPasswordReset(email);
  return { submitted: true, devToken };
}

export { GENERIC_MESSAGE as CLIENT_RESET_GENERIC_MESSAGE };

export type ResetCompleteState = { error?: string };

export async function completeClientResetAction(
  token: string,
  _previousState: ResetCompleteState,
  formData: FormData,
): Promise<ResetCompleteState> {
  const password = formData.get("password");
  if (typeof password !== "string") {
    return { error: "Enter a new password." };
  }

  const result = await resetPortalPasswordWithToken(token, password);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/client/login");
}
