import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { sql } from "kysely";
import { db } from "@/db/db";
import { BOOTSTRAP_USERNAME, getWebAuthnConfig } from "@/lib/passkey/config";
import {
  consumeChallenge,
  getCredentialById,
  insertCredential,
  storeChallenge,
  updateCredentialCounter,
} from "@/lib/passkey/db";

async function mintUserId(): Promise<string> {
  const row = await sql<{ id: string }>`SELECT generate_ulid() AS id`.execute(
    db
  );
  const id = row.rows[0]?.id;
  if (id === undefined || id === "") {
    throw new Error("Failed to mint user id");
  }
  return id;
}

export async function createSetupRegistrationOptions(
  request: Request
): Promise<{
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}> {
  const { rpName, rpID } = getWebAuthnConfig(request);
  const userId = await mintUserId();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: BOOTSTRAP_USERNAME,
    userDisplayName: BOOTSTRAP_USERNAME,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const challengeId = await storeChallenge({
    challenge: options.challenge,
    userId,
  });

  return { challengeId, options };
}

export async function createInviteRegistrationOptions({
  request,
  inviteToken,
  label,
}: {
  request: Request;
  inviteToken: string;
  label: string;
}): Promise<{
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}> {
  const { rpName, rpID } = getWebAuthnConfig(request);
  const userId = await mintUserId();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: label,
    userDisplayName: label,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const challengeId = await storeChallenge({
    challenge: options.challenge,
    userId,
    inviteToken,
  });

  return { challengeId, options };
}

export async function createLoginOptions(request: Request): Promise<{
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}> {
  const { rpID } = getWebAuthnConfig(request);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const challengeId = await storeChallenge({ challenge: options.challenge });

  return { challengeId, options };
}

export async function verifyRegistration({
  request,
  challengeId,
  response,
}: {
  request: Request;
  challengeId: string;
  response: RegistrationResponseJSON;
}): Promise<
  | {
      ok: true;
      userId: string;
      inviteToken?: string;
      credential: {
        credentialId: string;
        publicKey: Buffer;
        counter: number;
        transports: string | null;
      };
    }
  | { ok: false; message: string }
> {
  const entry = await consumeChallenge(challengeId);
  if (
    entry === null ||
    entry.challenge === "" ||
    entry.user_id === null ||
    entry.user_id === ""
  ) {
    return { ok: false, message: "Invalid or expired registration challenge" };
  }

  const { origin, rpID } = getWebAuthnConfig(request);

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: entry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified) {
      return { ok: false, message: "Registration verification failed" };
    }

    const { credential } = verification.registrationInfo;

    return {
      ok: true,
      userId: entry.user_id,
      inviteToken:
        entry.invite_token !== null && entry.invite_token !== ""
          ? entry.invite_token
          : undefined,
      credential: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports:
          credential.transports !== undefined
            ? JSON.stringify(credential.transports)
            : null,
      },
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Registration verification failed",
    };
  }
}

export async function verifyLogin({
  request,
  challengeId,
  response,
}: {
  request: Request;
  challengeId: string;
  response: AuthenticationResponseJSON;
}): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const entry = await consumeChallenge(challengeId);
  if (entry === null || entry.challenge === "") {
    return { ok: false, message: "Invalid or expired login challenge" };
  }

  const stored = await getCredentialById(response.id);
  if (stored === undefined) {
    return { ok: false, message: "Unknown credential" };
  }

  const { origin, rpID } = getWebAuthnConfig(request);

  let transports: AuthenticatorTransportFuture[] | undefined;
  if (stored.transports !== null && stored.transports !== "") {
    try {
      transports = JSON.parse(
        stored.transports
      ) as AuthenticatorTransportFuture[];
    } catch {
      transports = undefined;
    }
  }

  const counter =
    typeof stored.counter === "string"
      ? Number(stored.counter)
      : stored.counter;

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: entry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter,
        transports,
      },
    });

    if (!verification.verified) {
      return { ok: false, message: "Authentication verification failed" };
    }

    await updateCredentialCounter(
      stored.credential_id,
      verification.authenticationInfo.newCounter
    );

    return { ok: true, userId: stored.user_id };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Authentication verification failed",
    };
  }
}

export async function saveCredential({
  userId,
  credential,
}: {
  userId: string;
  credential: {
    credentialId: string;
    publicKey: Buffer;
    counter: number;
    transports: string | null;
  };
}): Promise<void> {
  await insertCredential({
    credentialId: credential.credentialId,
    userId,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
  });
}
