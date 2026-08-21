"use server";

import { redirect } from "next/navigation";
import {
  clearLoginFailures,
  createAuthSession,
  deleteAuthSession,
  getLoginGate,
  passwordMatches,
  recordLoginFailure,
} from "@/lib/auth-server";
import {
  APP_BASE_PATH,
  LOGIN_PATH,
  LOGIN_ROUTE,
} from "@/lib/auth-core";

export type LoginState = {
  error?: string;
};

const INVALID_LOGIN_MESSAGE = "Senha incorreta. Tente novamente.";

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length < 8 || password.length > 256) {
    return { error: INVALID_LOGIN_MESSAGE };
  }

  const gate = await getLoginGate();

  if (!gate.allowed) {
    return {
      error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
    };
  }

  if (!(await passwordMatches(password))) {
    await recordLoginFailure(gate);
    return { error: INVALID_LOGIN_MESSAGE };
  }

  await clearLoginFailures(gate);
  await createAuthSession();
  redirect(process.env.NODE_ENV === "development" ? APP_BASE_PATH : "/");
}

export async function logoutAction() {
  await deleteAuthSession();
  redirect(process.env.NODE_ENV === "development" ? LOGIN_PATH : LOGIN_ROUTE);
}
