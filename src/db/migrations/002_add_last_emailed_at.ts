import { Kysely } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("subscribers")
    .addColumn("last_emailed_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("subscribers")
    .dropColumn("last_emailed_at")
    .execute();
}
