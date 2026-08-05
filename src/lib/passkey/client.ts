import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    const message =
      !body.success && "error" in body ? body.error : "Request failed";
    throw new AuthApiError(message, response.status);
  }
  return body.data;
}

export type AuthStatus = {
  setupRequired: boolean;
  user?: { id: string };
};

export async function fetchAuthStatus(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>("/api/auth/status");
}

export async function runSetupCeremony(): Promise<{ user: { id: string } }> {
  const { challengeId, options } = await apiFetch<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/api/auth/setup/options", { method: "POST" });

  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: options,
  });

  return apiFetch<{ user: { id: string } }>("/api/auth/setup/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, response }),
  });
}

export async function runLoginCeremony(): Promise<{ user: { id: string } }> {
  const { challengeId, options } = await apiFetch<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/api/auth/login/options", { method: "POST" });

  const response: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: options,
  });

  return apiFetch<{ user: { id: string } }>("/api/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, response }),
  });
}

export async function runInviteRegisterCeremony(
  token: string
): Promise<{ user: { id: string } }> {
  const { challengeId, options } = await apiFetch<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>(`/api/invites/${token}/register/options`, { method: "POST" });

  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: options,
  });

  return apiFetch<{ user: { id: string } }>(
    `/api/invites/${token}/register/verify`,
    {
      method: "POST",
      body: JSON.stringify({ challengeId, response }),
    }
  );
}

export async function logout(): Promise<void> {
  await apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" });
}
