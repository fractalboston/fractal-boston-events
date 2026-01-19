import { sql } from "kysely";
import { db } from "./index";

async function migrate(): Promise<void> {
  const database = db;
  await database.schema
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

  // Create index on email for faster lookups
  await database.schema
    .createIndex("idx_subscribers_email")
    .ifNotExists()
    .on("subscribers")
    .column("email")
    .execute();

  // Create index on token for verify/unsubscribe lookups
  await database.schema
    .createIndex("idx_subscribers_token")
    .ifNotExists()
    .on("subscribers")
    .column("token")
    .execute();

  // Create index on status for filtering verified subscribers
  await database.schema
    .createIndex("idx_subscribers_status")
    .ifNotExists()
    .on("subscribers")
    .column("status")
    .execute();
}

async function main(): Promise<void> {
  console.log("Running migrations...");
  await migrate();
  console.log("Migrations complete!");
  await db.destroy();
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
