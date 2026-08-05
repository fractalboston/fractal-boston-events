import { db } from "@/db/db";
import type {
  AuthChallenge,
  Invite,
  InviteStatus,
  Session,
  User,
  WebauthnCredential,
} from "@/db/db";
import { CHALLENGE_TTL_MS, INVITE_TTL_MS } from "@/lib/passkey/config";

export async function countUsers(): Promise<number> {
  const row = await db
    .selectFrom("users")
    .select(db.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function createUser(userId: string): Promise<User> {
  return db
    .insertInto("users")
    .values({ id: userId })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function getUserById(userId: string): Promise<User | undefined> {
  return db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();
}

export async function insertCredential({
  credentialId,
  userId,
  publicKey,
  counter,
  transports,
}: {
  credentialId: string;
  userId: string;
  publicKey: Buffer;
  counter: number;
  transports: string | null;
}): Promise<void> {
  await db
    .insertInto("webauthn_credentials")
    .values({
      credential_id: credentialId,
      user_id: userId,
      public_key: publicKey,
      counter,
      transports,
    })
    .execute();
}

export async function getCredentialById(
  credentialId: string
): Promise<WebauthnCredential | undefined> {
  return db
    .selectFrom("webauthn_credentials")
    .selectAll()
    .where("credential_id", "=", credentialId)
    .executeTakeFirst();
}

export async function updateCredentialCounter(
  credentialId: string,
  counter: number
): Promise<void> {
  await db
    .updateTable("webauthn_credentials")
    .set({ counter })
    .where("credential_id", "=", credentialId)
    .execute();
}

export async function createSession({
  userId,
  expiresAt,
}: {
  userId: string;
  expiresAt: Date;
}): Promise<Session> {
  return db
    .insertInto("sessions")
    .values({
      user_id: userId,
      expires_at: expiresAt,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function getSessionById(
  sessionId: string
): Promise<Session | undefined> {
  return db
    .selectFrom("sessions")
    .selectAll()
    .where("id", "=", sessionId)
    .executeTakeFirst();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
}

export async function storeChallenge({
  challenge,
  userId,
  inviteToken,
}: {
  challenge: string;
  userId?: string;
  inviteToken?: string;
}): Promise<string> {
  await db
    .deleteFrom("auth_challenges")
    .where("expires_at", "<=", new Date())
    .execute();

  const row = await db
    .insertInto("auth_challenges")
    .values({
      challenge,
      user_id: userId ?? null,
      invite_token: inviteToken ?? null,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return row.id;
}

export async function consumeChallenge(
  challengeId: string
): Promise<AuthChallenge | null> {
  const row = await db
    .deleteFrom("auth_challenges")
    .where("id", "=", challengeId)
    .where("expires_at", ">", new Date())
    .returningAll()
    .executeTakeFirst();

  return row ?? null;
}

export function isInviteValid(status: InviteStatus, expiresAt: Date): boolean {
  return status === "pending" && expiresAt.getTime() > Date.now();
}

export async function createInvite({
  label,
  createdBy,
}: {
  label: string;
  createdBy: string;
}): Promise<Invite> {
  return db
    .insertInto("invites")
    .values({
      label,
      created_by: createdBy,
      expires_at: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listInvites(): Promise<Invite[]> {
  return db
    .selectFrom("invites")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();
}

export async function getInvite(token: string): Promise<Invite | undefined> {
  return db
    .selectFrom("invites")
    .selectAll()
    .where("token", "=", token)
    .executeTakeFirst();
}

export async function acceptInvite({
  token,
  userId,
}: {
  token: string;
  userId: string;
}): Promise<Invite | undefined> {
  return db
    .updateTable("invites")
    .set({
      status: "accepted",
      accepted_at: new Date(),
      accepted_user_id: userId,
    })
    .where("token", "=", token)
    .where("status", "=", "pending")
    .where("expires_at", ">", new Date())
    .returningAll()
    .executeTakeFirst();
}
