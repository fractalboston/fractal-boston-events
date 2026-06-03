import { sql } from "kysely";
import { db } from "@/db/db";
import type { Subscriber, SubscriberStatus } from "@/db/db";
import {
  isHexSubscriberToken,
  isSubscriberUuid,
  normalizeSubscriberTokenInput,
} from "@/lib/subscriberToken";

/** Escape \ % _ for use in a LIKE/ILIKE pattern with ESCAPE '\\'. */
function escapeForLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type CreateSubscriberInput = {
  email: string;
  source: "form" | "luma" | "substack" | "manual";
  status?: SubscriberStatus;
};

/**
 * Create a new subscriber.
 * IMPORTANT: Email is automatically lowercased before saving to ensure consistency.
 * This is the only function that inserts emails into the database.
 */
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

export async function getSubscriberById(
  id: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(id);
  if (!isSubscriberUuid(normalized)) {
    return undefined;
  }

  return db
    .selectFrom("subscribers")
    .selectAll()
    .where("id", "=", normalized)
    .executeTakeFirst();
}

export async function getSubscriberByToken(
  token: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(token);
  if (!isHexSubscriberToken(normalized)) {
    return undefined;
  }

  return db
    .selectFrom("subscribers")
    .selectAll()
    .where("token", "=", normalized)
    .executeTakeFirst();
}

/** Resolves a hex token or subscriber UUID (e.g. id pasted from admin). */
export async function resolveSubscriberByTokenOrId(
  value: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(value);
  if (isHexSubscriberToken(normalized)) {
    return getSubscriberByToken(normalized);
  }
  if (isSubscriberUuid(normalized)) {
    return getSubscriberById(normalized);
  }
  return undefined;
}

export async function verifySubscriber(
  token: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(token);
  if (!isHexSubscriberToken(normalized)) {
    return undefined;
  }

  const result = await db
    .updateTable("subscribers")
    .set({ status: "verified" })
    .where("token", "=", normalized)
    .where("status", "=", "pending")
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function unsubscribe(
  token: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(token);
  if (!isHexSubscriberToken(normalized)) {
    return undefined;
  }

  const result = await db
    .updateTable("subscribers")
    .set({ status: "unsubscribed" })
    .where("token", "=", normalized)
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

export async function getVerifiedSubscribersByIds(
  ids: string[]
): Promise<Subscriber[]> {
  const normalizedIds = ids
    .map((id) => normalizeSubscriberTokenInput(id))
    .filter(isSubscriberUuid);

  if (normalizedIds.length === 0) {
    return [];
  }

  const results = await db
    .selectFrom("subscribers")
    .selectAll()
    .where("id", "in", normalizedIds)
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

export async function searchSubscribersByEmail({
  query,
  sort,
  status,
  limit,
  offset,
}: {
  query: string;
  sort: "newest" | "alphabetical" | "last_emailed";
  status?: SubscriberStatus;
  limit: number;
  offset: number;
}): Promise<{
  subscribers: Subscriber[];
  hasMore: boolean;
  totalCount: number;
}> {
  const normalizedQuery = query.trim();
  const pattern =
    normalizedQuery === "" ? undefined : `%${escapeForLike(normalizedQuery)}%`;

  let filteredQuery = db.selectFrom("subscribers");
  if (pattern !== undefined) {
    filteredQuery = filteredQuery.where(
      sql<boolean>`email ilike ${pattern} escape '\\'`
    );
  }
  if (status !== undefined) {
    filteredQuery = filteredQuery.where("status", "=", status);
  }

  const totalCountRow = await filteredQuery
    .select(sql<number>`count(*)::int`.as("total_count"))
    .executeTakeFirstOrThrow();

  let listQuery = filteredQuery.selectAll();
  if (sort === "alphabetical") {
    listQuery = listQuery.orderBy("email", "asc").orderBy("created_at", "desc");
  } else if (sort === "last_emailed") {
    listQuery = listQuery
      .orderBy(sql`last_emailed_at desc nulls last`)
      .orderBy("email", "asc");
  } else {
    listQuery = listQuery.orderBy("created_at", "desc").orderBy("email", "asc");
  }

  const rows = await listQuery
    .limit(limit + 1)
    .offset(offset)
    .execute();
  const hasMore = rows.length > limit;
  return {
    subscribers: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
    totalCount: totalCountRow.total_count,
  };
}

export type UpdateSubscriberInput = {
  id: string;
  email?: string;
  source?: "form" | "luma" | "substack" | "manual";
  status?: SubscriberStatus;
};

export async function updateSubscriber(
  input: UpdateSubscriberInput
): Promise<Subscriber | undefined> {
  const updates: Partial<{
    email: string;
    source: "form" | "luma" | "substack" | "manual";
    status: SubscriberStatus;
  }> = {};
  if (input.email !== undefined) updates.email = input.email.toLowerCase();
  if (input.source !== undefined) updates.source = input.source;
  if (input.status !== undefined) updates.status = input.status;
  const normalizedId = normalizeSubscriberTokenInput(input.id);
  if (!isSubscriberUuid(normalizedId)) {
    return undefined;
  }

  if (Object.keys(updates).length === 0) {
    return db
      .selectFrom("subscribers")
      .selectAll()
      .where("id", "=", normalizedId)
      .executeTakeFirst();
  }

  // Check if email already exists (excluding current subscriber)
  if (input.email !== undefined) {
    const existing = await db
      .selectFrom("subscribers")
      .selectAll()
      .where("email", "=", input.email.toLowerCase())
      .where("id", "!=", normalizedId)
      .executeTakeFirst();
    if (existing !== undefined) {
      return undefined; // Email conflict - API will return appropriate error
    }
  }

  const result = await db
    .updateTable("subscribers")
    .set(updates)
    .where("id", "=", normalizedId)
    .returningAll()
    .executeTakeFirst();
  return result;
}

export async function deleteSubscriber(id: string): Promise<boolean> {
  const normalizedId = normalizeSubscriberTokenInput(id);
  if (!isSubscriberUuid(normalizedId)) {
    return false;
  }

  const result = await db
    .deleteFrom("subscribers")
    .where("id", "=", normalizedId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

/**
 * Update last_emailed_at timestamp for multiple subscribers.
 * IMPORTANT: Emails are automatically lowercased before updating to ensure consistency.
 */
export async function updateLastEmailedAt(emails: string[]): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  const normalizedEmails = emails.map((email) => email.toLowerCase());

  await db
    .updateTable("subscribers")
    .set({ last_emailed_at: sql`now()` })
    .where("email", "in", normalizedEmails)
    .execute();
}
