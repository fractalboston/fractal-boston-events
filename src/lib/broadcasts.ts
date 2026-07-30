import { sql } from "kysely";
import { db } from "@/db/db";
import type {
  Broadcast,
  BroadcastRecipient,
  BroadcastStatus,
  SenderIdentity,
  SubscriberStatus,
} from "@/db/db";
import { SENDER_EMAIL_DOMAIN } from "@/lib/constants";
import { wrapInBroadcastTemplate } from "@/lib/emailTemplates";

export function isAllowedSenderEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return false;
  }
  return normalized.slice(atIndex + 1) === SENDER_EMAIL_DOMAIN;
}

export function formatSenderFrom({
  name,
  email,
}: {
  name: string;
  email: string;
}): string {
  return `${name} <${email}>`;
}

export function formatTestSubject(subject: string): string {
  return `[TEST] ${subject}`;
}

export function buildBroadcastHtml({
  content,
  unsubscribeUrl,
}: {
  content: string;
  unsubscribeUrl: string;
}): string {
  return wrapInBroadcastTemplate({ content, unsubscribeUrl });
}

/**
 * Editing the subject, content, or sender of a tested draft invalidates the
 * test approval - what was tested is no longer what would be sent.
 */
export function editClearsTestApproval({
  broadcast,
  updates,
}: {
  broadcast: Pick<Broadcast, "subject" | "content" | "sender_identity_id">;
  updates: {
    subject?: string;
    content?: string;
    senderIdentityId?: string;
  };
}): boolean {
  return (
    (updates.subject !== undefined && updates.subject !== broadcast.subject) ||
    (updates.content !== undefined && updates.content !== broadcast.content) ||
    (updates.senderIdentityId !== undefined &&
      updates.senderIdentityId !== broadcast.sender_identity_id)
  );
}

const SENDABLE_STATUSES: BroadcastStatus[] = ["draft", "failed", "partial"];

export function canSendBroadcast(
  broadcast: Pick<Broadcast, "status" | "test_sent_at">
): { ok: true } | { ok: false; reason: string } {
  if (!SENDABLE_STATUSES.includes(broadcast.status)) {
    return {
      ok: false,
      reason: `Broadcast is ${broadcast.status} and cannot be sent`,
    };
  }
  if (broadcast.test_sent_at === null) {
    return {
      ok: false,
      reason: "A test send is required before sending to the list",
    };
  }
  return { ok: true };
}

/**
 * "sent" means fully delivered (nothing failed), "partial" means delivered
 * with failures left to retry, and "failed" means aborted (pending remain)
 * or nothing delivered. failed and partial broadcasts stay claimable so
 * their failed recipients can be retried.
 */
export function resolveBroadcastFinalStatus({
  pendingCount,
  sentCount,
  failedCount,
  totalCount,
}: {
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  totalCount: number;
}): BroadcastStatus {
  if (totalCount === 0) {
    return "sent";
  }
  if (pendingCount > 0) {
    return "failed";
  }
  if (failedCount === 0) {
    return "sent";
  }
  return sentCount > 0 ? "partial" : "failed";
}

export async function listSenderIdentities(): Promise<SenderIdentity[]> {
  return db
    .selectFrom("sender_identities")
    .selectAll()
    .orderBy("created_at", "asc")
    .execute();
}

export async function getSenderIdentityById(
  id: string
): Promise<SenderIdentity | undefined> {
  return db
    .selectFrom("sender_identities")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function createSenderIdentity({
  name,
  email,
  replyTo,
}: {
  name: string;
  email: string;
  replyTo?: string;
}): Promise<SenderIdentity | undefined> {
  return db
    .insertInto("sender_identities")
    .values({
      name,
      email: email.toLowerCase(),
      reply_to: replyTo ?? null,
    })
    .onConflict((oc) => oc.column("email").doNothing())
    .returningAll()
    .executeTakeFirst();
}

/** Sender email is immutable - add a new identity for a new address. */
export async function updateSenderIdentity({
  id,
  name,
  replyTo,
}: {
  id: string;
  name?: string;
  replyTo?: string | null;
}): Promise<SenderIdentity | undefined> {
  const updates: Partial<{ name: string; reply_to: string | null }> = {};
  if (name !== undefined) updates.name = name;
  if (replyTo !== undefined) updates.reply_to = replyTo;

  if (Object.keys(updates).length === 0) {
    return getSenderIdentityById(id);
  }

  return db
    .updateTable("sender_identities")
    .set(updates)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  return db
    .selectFrom("broadcasts")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();
}

export async function getBroadcastById(
  id: string
): Promise<Broadcast | undefined> {
  return db
    .selectFrom("broadcasts")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function createBroadcast({
  subject,
  content,
  senderIdentityId,
}: {
  subject: string;
  content: string;
  senderIdentityId: string;
}): Promise<Broadcast> {
  return db
    .insertInto("broadcasts")
    .values({
      subject,
      content,
      sender_identity_id: senderIdentityId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateBroadcastDraft({
  id,
  subject,
  content,
  senderIdentityId,
}: {
  id: string;
  subject?: string;
  content?: string;
  senderIdentityId?: string;
}): Promise<Broadcast | undefined> {
  const existing = await getBroadcastById(id);
  if (existing?.status !== "draft") {
    return undefined;
  }

  const updates: Partial<{
    subject: string;
    content: string;
    sender_identity_id: string;
    test_sent_to: string | null;
    test_sent_at: Date | null;
  }> = {};
  if (subject !== undefined) updates.subject = subject;
  if (content !== undefined) updates.content = content;
  if (senderIdentityId !== undefined) {
    updates.sender_identity_id = senderIdentityId;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  if (
    editClearsTestApproval({
      broadcast: existing,
      updates: { subject, content, senderIdentityId },
    })
  ) {
    updates.test_sent_to = null;
    updates.test_sent_at = null;
  }

  return db
    .updateTable("broadcasts")
    .set(updates)
    .where("id", "=", id)
    .where("status", "=", "draft")
    .returningAll()
    .executeTakeFirst();
}

export async function deleteBroadcastDraft(id: string): Promise<boolean> {
  const result = await db
    .deleteFrom("broadcasts")
    .where("id", "=", id)
    .where("status", "=", "draft")
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function duplicateBroadcast(
  id: string
): Promise<Broadcast | undefined> {
  const existing = await getBroadcastById(id);
  if (existing === undefined) {
    return undefined;
  }

  return createBroadcast({
    subject: existing.subject,
    content: existing.content,
    senderIdentityId: existing.sender_identity_id,
  });
}

export async function markBroadcastTestSent({
  id,
  email,
}: {
  id: string;
  email: string;
}): Promise<Broadcast | undefined> {
  return db
    .updateTable("broadcasts")
    .set({ test_sent_to: email, test_sent_at: sql`now()` })
    .where("id", "=", id)
    .where("status", "=", "draft")
    .returningAll()
    .executeTakeFirst();
}

/**
 * Atomically claim a broadcast for sending so a double-click or concurrent
 * request can never start the same send twice. A broadcast stuck in "sending"
 * (crashed run) can be reclaimed after 10 minutes of inactivity; the send
 * loop heartbeats via touchBroadcast so a healthy long-running send is never
 * treated as stuck.
 */
export async function claimBroadcastForSending(
  id: string
): Promise<Broadcast | undefined> {
  return db
    .updateTable("broadcasts")
    .set({ status: "sending" })
    .where("id", "=", id)
    .where("test_sent_at", "is not", null)
    .where((eb) =>
      eb.or([
        eb("status", "in", ["draft", "failed", "partial"]),
        eb.and([
          eb("status", "=", "sending"),
          eb("updated_at", "<", sql<Date>`now() - interval '10 minutes'`),
        ]),
      ])
    )
    .returningAll()
    .executeTakeFirst();
}

/** Bumps updated_at (via the table trigger) so the reclaim window stays closed mid-send. */
export async function touchBroadcast(id: string): Promise<void> {
  await db
    .updateTable("broadcasts")
    .set({ status: "sending" })
    .where("id", "=", id)
    .where("status", "=", "sending")
    .execute();
}

/** Records the sender details actually used, kept even if the identity is later edited. */
export async function stampBroadcastSender({
  id,
  from,
  replyTo,
}: {
  id: string;
  from: string;
  replyTo: string | null;
}): Promise<void> {
  await db
    .updateTable("broadcasts")
    .set({ sent_from: from, sent_reply_to: replyTo })
    .where("id", "=", id)
    .where("sent_from", "is", null)
    .execute();
}

/**
 * Snapshot the current verified audience as pending recipient rows. Called
 * only on the first claim of a broadcast - the audience is frozen at first
 * send. The ON CONFLICT guard additionally keeps existing rows untouched, so
 * recipients already marked sent can never be emailed again.
 */
export async function snapshotBroadcastRecipients(
  broadcastId: string
): Promise<void> {
  await db
    .insertInto("broadcast_recipients")
    .columns(["broadcast_id", "subscriber_id", "email"])
    .expression((eb) =>
      eb
        .selectFrom("subscribers")
        .select((seb) => [
          seb.val(broadcastId).as("broadcast_id"),
          "subscribers.id as subscriber_id",
          "subscribers.email as email",
        ])
        .where("status", "=", "verified")
    )
    .onConflict((oc) =>
      oc.columns(["broadcast_id", "subscriber_id"]).doNothing()
    )
    .execute();
}

export type PendingRecipient = {
  id: string;
  email: string;
  subscriberToken: string | null;
  subscriberStatus: SubscriberStatus | null;
};

export async function getPendingRecipients(
  broadcastId: string
): Promise<PendingRecipient[]> {
  const rows = await db
    .selectFrom("broadcast_recipients")
    .leftJoin(
      "subscribers",
      "subscribers.id",
      "broadcast_recipients.subscriber_id"
    )
    .select([
      "broadcast_recipients.id as id",
      "broadcast_recipients.email as email",
      "subscribers.token as subscriberToken",
      "subscribers.status as subscriberStatus",
    ])
    .where("broadcast_recipients.broadcast_id", "=", broadcastId)
    .where("broadcast_recipients.status", "=", "pending")
    .orderBy("broadcast_recipients.email", "asc")
    .execute();

  return rows;
}

export async function markRecipientSent(id: string): Promise<void> {
  await db
    .updateTable("broadcast_recipients")
    .set({ status: "sent", sent_at: sql`now()`, error: null })
    .where("id", "=", id)
    .execute();
}

export async function markRecipientFailed({
  id,
  error,
}: {
  id: string;
  error: string;
}): Promise<void> {
  await db
    .updateTable("broadcast_recipients")
    .set({ status: "failed", error })
    .where("id", "=", id)
    .execute();
}

export async function markRecipientSkipped({
  id,
  reason,
}: {
  id: string;
  reason: string;
}): Promise<void> {
  await db
    .updateTable("broadcast_recipients")
    .set({ status: "skipped", error: reason })
    .where("id", "=", id)
    .execute();
}

/** Flip failed rows back to pending so the send loop can retry them. */
export async function resetFailedRecipients(
  broadcastId: string
): Promise<number> {
  const result = await db
    .updateTable("broadcast_recipients")
    .set({ status: "pending", error: null })
    .where("broadcast_id", "=", broadcastId)
    .where("status", "=", "failed")
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export type RecipientCounts = {
  totalCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
};

export async function getRecipientCounts(
  broadcastId: string
): Promise<RecipientCounts> {
  const rows = await db
    .selectFrom("broadcast_recipients")
    .select(["status", sql<number>`count(*)::int`.as("count")])
    .where("broadcast_id", "=", broadcastId)
    .groupBy("status")
    .execute();

  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  const pendingCount = byStatus.get("pending") ?? 0;
  const sentCount = byStatus.get("sent") ?? 0;
  const failedCount = byStatus.get("failed") ?? 0;
  const skippedCount = byStatus.get("skipped") ?? 0;
  return {
    totalCount: pendingCount + sentCount + failedCount + skippedCount,
    pendingCount,
    sentCount,
    failedCount,
    skippedCount,
  };
}

export async function listBroadcastRecipients({
  broadcastId,
  status,
}: {
  broadcastId: string;
  status?: BroadcastRecipient["status"];
}): Promise<BroadcastRecipient[]> {
  let query = db
    .selectFrom("broadcast_recipients")
    .selectAll()
    .where("broadcast_id", "=", broadcastId);
  if (status !== undefined) {
    query = query.where("status", "=", status);
  }
  return query.orderBy("email", "asc").execute();
}

export async function finalizeBroadcast(
  id: string
): Promise<Broadcast | undefined> {
  const counts = await getRecipientCounts(id);
  const status = resolveBroadcastFinalStatus({
    pendingCount: counts.pendingCount,
    sentCount: counts.sentCount,
    failedCount: counts.failedCount,
    totalCount: counts.totalCount,
  });

  return db
    .updateTable("broadcasts")
    .set({
      status,
      recipient_count: counts.totalCount,
      success_count: counts.sentCount,
      failed_count: counts.failedCount,
      sent_at: counts.sentCount > 0 ? sql`now()` : null,
    })
    .where("id", "=", id)
    .where("status", "=", "sending")
    .returningAll()
    .executeTakeFirst();
}

export async function updateLastBroadcastAt(emails: string[]): Promise<void> {
  if (emails.length === 0) {
    return;
  }

  const normalizedEmails = emails.map((email) => email.toLowerCase());

  await db
    .updateTable("subscribers")
    .set({ last_broadcast_at: sql`now()` })
    .where("email", "in", normalizedEmails)
    .execute();
}

export async function countVerifiedSubscribers(): Promise<number> {
  const row = await db
    .selectFrom("subscribers")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("status", "=", "verified")
    .executeTakeFirstOrThrow();
  return row.count;
}
