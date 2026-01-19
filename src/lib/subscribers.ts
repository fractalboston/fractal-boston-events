import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import type { SubscriberStatus, SubscribersTable } from "@/db";

export type Subscriber = SubscribersTable;

export type CreateSubscriberInput = {
  email: string;
  source: "form" | "luma";
  status?: SubscriberStatus;
};

export async function createSubscriber(
  input: CreateSubscriberInput
): Promise<Subscriber> {
  const token = uuidv4();
  const status = input.status ?? "pending";

  const result = await db
    .insertInto("subscribers")
    .values({
      id: uuidv4(),
      email: input.email.toLowerCase(),
      token,
      status,
      source: input.source,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

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
    .set({
      status: "verified",
      updated_at: new Date(),
    })
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
    .set({
      status: "unsubscribed",
      updated_at: new Date(),
    })
    .where("token", "=", token)
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function getAllVerifiedSubscribers(): Promise<
  { email: string; token: string }[]
> {
  const results = await db
    .selectFrom("subscribers")
    .select(["email", "token"])
    .where("status", "=", "verified")
    .execute();

  return results;
}

export async function resubscribe(
  email: string
): Promise<Subscriber | undefined> {
  const result = await db
    .updateTable("subscribers")
    .set({
      status: "verified",
      updated_at: new Date(),
    })
    .where("email", "=", email.toLowerCase())
    .where("status", "=", "unsubscribed")
    .returningAll()
    .executeTakeFirst();

  return result;
}
