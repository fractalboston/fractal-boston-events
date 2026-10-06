import { Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("subscriber_tags")
    .ifNotExists()
    .addColumn("subscriber_id", "uuid", (col) =>
      col.notNull().references("subscribers.id").onDelete("cascade")
    )
    .addColumn("tag", "varchar(100)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint("subscriber_tags_pkey", ["subscriber_id", "tag"])
    .execute();

  await db.schema
    .createIndex("idx_subscriber_tags_tag")
    .ifNotExists()
    .on("subscriber_tags")
    .column("tag")
    .execute();

  await db.schema
    .alterTable("broadcasts")
    .addColumn("audience_tag", "varchar(100)")
    .execute();

  await db.schema
    .alterTable("broadcasts")
    .addColumn("audience_scope", "varchar(20)", (col) =>
      col.notNull().defaultTo("verified")
    )
    .execute();

  await sql`ALTER TABLE public.subscriber_tags ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("broadcasts")
    .dropColumn("audience_scope")
    .execute();
  await db.schema.alterTable("broadcasts").dropColumn("audience_tag").execute();
  await db.schema.dropTable("subscriber_tags").ifExists().execute();
}
