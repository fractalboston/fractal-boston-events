import { Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("sender_identities")
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
    .addColumn("name", "varchar(100)", (col) => col.notNull())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("reply_to", "varchar(255)")
    .execute();

  await sql`
    CREATE OR REPLACE TRIGGER trg_sender_identities_set_updated_at
    BEFORE UPDATE ON sender_identities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db
    .insertInto("sender_identities")
    .values([
      { name: "Fractal Events", email: "events@fractal.boston" },
      { name: "Fractal Boston", email: "hello@fractal.boston" },
    ])
    .onConflict((oc) => oc.column("email").doNothing())
    .execute();

  await db.schema
    .createTable("broadcasts")
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
    .addColumn("subject", "varchar(255)", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("draft")
    )
    .addColumn("sender_identity_id", "uuid", (col) =>
      col.notNull().references("sender_identities.id")
    )
    .addColumn("test_sent_to", "varchar(255)")
    .addColumn("test_sent_at", "timestamptz")
    .addColumn("sent_at", "timestamptz")
    .addColumn("sent_from", "varchar(255)")
    .addColumn("sent_reply_to", "varchar(255)")
    .addColumn("recipient_count", "integer")
    .addColumn("success_count", "integer")
    .addColumn("failed_count", "integer")
    .execute();

  await sql`
    CREATE OR REPLACE TRIGGER trg_broadcasts_set_updated_at
    BEFORE UPDATE ON broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createIndex("idx_broadcasts_status")
    .ifNotExists()
    .on("broadcasts")
    .column("status")
    .execute();

  await db.schema
    .createTable("broadcast_recipients")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("broadcast_id", "uuid", (col) =>
      col.notNull().references("broadcasts.id").onDelete("cascade")
    )
    .addColumn("subscriber_id", "uuid", (col) =>
      col.references("subscribers.id").onDelete("set null")
    )
    .addColumn("email", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("error", "text")
    .addColumn("sent_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_broadcast_recipients_broadcast_subscriber")
    .ifNotExists()
    .unique()
    .on("broadcast_recipients")
    .columns(["broadcast_id", "subscriber_id"])
    .execute();

  await db.schema
    .createIndex("idx_broadcast_recipients_broadcast_status")
    .ifNotExists()
    .on("broadcast_recipients")
    .columns(["broadcast_id", "status"])
    .execute();

  await db.schema
    .alterTable("subscribers")
    .addColumn("last_broadcast_at", "timestamptz")
    .execute();

  await sql`ALTER TABLE public.sender_identities ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
  await sql`ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
  await sql`ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("subscribers")
    .dropColumn("last_broadcast_at")
    .execute();
  await db.schema.dropTable("broadcast_recipients").ifExists().execute();
  await db.schema.dropTable("broadcasts").ifExists().execute();
  await db.schema.dropTable("sender_identities").ifExists().execute();
}
