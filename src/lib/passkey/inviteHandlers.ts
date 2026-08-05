import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import {
  INVITE_LABEL_MAX_LENGTH,
  SESSION_TTL_MS,
  getPublicOrigin,
} from "@/lib/passkey/config";
import {
  acceptInvite,
  createInvite,
  createSession,
  createUser,
  getInvite,
  isInviteValid,
  listInvites,
} from "@/lib/passkey/db";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";
import {
  createSessionCookieHeader,
  withSetCookie,
} from "@/lib/passkey/session";
import {
  createInviteRegistrationOptions,
  saveCredential,
  verifyRegistration,
} from "@/lib/passkey/webauthn";

const createInviteBodySchema = z.object({
  label: z.string().trim().min(1).max(INVITE_LABEL_MAX_LENGTH),
});

const registrationResponseSchema = z.custom<RegistrationResponseJSON>(
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

function inviteUrl(request: Request, token: string): string {
  return `${getPublicOrigin(request)}/invite/${token}`;
}

export async function handleListInvites(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }

  try {
    const invites = await listInvites();
    return sendSuccess(
      invites.map((invite) => ({
        token: invite.token,
        label: invite.label,
        status: invite.status,
        url: inviteUrl(request, invite.token),
        createdAt: invite.created_at.toISOString(),
        expiresAt: invite.expires_at.toISOString(),
        acceptedAt: invite.accepted_at?.toISOString() ?? null,
      }))
    );
  } catch (error) {
    console.error("list invites error:", error);
    return sendInternalError("Failed to list invites");
  }
}

export async function handleCreateInvite(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }

  try {
    const raw: unknown = await request.json();
    const parsed = createInviteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return sendBadRequest("Label is required");
    }

    const invite = await createInvite({
      label: parsed.data.label,
      createdBy: auth.id,
    });

    return sendSuccess({
      token: invite.token,
      label: invite.label,
      status: invite.status,
      url: inviteUrl(request, invite.token),
      expiresAt: invite.expires_at.toISOString(),
    });
  } catch (error) {
    console.error("create invite error:", error);
    return sendInternalError("Failed to create invite");
  }
}

export async function handleGetInvite(
  _request: Request,
  token: string
): Promise<Response> {
  try {
    const invite = await getInvite(token);
    if (!invite) {
      return sendNotFound("Invite not found");
    }
    const valid = isInviteValid(invite.status, invite.expires_at);
    return sendSuccess({
      label: invite.label,
      status: invite.status,
      valid,
      expiresAt: invite.expires_at.toISOString(),
    });
  } catch (error) {
    console.error("get invite error:", error);
    return sendInternalError("Failed to read invite");
  }
}

export async function handleInviteRegisterOptions({
  request,
  token,
}: {
  request: Request;
  token: string;
}): Promise<Response> {
  try {
    const invite = await getInvite(token);
    if (!invite) {
      return sendNotFound("Invite not found");
    }
    if (!isInviteValid(invite.status, invite.expires_at)) {
      return sendBadRequest("Invite is not valid");
    }

    const { challengeId, options } = await createInviteRegistrationOptions({
      request,
      inviteToken: token,
      label: invite.label,
    });
    return sendSuccess({ challengeId, options });
  } catch (error) {
    console.error("invite register options error:", error);
    return sendInternalError("Failed to create registration options");
  }
}

export async function handleInviteRegisterVerify({
  request,
  token,
}: {
  request: Request;
  token: string;
}): Promise<Response> {
  try {
    const invite = await getInvite(token);
    if (!invite) {
      return sendNotFound("Invite not found");
    }
    if (!isInviteValid(invite.status, invite.expires_at)) {
      return sendBadRequest("Invite is not valid");
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

    if (verification.inviteToken !== token) {
      return sendBadRequest("Invite mismatch");
    }

    const user = await createUser(verification.userId);
    await saveCredential({
      userId: user.id,
      credential: verification.credential,
    });

    const accepted = await acceptInvite({ token, userId: user.id });
    if (!accepted) {
      return sendBadRequest("Failed to accept invite");
    }

    const session = await createSession({
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return withSetCookie(
      sendSuccess({ user: { id: user.id } }),
      createSessionCookieHeader({ sessionId: session.id, request })
    );
  } catch (error) {
    console.error("invite register verify error:", error);
    return sendInternalError("Failed to complete registration");
  }
}
