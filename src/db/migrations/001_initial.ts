import { Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  await sql`CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    LANGUAGE sql STRICT PARALLEL SAFE
    RETURN ((lpad(to_hex((floor((EXTRACT(epoch FROM clock_timestamp()) * (1000)::numeric)))::bigint), 12, '0'::text) || encode(gen_random_bytes(10), 'hex'::text)))::uuid;
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
    $$;
  `.execute(db);

  await db.schema
    .createTable("subscribers")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("token", "varchar(32)", (col) =>
      col
        .notNull()
        .unique()
        .defaultTo(sql`lower(encode(gen_random_bytes(16), 'hex'))`)
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("source", "varchar(20)", (col) => col.notNull())
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

  await sql`
    CREATE OR REPLACE TRIGGER trg_subscribers_set_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("subscribers").ifExists().execute();
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS generate_ulid()`.execute(db);
}
