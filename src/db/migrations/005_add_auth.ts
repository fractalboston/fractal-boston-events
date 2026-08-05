import { Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("webauthn_credentials")
    .ifNotExists()
    .addColumn("credential_id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("public_key", "bytea", (col) => col.notNull())
    .addColumn("counter", "bigint", (col) => col.notNull().defaultTo(0))
    .addColumn("transports", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("idx_webauthn_credentials_user_id")
    .ifNotExists()
    .on("webauthn_credentials")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("sessions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("idx_sessions_user_id")
    .ifNotExists()
    .on("sessions")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_sessions_expires_at")
    .ifNotExists()
    .on("sessions")
    .column("expires_at")
    .execute();

  await db.schema
    .createTable("invites")
    .ifNotExists()
    .addColumn("token", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("label", "varchar(120)", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("created_by", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("accepted_at", "timestamptz")
    .addColumn("accepted_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null")
    )
    .execute();

  await db.schema
    .createIndex("idx_invites_status")
    .ifNotExists()
    .on("invites")
    .column("status")
    .execute();

  await db.schema
    .createTable("auth_challenges")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("challenge", "text", (col) => col.notNull())
    .addColumn("user_id", "uuid")
    .addColumn("invite_token", "uuid")
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("idx_auth_challenges_expires_at")
    .ifNotExists()
    .on("auth_challenges")
    .column("expires_at")
    .execute();

  await sql`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
  await sql`ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE public.auth_challenges ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("auth_challenges").ifExists().execute();
  await db.schema.dropTable("invites").ifExists().execute();
  await db.schema.dropTable("sessions").ifExists().execute();
  await db.schema.dropTable("webauthn_credentials").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}
