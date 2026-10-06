import { sql } from "kysely";
import { z } from "zod";
import { db } from "@/db/db";
import type { Subscriber, SubscriberStatus } from "@/db/db";
import {
  isSubscriberId,
  isSubscriberToken,
  normalizeSubscriberIdInput,
  normalizeSubscriberTokenInput,
} from "@/lib/subscriberToken";

/** Escape \ % _ for use in a LIKE/ILIKE pattern with ESCAPE '\\'. */
function escapeForLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Statuses that may re-enter the double opt-in flow when the person explicitly
 * asks to subscribe again. Bounces can be transient (full mailbox) and a fresh
 * verification click is an explicit consent signal, so both suppression
 * statuses are eligible alongside unsubscribed.
 */
export const RESUBSCRIBE_ELIGIBLE_STATUSES: SubscriberStatus[] = [
  "unsubscribed",
  "bounced",
  "complained",
];

export function isResubscribeEligible(status: SubscriberStatus): boolean {
  return RESUBSCRIBE_ELIGIBLE_STATUSES.includes(status);
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

/** Internal admin lookup by subscriber id. Never use in public subscription flows. */
export async function getSubscriberById(
  id: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberIdInput(id);
  if (!isSubscriberId(normalized)) {
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
  if (!isSubscriberToken(normalized)) {
    return undefined;
  }

  return db
    .selectFrom("subscribers")
    .selectAll()
    .where("token", "=", normalized)
    .executeTakeFirst();
}

export async function verifySubscriber(
  token: string
): Promise<Subscriber | undefined> {
  const normalized = normalizeSubscriberTokenInput(token);
  if (!isSubscriberToken(normalized)) {
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
  if (!isSubscriberToken(normalized)) {
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
    .map((id) => normalizeSubscriberIdInput(id))
    .filter(isSubscriberId);

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
  const normalizedId = normalizeSubscriberIdInput(input.id);
  if (!isSubscriberId(normalizedId)) {
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
  const normalizedId = normalizeSubscriberIdInput(id);
  if (!isSubscriberId(normalizedId)) {
    return false;
  }

  const result = await db
    .deleteFrom("subscribers")
    .where("id", "=", normalizedId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

/**
 * Tags are lowercase slugs (e.g. "expo-oct-2026") so the same audience can
 * never fragment across case or whitespace variants of one name.
 */
export const subscriberTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,99}$/,
    "Tag must be lowercase letters, numbers, and hyphens"
  );

export type TagSummary = {
  tag: string;
  verifiedCount: number;
  pendingCount: number;
  totalCount: number;
};

export async function listSubscriberTags(): Promise<TagSummary[]> {
  return db
    .selectFrom("subscriber_tags")
    .innerJoin("subscribers", "subscribers.id", "subscriber_tags.subscriber_id")
    .select([
      "subscriber_tags.tag as tag",
      sql<number>`count(*) filter (where subscribers.status = 'verified')::int`.as(
        "verifiedCount"
      ),
      sql<number>`count(*) filter (where subscribers.status = 'pending')::int`.as(
        "pendingCount"
      ),
      sql<number>`count(*)::int`.as("totalCount"),
    ])
    .groupBy("subscriber_tags.tag")
    .orderBy("subscriber_tags.tag", "asc")
    .execute();
}

export async function tagSubscriber({
  subscriberId,
  tag,
}: {
  subscriberId: string;
  tag: string;
}): Promise<void> {
  await db
    .insertInto("subscriber_tags")
    .values({ subscriber_id: subscriberId, tag })
    .onConflict((oc) => oc.columns(["subscriber_id", "tag"]).doNothing())
    .execute();
}

export type ImportSubscribersResult = {
  added: string[];
  alreadySubscribed: string[];
  suppressed: { email: string; status: SubscriberStatus }[];
};

/**
 * Import a pasted list of emails as tagged subscribers.
 * - New addresses are created pending/manual: they receive nothing until a
 *   tagged broadcast deliberately includes unconfirmed subscribers, and they
 *   join the regular list only by clicking their own confirm link.
 * - Addresses already on the list (pending or verified) are tagged only.
 * - Addresses that unsubscribed, bounced, or complained are skipped entirely
 *   and reported - an import never resurrects a suppressed address.
 */
export async function importSubscribers({
  emails,
  tag,
}: {
  emails: string[];
  tag: string;
}): Promise<ImportSubscribersResult> {
  const result: ImportSubscribersResult = {
    added: [],
    alreadySubscribed: [],
    suppressed: [],
  };
  const seen = new Set<string>();

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (email === "" || seen.has(email)) {
      continue;
    }
    seen.add(email);

    let existing = await getSubscriberByEmail(email);
    if (existing === undefined) {
      const created = await createSubscriber({
        email,
        source: "manual",
        status: "pending",
      });
      if (created !== undefined) {
        await tagSubscriber({ subscriberId: created.id, tag });
        result.added.push(email);
        continue;
      }
      // Lost a creation race - re-read and fall through to the existing path
      existing = await getSubscriberByEmail(email);
      if (existing === undefined) {
        continue;
      }
    }

    if (existing.status === "pending" || existing.status === "verified") {
      await tagSubscriber({ subscriberId: existing.id, tag });
      result.alreadySubscribed.push(email);
    } else {
      result.suppressed.push({ email, status: existing.status });
    }
  }

  return result;
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
