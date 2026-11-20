import { type Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("subscribers")
    .addColumn("verification_sent_at", "timestamptz")
    .execute();

  // Approximate prior sends with created_at so older pending links stay
  // outside the confirm-button window and can still auto-verify.
  await db
    .updateTable("subscribers")
    .set({ verification_sent_at: sql`created_at` })
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("subscribers")
    .dropColumn("verification_sent_at")
    .execute();
}
