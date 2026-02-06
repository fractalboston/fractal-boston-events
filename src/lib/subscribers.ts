import { sql } from "kysely";
import { db } from "@/db/db";
import type { Subscriber, SubscriberStatus } from "@/db/db";

/** Escape \ % _ for use in a LIKE/ILIKE pattern with ESCAPE '\\'. */
function escapeForLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type CreateSubscriberInput = {
  email: string;
  source: "form" | "luma" | "substack" | "manual";
  status?: SubscriberStatus;
};

export async function createSubscriber(
  input: CreateSubscriberInput
): Promise<Subscriber | undefined> {
  const status = input.status ?? "pending";

  const result = await db
    .insertInto("subscribers")
    .values({
      email: input.email.toLowerCase(),
      status,
      source: input.source,
    })
    .onConflict((oc) => oc.column("email").doNothing())
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function getSubscriberByEmail(
  email: string
): Promise<Subscriber | undefined> {
  return db
    .selectFrom("subscribers")
    .selectAll()
    .where("email", "=", email.toLowerCase())
    .executeTakeFirst();
}

export async function getSubscriberByToken(
  token: string
): Promise<Subscriber | undefined> {
  return db
    .selectFrom("subscribers")
    .selectAll()
    .where("token", "=", token)
    .executeTakeFirst();
}

export async function verifySubscriber(
  token: string
): Promise<Subscriber | undefined> {
  const result = await db
    .updateTable("subscribers")
    .set({ status: "verified" })
    .where("token", "=", token)
    .where("status", "=", "pending")
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function unsubscribe(
  token: string
): Promise<Subscriber | undefined> {
  const result = await db
    .updateTable("subscribers")
    .set({ status: "unsubscribed" })
    .where("token", "=", token)
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function getAllVerifiedSubscribers(): Promise<Subscriber[]> {
  const results = await db
    .selectFrom("subscribers")
    .selectAll()
    .where("status", "=", "verified")
    .execute();

  return results;
}

export async function resubscribe(
  email: string
): Promise<Subscriber | undefined> {
  const result = await db
    .updateTable("subscribers")
    .set({ status: "verified" })
    .where("email", "=", email.toLowerCase())
    .where("status", "=", "unsubscribed")
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function searchSubscribersByEmail(
  query: string
): Promise<Subscriber[]> {
  if (query.trim() === "") {
    return [];
  }
  const pattern = `%${escapeForLike(query.trim())}%`;
  return db
    .selectFrom("subscribers")
    .selectAll()
    .where(sql<boolean>`email ilike ${pattern} escape '\\'`)
    .orderBy("email", "asc")
    .limit(50)
    .execute();
}

export type UpdateSubscriberInput = {
  id: string;
  source?: "form" | "luma" | "substack" | "manual";
  status?: SubscriberStatus;
};

export async function updateSubscriber(
  input: UpdateSubscriberInput
): Promise<Subscriber | undefined> {
  const updates: Partial<{
    source: "form" | "luma" | "substack" | "manual";
    status: SubscriberStatus;
  }> = {};
  if (input.source !== undefined) updates.source = input.source;
  if (input.status !== undefined) updates.status = input.status;
  if (Object.keys(updates).length === 0) {
    return db
      .selectFrom("subscribers")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();
  }
  const result = await db
    .updateTable("subscribers")
    .set(updates)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirst();
  return result;
}
