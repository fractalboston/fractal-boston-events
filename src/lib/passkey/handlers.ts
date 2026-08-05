import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { SESSION_TTL_MS } from "@/lib/passkey/config";
import { countUsers, createSession, createUser } from "@/lib/passkey/db";
import {
  clearSessionCookieHeader,
  createSessionCookieHeader,
  endSession,
  getSessionUser,
  withSetCookie,
} from "@/lib/passkey/session";
import {
  createLoginOptions,
  createSetupRegistrationOptions,
  saveCredential,
  verifyLogin,
  verifyRegistration,
} from "@/lib/passkey/webauthn";

const registrationResponseSchema = z.custom<RegistrationResponseJSON>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    "rawId" in val &&
    "response" in val &&
    "type" in val
);

const authenticationResponseSchema = z.custom<AuthenticationResponseJSON>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    "rawId" in val &&
    "response" in val &&
    "type" in val
);

const registrationCeremonySchema = z.object({
  challengeId: z.string().min(1),
  response: registrationResponseSchema,
});

const authenticationCeremonySchema = z.object({
  challengeId: z.string().min(1),
  response: authenticationResponseSchema,
});

export async function handleAuthStatus(request: Request): Promise<Response> {
  try {
    const [userCount, user] = await Promise.all([
      countUsers(),
      getSessionUser(request),
    ]);
    return sendSuccess({
      setupRequired: userCount === 0,
      user: user ?? undefined,
    });
  } catch (error) {
    console.error("auth status error:", error);
    return sendInternalError("Failed to read auth status");
  }
}

export async function handleSetupOptions(request: Request): Promise<Response> {
  try {
    const userCount = await countUsers();
    if (userCount > 0) {
      return sendError(403, "Setup already completed");
    }
    const { challengeId, options } =
      await createSetupRegistrationOptions(request);
    return sendSuccess({ challengeId, options });
  } catch (error) {
    console.error("setup options error:", error);
    return sendInternalError("Failed to create setup options");
  }
}

export async function handleSetupVerify(request: Request): Promise<Response> {
  try {
    const userCount = await countUsers();
    if (userCount > 0) {
      return sendError(403, "Setup already completed");
    }

    const raw: unknown = await request.json();
    const parsed = registrationCeremonySchema.safeParse(raw);
    if (!parsed.success) {
      return sendBadRequest("Missing challengeId or response");
    }

    const verification = await verifyRegistration({
      request,
      challengeId: parsed.data.challengeId,
      response: parsed.data.response,
    });

    if (!verification.ok) {
      return sendBadRequest(verification.message);
    }

    const user = await createUser(verification.userId);
    await saveCredential({
      userId: user.id,
      credential: verification.credential,
    });
    const session = await createSession({
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return withSetCookie(
      sendSuccess({ user: { id: user.id } }),
      createSessionCookieHeader({ sessionId: session.id, request })
    );
  } catch (error) {
    console.error("setup verify error:", error);
    return sendInternalError("Failed to complete setup");
  }
}

export async function handleLoginOptions(request: Request): Promise<Response> {
  try {
    const { challengeId, options } = await createLoginOptions(request);
    return sendSuccess({ challengeId, options });
  } catch (error) {
    console.error("login options error:", error);
    return sendInternalError("Failed to create login options");
  }
}

export async function handleLoginVerify(request: Request): Promise<Response> {
  try {
    const raw: unknown = await request.json();
    const parsed = authenticationCeremonySchema.safeParse(raw);
    if (!parsed.success) {
      return sendBadRequest("Missing challengeId or response");
    }

    const verification = await verifyLogin({
      request,
      challengeId: parsed.data.challengeId,
      response: parsed.data.response,
    });

    if (!verification.ok) {
      return sendBadRequest(verification.message);
    }

    const session = await createSession({
      userId: verification.userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return withSetCookie(
      sendSuccess({ user: { id: verification.userId } }),
      createSessionCookieHeader({ sessionId: session.id, request })
    );
  } catch (error) {
    console.error("login verify error:", error);
    return sendInternalError("Failed to complete login");
  }
}

export async function handleLogout(request: Request): Promise<Response> {
  try {
    await endSession(request);
    return withSetCookie(
      sendSuccess({ ok: true }),
      clearSessionCookieHeader(request)
    );
  } catch (error) {
    console.error("logout error:", error);
    return sendInternalError("Failed to logout");
  }
}
