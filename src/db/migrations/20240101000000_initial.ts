import { Kysely, sql } from "kysely";
import type { Database } from "@/db/index";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("subscribers")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("token", "uuid", (col) =>
      col
        .notNull()
        .unique()
        .defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("source", "varchar(20)", (col) =>
      col.notNull().defaultTo("form")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("idx_subscribers_email")
    .ifNotExists()
    .on("subscribers")
    .column("email")
    .execute();

  await db.schema
    .createIndex("idx_subscribers_token")
    .ifNotExists()
    .on("subscribers")
    .column("token")
    .execute();

  await db.schema
    .createIndex("idx_subscribers_status")
    .ifNotExists()
    .on("subscribers")
    .column("status")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("subscribers").ifExists().execute();
}
